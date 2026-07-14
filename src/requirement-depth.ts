import type { RequirementStatus } from "./types.js";

export interface RequirementDepthContext {
  implementationSources: ReadonlyMap<string, string>;
  testSources?: ReadonlyMap<string, string>;
}

export interface RequirementDepthMatch {
  status: RequirementStatus;
  evidence: string[];
  missingEvidence: string[];
  evaluable: boolean;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "should", "the", "this", "to", "when", "with"
]);
const ABSTRACT_TOKENS = new Set([
  "better", "best", "experience", "general", "improve", "maintainability", "overall", "performance", "quality", "reliability", "security", "usability"
]);
// Keep this intentionally small: it canonicalizes common repository wording, not fuzzy matches.
const SYNONYMS: Readonly<Record<string, string>> = {
  complete: "complete",
  done: "complete",
  edit: "edit",
  filtering: "filter",
  load: "save",
  modify: "edit",
  persist: "save",
  remove: "delete",
  save: "save",
  validation: "validate"
};
const ACTION_TOKENS = new Set(["add", "complete", "delete", "edit", "filter", "list", "prioritize", "save", "validate"]);
const MAX_EVIDENCE = 3;
const MAX_MISSING_REASONS = 3;
const IMPLEMENTATION_ANCHOR = /\b(?:action|async|case|command|def|else|function|handler|if|match|switch|when)\b|=>/i;
const TEST_ANCHOR = /\b(?:it|specify|test)\b|\bdef\s+test_/i;
const COMMAND_BRANCH = /\b(?:if|case|switch|match)\b.*\b(?:action|cmd|command|subcommand)\b/i;
const EXCLUDED_SOURCE_PATH = /(?:^|\/)(?:\.next|build|coverage|deps?|dist|docs?|documentation|examples?|fixtures?|generated|node_modules|vendor|__generated__)(?:\/|$)|\.(?:md|mdx|txt)$/i;
const TEST_PATH = /(?:^|\/)(?:__tests__|specs?|tests?)(?:\/|$)|(?:^|\/)(?:test_.*|.*(?:\.test|\.spec|_test))\.[^/]+$/i;

interface Signal {
  kind: "implementation" | "test";
  file: string;
  line: number;
}

export function normalizeRequirementTokens(value: string): string[] {
  const words = value
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .match(/[A-Za-z][A-Za-z\d]*/g) ?? [];
  const tokens = words
    .map((word) => word.toLowerCase())
    .filter((word) => !STOP_WORDS.has(word))
    .map((word) => SYNONYMS[word] ?? word);
  return [...new Set(tokens)];
}

export function evaluateRequirementDepth(claim: string, context: RequirementDepthContext): RequirementDepthMatch {
  const claimTokens = normalizeRequirementTokens(claim);
  const evaluable = claimTokens.filter((token) => !ABSTRACT_TOKENS.has(token)).length >= 2;
  if (!evaluable) {
    return {
      status: "unverifiable",
      evidence: [],
      missingEvidence: ["Insufficient concrete requirement tokens"],
      evaluable: false
    };
  }

  const claimTokenSet = new Set(claimTokens);
  const implementationSignals = collectSignals(context.implementationSources, claimTokenSet, "implementation");
  const testSignals = context.testSources ? collectSignals(context.testSources, claimTokenSet, "test") : [];
  const hasImplementation = implementationSignals.length > 0;
  const satisfied = hasImplementation && (implementationSignals.length > 1 || testSignals.length > 0);
  const status: RequirementStatus = satisfied ? "satisfied" : hasImplementation ? "partially_satisfied" : "missing";
  const missingEvidence = status === "satisfied"
    ? []
    : stableBound([
      ...(!hasImplementation ? ["matching implementation function or command branch"] : []),
      ...(hasImplementation && testSignals.length === 0 ? ["focused test or a second implementation signal"] : [])
    ], MAX_MISSING_REASONS);

  return {
    status,
    evidence: stableBound([...implementationSignals, ...testSignals].map(formatSignal), MAX_EVIDENCE),
    missingEvidence,
    evaluable: true
  };
}

function collectSignals(sources: ReadonlyMap<string, string>, claimTokens: ReadonlySet<string>, kind: Signal["kind"]): Signal[] {
  const signals: Signal[] = [];
  for (const [file, source] of sources) {
    if (!isEligibleSource(file, kind)) continue;
    for (const [index, line] of stripComments(source).split(/\r?\n/).entries()) {
      if (!hasMatchingTokens(line, claimTokens, kind) || !hasRequiredAnchor(line, kind)) continue;
      signals.push({ kind, file, line: index + 1 });
    }
  }
  return signals.sort(compareSignals);
}

function isEligibleSource(file: string, kind: Signal["kind"]): boolean {
  if (EXCLUDED_SOURCE_PATH.test(file)) return false;
  return kind === "test" ? TEST_PATH.test(file) : !TEST_PATH.test(file);
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*#.*$/gm, "")
    .replace(/#.*$/gm, "")
    .replace(/\/\/.*$/gm, "");
}

function hasMatchingTokens(line: string, claimTokens: ReadonlySet<string>, kind: Signal["kind"]): boolean {
  const code = stripQuotedLiterals(line);
  const tokenSource = kind === "test" || COMMAND_BRANCH.test(code) ? line : code;
  const sourceTokens = normalizeRequirementTokens(tokenSource);
  const requiredActions = [...claimTokens].filter((token) => ACTION_TOKENS.has(token));
  if (requiredActions.length > 0 && !sourceTokens.some((token) => requiredActions.includes(token))) return false;
  let matches = 0;
  for (const token of sourceTokens) {
    if (!claimTokens.has(token)) continue;
    matches++;
    if (matches >= 2) return true;
  }
  return false;
}

function hasRequiredAnchor(line: string, kind: Signal["kind"]): boolean {
  return (kind === "implementation" ? IMPLEMENTATION_ANCHOR : TEST_ANCHOR).test(stripQuotedLiterals(line));
}

function stripQuotedLiterals(line: string): string {
  return line.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, "");
}

function formatSignal(signal: Signal): string {
  return `${signal.kind}: ${signal.file}:${signal.line}`;
}

function compareSignals(left: Signal, right: Signal): number {
  return left.file === right.file ? left.line - right.line : left.file < right.file ? -1 : 1;
}

function stableBound(values: string[], limit: number): string[] {
  return [...new Set(values)].sort().slice(0, limit);
}
