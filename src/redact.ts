export function redactText(value: string): string {
  return value
    .replace(/\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*)\s*=\s*[^\s,;]+/gi, "$1=<REDACTED>")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <REDACTED>")
    .replace(/\bBasic\s+([A-Za-z0-9+/]+={0,2})/gi, (match, token: string) => {
      const decoded = Buffer.from(token, "base64").toString("utf8");
      return decoded.includes(":") ? "Basic <REDACTED>" : match;
    })
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/gi, "<HOME>")
    .replace(/\/home\/[^/\s]+/g, "<HOME>");
}
export function redactReport<T>(value: T): T { return visit(value) as T; }
function visit(value: unknown): unknown { if (typeof value === "string") return redactText(value); if (Array.isArray(value)) return value.map(visit); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)])); return value; }
