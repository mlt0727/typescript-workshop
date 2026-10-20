import ts from 'typescript';

export type ResolvedImport =
  | { kind: 'file'; path: string }
  | { kind: 'css'; path: string }
  | { kind: 'dep'; name: string }
  | { kind: 'missing'; specifier: string };

/** 沙箱中提供的循环保护函数名（DOM/React 模式）。 */
export const LOOP_GUARD_NAME = '__tsw_loop_guard__';

/**
 * 在 for / for-in / for-of / while / do-while 的循环体开头插入保护调用。
 * 沙箱 iframe 与主页面同线程（已在 Chromium/WebKit 实测），同步死循环会冻结整个标签页，
 * 所以 DOM/React 模式需要它；纯 TS 模式在 Worker 中运行，靠 terminate() 中断。
 */
export function loopGuardTransformer(): ts.TransformerFactory<ts.SourceFile> {
  return (context) => {
    const f = context.factory;
    const guardCall = () =>
      f.createExpressionStatement(f.createCallExpression(f.createIdentifier(LOOP_GUARD_NAME), undefined, []));
    const wrap = (body: ts.Statement): ts.Statement => {
      const visited = ts.visitNode(body, visit, ts.isStatement);
      if (ts.isBlock(visited)) return f.updateBlock(visited, [guardCall(), ...visited.statements]);
      return f.createBlock([guardCall(), visited], true);
    };
    const visit = (node: ts.Node): ts.Node => {
      if (ts.isForStatement(node)) {
        return f.updateForStatement(
          node,
          ts.visitNode(node.initializer, visit, ts.isForInitializer),
          ts.visitNode(node.condition, visit, ts.isExpression),
          ts.visitNode(node.incrementor, visit, ts.isExpression),
          wrap(node.statement),
        );
      }
      if (ts.isForOfStatement(node)) {
        return f.updateForOfStatement(
          node,
          node.awaitModifier,
          ts.visitNode(node.initializer, visit, ts.isForInitializer)!,
          ts.visitNode(node.expression, visit, ts.isExpression)!,
          wrap(node.statement),
        );
      }
      if (ts.isForInStatement(node)) {
        return f.updateForInStatement(
          node,
          ts.visitNode(node.initializer, visit, ts.isForInitializer)!,
          ts.visitNode(node.expression, visit, ts.isExpression)!,
          wrap(node.statement),
        );
      }
      if (ts.isWhileStatement(node)) {
        return f.updateWhileStatement(node, ts.visitNode(node.expression, visit, ts.isExpression)!, wrap(node.statement));
      }
      if (ts.isDoStatement(node)) {
        return f.updateDoStatement(node, wrap(node.statement), ts.visitNode(node.expression, visit, ts.isExpression)!);
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (sf) => ts.visitNode(sf, visit, ts.isSourceFile);
  };
}

/** 把 import/export/动态 import 中的模块说明符替换成占位符，沙箱据此用 blob URL 链接模块。 */
export function rewriteSpecifiersTransformer(
  rewrite: (specifier: string) => string,
): ts.TransformerFactory<ts.SourceFile> {
  return (context) => {
    const f = context.factory;
    const visit = (node: ts.Node): ts.Node => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        return f.updateImportDeclaration(
          node,
          node.modifiers,
          node.importClause,
          f.createStringLiteral(rewrite(node.moduleSpecifier.text)),
          node.attributes,
        );
      }
      if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        return f.updateExportDeclaration(
          node,
          node.modifiers,
          node.isTypeOnly,
          node.exportClause,
          f.createStringLiteral(rewrite(node.moduleSpecifier.text)),
          node.attributes,
        );
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length >= 1 &&
        ts.isStringLiteralLike(node.arguments[0]!)
      ) {
        const [first, ...rest] = node.arguments;
        return f.updateCallExpression(node, node.expression, node.typeArguments, [
          f.createStringLiteral(rewrite((first as ts.StringLiteralLike).text)),
          ...rest.map((a) => ts.visitNode(a, visit, ts.isExpression)!),
        ]);
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (sf) => ts.visitNode(sf, visit, ts.isSourceFile);
  };
}
