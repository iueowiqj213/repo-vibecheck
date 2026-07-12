import type { RequirementMatch, RequirementStatus } from "./types.js";

export interface EvidenceContext { files: string[]; dependencies: string[]; sources: Map<string, string> }

type Concept = "authentication" | "payment" | "database" | "email" | "docker" | "tests" | "api" | "deployment";
type EvidenceSignal = "dependency" | "file" | "source";
interface Rule { concept: Concept; claim: RegExp; dependency?: RegExp; file?: RegExp; source?: RegExp; required: Array<{ signal: EvidenceSignal; label: string }> }

const RULES: Rule[] = [
  { concept: "authentication", claim: /\b(auth(?:entication)?|login|session)\b/i, dependency: /auth|passport|clerk/i, file: /auth|login|middleware|session/i, source: /getServerSession|signIn|authenticate|session/i, required: [{ signal: "file", label: "implementation file" }, { signal: "source", label: "auth source usage" }] },
  { concept: "payment", claim: /\b(stripe|payment|checkout)\b/i, dependency: /stripe/i, file: /checkout|payment|stripe|webhook/i, source: /checkout\.sessions\.create|paymentIntents\.create|webhooks\.constructEvent/i, required: [{ signal: "dependency", label: "payment dependency" }, { signal: "source", label: "server-side payment call" }] },
  { concept: "database", claim: /\b(database|prisma|supabase|firebase|db)\b/i, dependency: /prisma|supabase|firebase|mongoose|sequelize|drizzle/i, file: /prisma|schema|database|(?:^|\/)db\./i, source: /PrismaClient|createClient|mongoose\.connect/i, required: [{ signal: "dependency", label: "database dependency" }, { signal: "source", label: "database schema or client usage" }] },
  { concept: "email", claim: /\b(email|resend|sendgrid|nodemailer)\b/i, dependency: /resend|sendgrid|nodemailer/i, file: /email|mail/i, source: /\.send\(|sendMail|emails\.send/i, required: [{ signal: "dependency", label: "email provider dependency" }, { signal: "source", label: "email send call" }] },
  { concept: "docker", claim: /\b(docker|container)\b/i, file: /(^|\/)(Dockerfile|docker-compose\.ya?ml)$/i, required: [{ signal: "file", label: "Dockerfile or compose file" }] },
  { concept: "tests", claim: /\b(test(?:s|ing)?|vitest|jest)\b/i, dependency: /vitest|jest|mocha/i, file: /(?:test|spec)\.[cm]?[jt]sx?$/i, required: [{ signal: "file", label: "test files" }] },
  { concept: "api", claim: /\b(api|backend|server)\b/i, file: /app\/api|pages\/api|routes?|server/i, source: /router\.|app\.(get|post|put|delete)|export async function (GET|POST)/i, required: [{ signal: "source", label: "API route or server handler" }] },
  { concept: "deployment", claim: /\b(deploy(?:ment)?|vercel|hosting)\b/i, file: /vercel\.json|netlify\.toml|Dockerfile|\.github\/workflows/i, required: [{ signal: "file", label: "deployment configuration" }] }
];

export function extractClaims(text: string): string[] {
  return text.split(/\r?\n/).flatMap((rawLine) => {
    const isListItem = /^\s*(?:[-*+] |\d+[.)]\s*)/.test(rawLine);
    const line = rawLine.replace(/^\s*(?:[-*+] |\d+[.)]\s*)/, "").replace(/^#+\s*/, "").trim();
    return line.length >= 4 && (isListItem || RULES.some((rule) => rule.claim.test(line))) ? [line] : [];
  });
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

export function evaluateClaims(claims: string[], context: EvidenceContext): RequirementMatch[] {
  const matches: RequirementMatch[] = [];
  for (const claim of claims) {
    const matchingRules = RULES.filter((candidate) => candidate.claim.test(claim));
    if (matchingRules.length === 0) {
      matches.push({ claim, concept: "unknown", status: "unverifiable", evidence: [], missingEvidence: ["No supported evidence rule"] });
      continue;
    }
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
    const status: RequirementStatus = evidence.length === 0 ? "missing" : missingEvidence.length === 0 ? "satisfied" : "partially_satisfied";
      matches.push({ claim, concept: rule.concept, status, evidence, missingEvidence });
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
    result.push({
      claim: claims[0] ?? "Unknown claim",
      claims,
      concept: group[0]?.concept ?? "unknown",
      status,
      evidence: [...new Set(group.flatMap((match) => match.evidence))],
      missingEvidence: status === "satisfied" ? [] : [...new Set(group.flatMap((match) => match.missingEvidence))]
    });
  }
  return result;
}
