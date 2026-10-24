import { redact } from "../redact.js";

export interface LogEntry {
  ts: number;
  text: string;
  source: string;
}

/** In-memory ring; all text is redacted on push. */
export class LogRing {
  private buf: LogEntry[] = [];
  constructor(private readonly max = 500) {}

  push(text: unknown, source = "agent"): void {
    const entry: LogEntry = { ts: Date.now(), text: redact(text), source: String(source || "agent") };
    this.buf.push(entry);
    if (this.buf.length > this.max) this.buf.splice(0, this.buf.length - this.max);
  }

  tail(n: number): LogEntry[] {
    const lines = Math.min(500, Math.max(1, Number.isFinite(Number(n)) ? Math.floor(Number(n)) : 100));
    return this.buf.slice(-lines).map((e) => ({ ...e }));
  }

  clear(): void {
    this.buf = [];
  }

  get size(): number {
    return this.buf.length;
  }
}

/** Clamp invoke params.lines → 1..500 (default 100). */
export function clampLogLines(params: Record<string, unknown> | undefined): number {
  const raw = params && params.lines !== undefined ? Number(params.lines) : 100;
  if (!Number.isFinite(raw)) return 100;
  return Math.min(500, Math.max(1, Math.floor(raw)));
}
