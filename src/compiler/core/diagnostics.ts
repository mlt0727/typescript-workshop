import ts from 'typescript';
import type { DiagnosticCategory, DiagnosticInfo } from './types.ts';

function category(c: ts.DiagnosticCategory): DiagnosticCategory {
  switch (c) {
    case ts.DiagnosticCategory.Error:
      return 'error';
    case ts.DiagnosticCategory.Warning:
      return 'warning';
    case ts.DiagnosticCategory.Suggestion:
      return 'suggestion';
    default:
      return 'message';
  }
}

function relPath(sf: ts.SourceFile | undefined): string | undefined {
  if (!sf) return undefined;
  return sf.fileName.startsWith('/') ? sf.fileName.slice(1) : sf.fileName;
}

export function toDiagnosticInfo(d: ts.Diagnostic): DiagnosticInfo {
  const info: DiagnosticInfo = {
    code: d.code,
    category: category(d.category),
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
  };
  if (d.file && d.start !== undefined) {
    const start = d.file.getLineAndCharacterOfPosition(d.start);
    const end = d.file.getLineAndCharacterOfPosition(d.start + (d.length ?? 0));
    info.file = relPath(d.file);
    info.start = d.start;
    info.length = d.length ?? 0;
    info.line = start.line + 1;
    info.column = start.character + 1;
    info.endLine = end.line + 1;
    info.endColumn = end.character + 1;
  }
  if (d.relatedInformation?.length) {
    info.related = d.relatedInformation.map((r) => {
      const pos = r.file && r.start !== undefined ? r.file.getLineAndCharacterOfPosition(r.start) : undefined;
      return {
        file: relPath(r.file),
        line: pos ? pos.line + 1 : undefined,
        column: pos ? pos.character + 1 : undefined,
        message: ts.flattenDiagnosticMessageText(r.messageText, '\n'),
      };
    });
  }
  return info;
}
