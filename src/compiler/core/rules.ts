import ts from 'typescript';
import type { RuleId, RuleViolation } from './types.ts';

/**
 * 基于 AST 的规则检查（不是源码关键词搜索）：
 * 字符串、注释中出现 "any" 不会误报；`as const` 与 `satisfies` 不算类型断言。
 */
const MESSAGES: Record<RuleId, string> = {
  any: '本题不允许显式使用 any：它会关闭类型检查，让错误的实现也“看起来正确”。',
  'type-assertion':
    '本题不允许类型断言（as T / <T>x）：断言只是告诉编译器“相信我”，不会在运行时验证数据。as const 不受限制。',
  'non-null-assertion':
    '本题不允许非空断言（x!）：请用条件判断等方式先确认值不是 null/undefined。',
  'ts-directive':
    '本题不允许 @ts-ignore / @ts-nocheck / @ts-expect-error：它们会隐藏真实的类型错误。',
};

export function checkRules(sf: ts.SourceFile, forbid: readonly RuleId[]): RuleViolation[] {
  const out: RuleViolation[] = [];
  const file = sf.fileName.startsWith('/') ? sf.fileName.slice(1) : sf.fileName;
  const report = (rule: RuleId, pos: number) => {
    const lc = sf.getLineAndCharacterOfPosition(pos);
    out.push({ rule, file, line: lc.line + 1, column: lc.character + 1, message: MESSAGES[rule] });
  };
  const has = (r: RuleId) => forbid.includes(r);

  const visit = (node: ts.Node) => {
    if (has('any') && node.kind === ts.SyntaxKind.AnyKeyword) {
      report('any', node.getStart(sf));
    }
    if (has('type-assertion')) {
      if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
        const isConst =
          ts.isTypeReferenceNode(node.type) &&
          ts.isIdentifier(node.type.typeName) &&
          node.type.typeName.text === 'const';
        if (!isConst) report('type-assertion', node.getStart(sf));
      }
    }
    if (has('non-null-assertion') && ts.isNonNullExpression(node)) {
      report('non-null-assertion', node.getStart(sf));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (has('ts-directive')) {
    const seen = new Set<number>();
    const text = sf.getFullText();
    const scanComments = (pos: number) => {
      for (const range of [
        ...(ts.getLeadingCommentRanges(text, pos) ?? []),
        ...(ts.getTrailingCommentRanges(text, pos) ?? []),
      ]) {
        if (seen.has(range.pos)) continue;
        seen.add(range.pos);
        const comment = text.slice(range.pos, range.end);
        if (/@ts-(ignore|nocheck|expect-error)\b/.test(comment)) report('ts-directive', range.pos);
      }
    };
    const walkTokens = (node: ts.Node) => {
      scanComments(node.pos);
      scanComments(node.end);
      for (const child of node.getChildren(sf)) walkTokens(child);
    };
    walkTokens(sf);
  }

  out.sort((a, b) => a.line - b.line || a.column - b.column);
  return out;
}
