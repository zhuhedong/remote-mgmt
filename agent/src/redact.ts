const PATTERNS: RegExp[] = [
  /([?&](?:t|token|ticket|code|auth|key|sig)=)[^&\s"']+/gi,
  /\b(authorization|cookie|set-cookie)\s*[:=]\s*[^\n]+/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\b[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}\b/g,
];
const known = new Set<string>();
export function addSecret(s: string | undefined | null) { if (s && s.length >= 6) known.add(s); }
export function redact(input: unknown): string {
  let s = String(input instanceof Error ? input.message : input);
  for (const k of known) s = s.split(k).join("***");
  s = s.replace(PATTERNS[0], "$1***").replace(PATTERNS[1], "$1: ***").replace(PATTERNS[2], "***").replace(PATTERNS[3], "****-****-****");
  return s;
}
