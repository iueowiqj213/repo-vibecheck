import type { RequirementMatch, RequirementStatus } from "./types.js";

export interface EvidenceContext { files: string[]; dependencies: string[]; sources: Map<string, string> }

type Concept = "authentication" | "payment" | "database" | "email" | "docker" | "tests" | "api" | "deployment";
type EvidenceSignal = "dependency" | "file" | "source";
interface Rule { concept: Concept; claim: RegExp; dependency?: RegExp; file?: RegExp; source?: RegExp; required: Array<{ signal: EvidenceSignal; label: string }> }
interface ExtractedRequirement {
  claim: string;
  requirementId: string;
  sourceLine: number;
  declaredDowngrade?: Extract<RequirementStatus, "partially_satisfied" | "missing">;
}

const README_REQUIREMENT_HEADINGS = new Set([
  "requirements",
  "requirement checklist",
  "acceptance criteria",
  "feature requirements"
]);

type DeclaredDowngrade = Extract<RequirementStatus, "partially_satisfied" | "missing">;

const NEGATIVE_STATUS_DECLARATIONS: Array<{ pattern: RegExp; downgrade: DeclaredDowngrade }> = [
  { pattern: /^\s*(?:partial(?:\s*\/\s*shallow)?|shallow|incomplete)\s*:\s*(.+?)\s*$/i, downgrade: "partially_satisfied" },
  { pattern: /^\s*missing\s+depth\s*:\s*(.+?)\s*$/i, downgrade: "partially_satisfied" }
];

function normalizeRequirementReference(reference: string): string {
  return reference.replace(/^\[(.+)\]$/, "$1").toUpperCase();
}

function parseNegativeStatusDeclaration(rawLine: string): { downgrade: DeclaredDowngrade; references: string[] } | undefined {
  for (const declaration of NEGATIVE_STATUS_DECLARATIONS) {
    const match = rawLine.match(declaration.pattern);
    const referenceList = match?.[1];
    if (!referenceList) continue;
    const references = referenceList.split(",").map((reference) => normalizeRequirementReference(reference.trim()));
    if (references.length > 0 && references.every((reference) => /^(?:\d+|[A-Z][A-Z0-9_-]*-\d+)$/.test(reference))) {
      return { downgrade: declaration.downgrade, references };
    }
  }
}

const RULES: Rule[] = [
  { concept: "authentication", claim: /\b(auth(?:entication)?|login|session)\b/i, dependency: /auth|passport|clerk/i, file: /auth|login|middleware|session/i, source: /getServerSession|signIn|authenticate|session/i, required: [{ signal: "file", label: "implementation file" }, { signal: "source", label: "auth source usage" }] },
  { concept: "payment", claim: /\b(stripe|payment|checkout)\b/i, dependency: /stripe/i, file: /checkout|payment|stripe|webhook/i, source: /checkout\.sessions\.create|paymentIntents\.create|webhooks\.constructEvent/i, required: [{ signal: "dependency", label: "payment dependency" }, { signal: "source", label: "server-side payment call" }] },
  { concept: "database", claim: /\b(database|prisma|supabase|firebase|db)\b/i, dependency: /prisma|supabase|firebase|mongoose|sequelize|drizzle/i, file: /prisma|schema|database|(?:^|\/)db\./i, source: /PrismaClient|createClient|mongoose\.connect/i, required: [{ signal: "dependency", label: "database dependency" }, { signal: "source", label: "database schema or client usage" }] },
  { concept: "email", claim: /\b(email|resend|sendgrid|nodemailer)\b/i, dependency: /resend|sendgrid|nodemailer/i, file: /email|mail/i, source: /\.send\(|sendMail|emails\.send/i, required: [{ signal: "dependency", label: "email provider dependency" }, { signal: "source", label: "email send call" }] },
  { concept: "docker", claim: /\b(docker|container)\b/i, file: /(^|\/)(Dockerfile|docker-compose\.ya?ml)$/i, required: [{ signal: "file", label: "Dockerfile or compose file" }] },
  { concept: "tests", claim: /\b(test(?:s|ing)?|vitest|jest)\b/i, dependency: /vitest|jest|mocha/i, file: /(?:^|\/)(?:test_.*|.*_test)\.py$|(?:test|spec)\.[cm]?[jt]sx?$/i, required: [{ signal: "file", label: "test files" }] },
  { concept: "api", claim: /\b(api|backend|server)\b/i, file: /app\/api|pages\/api|routes?|server/i, source: /router\.|app\.(get|post|put|delete)|export async function (GET|POST)/i, required: [{ signal: "source", label: "API route or server handler" }] },
  { concept: "deployment", claim: /\b(deploy(?:ment)?|vercel|hosting)\b/i, file: /vercel\.json|netlify\.toml|Dockerfile|\.github\/workflows/i, required: [{ signal: "file", label: "deployment configuration" }] }
];

export function extractClaims(text: string): string[] {
  const claims: string[] = [];
  let current = "";
  for (const rawLine of text.split(/\r?\n/)) {
    const isListItem = /^\s*(?:[-*+] |\d+[.)]\s*)/.test(rawLine);
    let line = rawLine.replace(/^\s*(?:[-*+] |\d+[.)]\s*)/, "").replace(/^#+\s*/, "").trim();
    if (isListItem && current) claims.push(current);
    if (isListItem) current = line; else if (/^\s{2,}\S/.test(rawLine) && current) current += ` ${line}`; else if (line && RULES.some((rule) => rule.claim.test(line))) claims.push(line);
  }
  if (current) claims.push(current);
  return claims.filter((line) => line.length >= 4);
}

export function extractReadmeClaims(text: string): string[] {
  const withoutCodeBlocks = text.replace(/```[\s\S]*?```/g, "");
  const claims: string[] = [];
  let firstProseSeen = false;
  for (const rawLine of withoutCodeBlocks.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || /^#\s+/.test(trimmed)) continue;
    const isHeading = /^#{2,6}\s+/.test(trimmed);
    const isListItem = /^(?:[-*+] |\d+[.)]\s*)/.test(trimmed);
    const line = trimmed.replace(/^\s*(?:[-*+] |\d+[.)]\s*)/, "").replace(/^#{2,6}\s+/, "").trim();
    const isCommandInstruction = /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:install|test|build|dev|start)\b/i.test(line);
    const recognized = RULES.some((rule) => rule.claim.test(line));
    if (!firstProseSeen && !isHeading && !isListItem) {
      firstProseSeen = true;
      if (recognized && !isCommandInstruction) claims.push(line);
      continue;
    }
    if ((isHeading || isListItem) && recognized && !isCommandInstruction) claims.push(line);
  }
  return claims;
}

export function extractReadmeRequirements(text: string): ExtractedRequirement[] {
  const requirements: ExtractedRequirement[] = [];
  const requirementsById = new Map<string, ExtractedRequirement>();
  const requirementIdsByReference = new Map<string, string>();
  const declaredDowngrades: Array<{ downgrade: DeclaredDowngrade; references: string[] }> = [];
  let activeHeadingLevel: number | undefined;
  let fallbackId = 1;
  let inCodeBlock = false;

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    if (/^\s*(?:`{3,}|~{3,})/.test(rawLine)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const declaredDowngrade = parseNegativeStatusDeclaration(rawLine);
    if (declaredDowngrade) declaredDowngrades.push(declaredDowngrade);

    const heading = rawLine.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      const [, headingMarks, rawHeadingTitle] = heading;
      if (!headingMarks || !rawHeadingTitle) continue;
      const headingLevel = headingMarks.length;
      const headingTitle = rawHeadingTitle.replace(/\s+#+\s*$/, "").trim().toLowerCase();
      if (README_REQUIREMENT_HEADINGS.has(headingTitle)) {
        activeHeadingLevel = headingLevel;
      } else if (activeHeadingLevel !== undefined && headingLevel <= activeHeadingLevel) {
        activeHeadingLevel = undefined;
      }
      continue;
    }

    if (activeHeadingLevel === undefined) continue;
    const item = rawLine.match(/^\s*(?:(\d+)[.)]\s+|[-*+]\s+)(.+?)\s*$/);
    if (!item) continue;

    const requirementNumber = item[1];
    const rawClaim = item[2];
    if (!rawClaim) continue;
    const claim = rawClaim.replace(/^\[[ xX]\]\s*/, "").trim();
    const explicitRequirementId = claim.match(/^\[?([A-Z][A-Z0-9_-]*-\d+)\]?/i)?.[1];
    const requirementId = explicitRequirementId ?? `README-${fallbackId++}`;
    const requirement = {
      claim,
      requirementId,
      sourceLine: index + 1
    };
    requirements.push(requirement);
    requirementsById.set(requirementId, requirement);
    requirementIdsByReference.set(normalizeRequirementReference(requirementId), requirementId);
    if (requirementNumber) requirementIdsByReference.set(requirementNumber, requirementId);
  }

  for (const { downgrade, references } of declaredDowngrades) {
    for (const reference of references) {
      const requirementId = requirementIdsByReference.get(reference);
      const requirement = requirementId ? requirementsById.get(requirementId) : undefined;
      if (!requirement || requirement.declaredDowngrade === "missing") continue;
      requirement.declaredDowngrade = downgrade === "missing" ? "missing" : requirement.declaredDowngrade ?? downgrade;
    }
  }

  return requirements;
}

export function evaluateClaims(claims: string[], context: EvidenceContext): RequirementMatch[] {
  const matches: RequirementMatch[] = [];
  for (const [claimIndex, claim] of claims.entries()) {
    const requirementId = claim.match(/^\[?([A-Z][A-Z0-9_-]*-\d+)\]?/i)?.[1];
    const matchingRules = RULES.filter((candidate) => candidate.claim.test(claim));
    if (matchingRules.length === 0) {
      matches.push({ claim, concept: "unknown", status: "unverifiable", evidence: [], missingEvidence: ["No supported evidence rule"], ...(requirementId ? { requirementId } : {}), sourceLine: claimIndex + 1 });
      continue;
    }
    const negated = /\b(?:no|without|must not|do not|does not)\b/i.test(claim);
    for (const rule of matchingRules) {
    const evidence: string[] = [];
    const dependency = rule.dependency ? context.dependencies.find((item) => rule.dependency?.test(item)) : undefined;
    const file = rule.file ? context.files.find((item) => rule.file?.test(item)) : undefined;
    let sourceFile: string | undefined;
    if (rule.source) for (const [name, source] of context.sources) if (rule.source.test(source)) { sourceFile = name; break; }
    if (dependency) evidence.push(`dependency: ${dependency}`);
    if (file) evidence.push(`file: ${file}`);
    if (sourceFile) evidence.push(`source usage: ${sourceFile}`);
    const signals = { dependency: Boolean(dependency), file: Boolean(file), source: Boolean(sourceFile) };
    const missingEvidence = rule.required.filter(({ signal }) => !signals[signal]).map(({ label }) => label);
    const status: RequirementStatus = negated ? (evidence.length === 0 ? "satisfied" : "missing") : evidence.length === 0 ? "missing" : missingEvidence.length === 0 ? "satisfied" : "partially_satisfied";
      matches.push({ claim, concept: negated ? `${rule.concept}:forbidden` : rule.concept, status, evidence, missingEvidence: negated && evidence.length > 0 ? [`Forbidden ${rule.concept} evidence found`] : missingEvidence, ...(requirementId ? { requirementId } : {}), sourceLine: claimIndex + 1 });
    }
  }
  return matches;
}

export function normalizeMatches(matches: RequirementMatch[]): RequirementMatch[] {
  const dockerClaims = new Set(matches.filter((match) => match.concept === "docker").map((match) => match.claim));
  const filtered = matches.filter((match) => !(match.concept === "deployment" && dockerClaims.has(match.claim)));
  const result: RequirementMatch[] = [];
  const groups = new Map<string, RequirementMatch[]>();
  for (const match of filtered) {
    if (match.concept === "unknown") {
      result.push({ ...match, claims: match.claims ?? [match.claim] });
      continue;
    }
    const group = groups.get(match.concept) ?? [];
    group.push(match);
    groups.set(match.concept, group);
  }
  const rank = { missing: 0, partially_satisfied: 1, satisfied: 2, unverifiable: -1 } as const;
  for (const group of groups.values()) {
    const claims = [...new Set(group.flatMap((match) => match.claims ?? [match.claim]))];
    const status = group.reduce((best, match) => rank[match.status] > rank[best] ? match.status : best, group[0]?.status ?? "missing");
    const requirementId = group.find((match) => match.requirementId)?.requirementId;
    result.push({
      claim: claims[0] ?? "Unknown claim",
      claims,
      concept: group[0]?.concept ?? "unknown",
      status,
      evidence: [...new Set(group.flatMap((match) => match.evidence))],
      missingEvidence: status === "satisfied" ? [] : [...new Set(group.flatMap((match) => match.missingEvidence))],
      ...(requirementId ? { requirementId } : {}), ...(group[0]?.sourceLine ? { sourceLine: group[0].sourceLine } : {})
    });
  }
  return result;
}
