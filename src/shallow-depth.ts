export interface ShallowBodyAnalysis {
  shallow: boolean;
  reason?: "implementation returns its input unchanged" | "implementation body is empty" | "implementation body only passes";
}

const MAX_BODY_LINES = 24;
const IDENTITY_RETURN_REASON = "implementation returns its input unchanged" as const;
const EMPTY_BODY_REASON = "implementation body is empty" as const;
const PASS_BODY_REASON = "implementation body only passes" as const;

export function analyzeShallowBody(file: string, source: string, evidenceLine: number): ShallowBodyAnalysis {
  const lines = source.split(/\r?\n/);
  const index = evidenceLine - 1;
  if (index < 0 || index >= lines.length) return { shallow: false };

  if (/\.py$/i.test(file)) return analyzePython(lines, index);
  if (/\.(?:js|jsx|ts|tsx|cjs|mjs|cts|mts)$/i.test(file)) return analyzeJavaScript(lines, index);
  return { shallow: false };
}

function analyzePython(lines: string[], index: number): ShallowBodyAnalysis {
  const declaration = lines[index] ?? "";
  const match = /^(\s*)(?:async\s+)?def\s+[A-Za-z_]\w*\s*\(([^)]*)\)[^:]*:(.*)$/.exec(declaration);
  if (!match) return { shallow: false };

  const indentation = match[1];
  const parameters = match[2];
  const inlineBody = match[3];
  if (indentation === undefined || parameters === undefined || inlineBody === undefined) return { shallow: false };
  const normalizedInlineBody = inlineBody.trimStart().startsWith("#") ? "" : inlineBody;
  const body = normalizedInlineBody.trim() ? [normalizedInlineBody] : pythonBodyLines(lines, index + 1, indentation.length);
  return classifyStatements(body, parameterNames(parameters, "python"), true);
}

function pythonBodyLines(lines: string[], start: number, declarationIndentation: number): string[] {
  const body: string[] = [];
  for (let index = start; index < Math.min(lines.length, start + MAX_BODY_LINES); index++) {
    const line = lines[index] ?? "";
    if (line.trim() && indentationWidth(line) <= declarationIndentation) break;
    body.push(line);
  }
  return body;
}

function analyzeJavaScript(lines: string[], index: number): ShallowBodyAnalysis {
  const header = lines[index] ?? "";
  const window = lines.slice(index, index + MAX_BODY_LINES).join("\n");
  const functionMatch = /\b(?:async\s+)?function\b[^\n(]*\(([^)]*)\)\s*(?::[^\n{]+)?\{/.exec(header);
  if (functionMatch) {
    return classifyJavaScriptBlock(window, functionMatch.index + functionMatch[0].length - 1, parameterNames(functionMatch[1] ?? "", "javascript"));
  }

  const arrowMatch = /(?:async\s+)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*(?::[^=\n]+)?=>/.exec(header);
  if (!arrowMatch) return { shallow: false };

  const parameters = parameterNames(arrowMatch[1] ?? arrowMatch[2] ?? "", "javascript");
  const bodyStart = arrowMatch.index + arrowMatch[0].length;
  const body = window.slice(bodyStart);
  const trimmedBody = body.trimStart();
  if (!trimmedBody) return { shallow: false };
  if (trimmedBody.startsWith("{")) return classifyJavaScriptBlock(window, bodyStart + body.length - trimmedBody.length, parameters);
  const [firstLineValue = "", ...remainingLines] = trimmedBody.split(/\r?\n/);
  const firstLine = firstLineValue.trim();
  const remainder = remainingLines.join("\n").trimStart();
  const startsNewDeclaration = /^(?:export\s+)?(?:async\s+function|class|const|enum|function|import|interface|let|type|var)\b/.test(remainder);
  if (!firstLine || (remainder && !firstLine.includes(";") && !startsNewDeclaration)) return { shallow: false };
  return classifyStatements([firstLine], parameters, false, true);
}

function classifyJavaScriptBlock(source: string, openingBrace: number, parameters: ReadonlySet<string>): ShallowBodyAnalysis {
  const closingBrace = findMatchingBrace(source, openingBrace);
  if (closingBrace === undefined) return { shallow: false };
  return classifyStatements([source.slice(openingBrace + 1, closingBrace)], parameters, false);
}

function findMatchingBrace(source: string, openingBrace: number): number | undefined {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;
  for (let index = openingBrace; index < source.length; index++) {
    const character = source[index] ?? "";
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      index = source.indexOf("\n", index + 2);
      if (index < 0) return undefined;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      const commentEnd = source.indexOf("*/", index + 2);
      if (commentEnd < 0) return undefined;
      index = commentEnd + 1;
      continue;
    }
    if (character === "{") depth++;
    if (character === "}" && --depth === 0) return index;
  }
  return undefined;
}

function classifyStatements(body: string[], parameters: ReadonlySet<string>, supportsPass: boolean, allowsExpressionIdentity = false): ShallowBodyAnalysis {
  let statements = body
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/^\s*#.*$/gm, "")
    .trim();
  if (supportsPass) statements = statements.replace(/#.*$/gm, "").trim();
  if (!statements) return { shallow: true, reason: EMPTY_BODY_REASON };
  if (supportsPass && /^pass\s*;?\s*$/.test(statements)) return { shallow: true, reason: PASS_BODY_REASON };

  const identityReturn = /^(?:return\s+)?\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*;?\s*$/.exec(statements);
  if (identityReturn && (allowsExpressionIdentity || statements.startsWith("return")) && parameters.has(identityReturn[1] ?? "")) return { shallow: true, reason: IDENTITY_RETURN_REASON };
  return { shallow: false };
}

function parameterNames(source: string, language: "python" | "javascript"): ReadonlySet<string> {
  const pattern = language === "python"
    ? /^\s*\*{0,2}([A-Za-z_]\w*)(?=\s*(?::|=|$))/
    : /^\s*(?:\.\.\.)?([A-Za-z_$][\w$]*)\s*\??(?=\s*(?::|=|$))/;
  return new Set(source.split(",").map((parameter) => pattern.exec(parameter)?.[1]).filter((name): name is string => Boolean(name)));
}

function indentationWidth(line: string): number {
  return /^\s*/.exec(line)?.[0].length ?? 0;
}
