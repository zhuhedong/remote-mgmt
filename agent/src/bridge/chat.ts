/**
 * A1 chat/models adapters over the in-process DSH `sessionController` (Typert `session.*`).
 * Streaming model: a per-session in-process follower (sessionController.follow with
 * assistantStream) folds frames into a small state; the App long-polls `chat.follow`
 * with the last `version` it saw. No public HTTP, no mux.
 */
import { randomUUID } from "node:crypto";

export interface ChatMessage {
  seq: number;
  role: "user" | "assistant" | "step";
  text: string;
  /** step: tool name; status running|done|error */
  name?: string;
  status?: "running" | "done" | "error";
  callId?: string;
  time?: number;
}

export interface FollowState {
  sessionId: string;
  version: number;
  cursor: number;
  messages: ChatMessage[];
  live: string;
  running: boolean;
  error: string | null;
}

function fail(code: string, message: string): never {
  const e: any = new Error(message);
  e.code = code;
  throw e;
}

/** Host methods may return raw values or Typert `{ok,value|error}` envelopes. */
export function unwrap(v: any): any {
  if (v && typeof v === "object" && typeof v.ok === "boolean" && ("value" in v || "error" in v)) {
    if (v.ok) return v.value;
    const err = v.error || {};
    fail(String(err.code || "DSH_ERROR"), String(err.message || "dsh error"));
  }
  return v;
}

function textOf(content: any): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((p: any) => p && (p.type === "text" || p.type === undefined) && typeof p.text === "string")
    .map((p: any) => p.text)
    .join("");
}

function basename(p: string): string {
  const s = String(p || "").replace(/[\\/]+$/, "");
  const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
  return i >= 0 ? s.slice(i + 1) : s;
}

const MAX_MESSAGES = 80;

/** Fold one durable Session wire event into the message list. Exported for tests. */
export function applyEvent(msgs: ChatMessage[], ev: any): boolean {
  if (!ev || typeof ev.type !== "string") return false;
  const d = ev.data ?? ev;
  const seq = Number(ev.seq) || 0;
  const time = typeof ev.time === "number" ? ev.time : undefined;
  switch (ev.type) {
    case "user/message": {
      const t = textOf(d.content ?? d.message?.content);
      msgs.push({ seq, role: "user", text: t, time });
      return true;
    }
    case "assistant/message": {
      const t = textOf(d.message?.content ?? d.content);
      if (t.trim()) msgs.push({ seq, role: "assistant", text: t, time });
      return true;
    }
    case "tool/call": {
      msgs.push({ seq, role: "step", text: String(d.name || "tool"), name: String(d.name || "tool"), status: "running", callId: d.callId, time });
      return true;
    }
    case "tool/result": {
      const callId = d.message?.callId ?? d.message?.toolCallId ?? d.callId;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.role === "step" && m.status === "running" && (callId === undefined || m.callId === callId)) {
          m.status = d.error ? "error" : "done";
          break;
        }
      }
      return true;
    }
    default:
      return false;
  }
}

/** Extract visible text from an assistant-stream frame chunk (text-delta only). */
export function chunkText(frame: any): string {
  const c = frame && frame.chunk;
  if (!c) return "";
  if (c.type === "text-delta" && typeof c.text === "string") return c.text;
  return "";
}

class Follower {
  state: FollowState;
  private abort = new AbortController();
  private waiters: Array<() => void> = [];
  lastPoll = Date.now();
  closed = false;

  constructor(private ctl: any, sessionId: string, private onClose: () => void) {
    this.state = { sessionId, version: 0, cursor: -1, messages: [], live: "", running: false, error: null };
    void this.run();
  }

  private bump() {
    this.state.version++;
    if (this.state.messages.length > MAX_MESSAGES) this.state.messages.splice(0, this.state.messages.length - MAX_MESSAGES);
    const w = this.waiters; this.waiters = [];
    for (const f of w) f();
  }

  wait(ms: number): Promise<void> {
    return new Promise((r) => {
      const t = setTimeout(() => { this.waiters = this.waiters.filter((x) => x !== done); r(); }, ms);
      const done = () => { clearTimeout(t); r(); };
      this.waiters.push(done);
    });
  }

  markRunning(v: boolean) { this.state.running = v; this.bump(); }

  private async run() {
    try {
      const it = this.ctl.follow(
        { address: { kind: "session", sessionId: this.state.sessionId }, maxMessages: 60, assistantStream: true },
        this.abort.signal,
      );
      for await (const raw of it as AsyncIterable<any>) {
        const f = unwrap(raw);
        if (!f) continue;
        if (f.type === "snapshot") {
          this.state.messages = [];
          for (const r of f.records || []) if (r && r.type === "event") applyEvent(this.state.messages, r.event);
          this.state.cursor = Number(f.cursor) || 0;
          const active = f.assistantStream && f.assistantStream.activeAttempt;
          this.state.live = active ? (active.stream?.text ?? "") : "";
          this.state.running = Boolean(active);
          this.bump();
        } else if (f.type === "event") {
          const ev = f.event;
          applyEvent(this.state.messages, ev);
          this.state.cursor = Number(ev?.seq) || this.state.cursor;
          if (ev?.type === "assistant/message") this.state.live = "";
          if (ev?.type === "turn/start") this.state.running = true;
          if (ev?.type === "turn/end" || ev?.type === "agent/idle") { this.state.running = false; this.state.live = ""; }
          this.bump();
        } else if (f.type === "assistant-stream") {
          const fr = f.frame || {};
          if (fr.type === "start") { this.state.live = ""; this.state.running = true; }
          const t = chunkText(fr);
          if (t) this.state.live += t;
          this.bump();
        }
      }
    } catch (e: any) {
      if (!this.abort.signal.aborted) { this.state.error = e?.message ? String(e.message) : "follow failed"; this.bump(); }
    } finally {
      this.closed = true;
      this.onClose();
    }
  }

  close() { this.abort.abort(); this.closed = true; this.bump(); }
}

export class ChatBridge {
  private followers = new Map<string, Follower>();
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor(private controller: () => any | null, private idleMs = 120_000) {}

  available(): boolean {
    const c = this.controller();
    return Boolean(c && typeof c.list === "function" && typeof c.prompt === "function" && typeof c.modelCatalog === "function");
  }

  private ctl(): any {
    const c = this.controller();
    if (!c) fail("UNAVAILABLE", "DSH sessionController 不可用（需 DSH Desktop 0.2.x）");
    return c;
  }

  private sig(ms = 30_000): AbortSignal {
    return AbortSignal.timeout(ms);
  }

  async sessionsList(): Promise<unknown> {
    const r = unwrap(await this.ctl().list({}, this.sig()));
    const items = (r && Array.isArray(r.items) ? r.items : []).filter((it: any) => !it.parentSessionId);
    const sessions = items.map((it: any) => {
      const v = it.projections?.values || {};
      const title = typeof v.title === "string" ? v.title : typeof v.sessionTitle?.title === "string" ? v.sessionTitle.title : null;
      return {
        sessionId: it.sessionId,
        title,
        cwd: it.cwd ?? null,
        space: it.cwd ? basename(it.cwd) : null,
        updatedAt: it.updatedAt ?? null,
        running: Boolean(it.running),
        blank: Boolean(it.blank),
      };
    });
    const spaces: Record<string, { name: string; cwd: string; count: number }> = {};
    for (const s of sessions) if (s.cwd) (spaces[s.cwd] ??= { name: s.space, cwd: s.cwd, count: 0 }).count++;
    return { sessions, spaces: Object.values(spaces) };
  }

  async sessionCreate(params: Record<string, unknown>): Promise<unknown> {
    const req: any = {};
    if (typeof params.cwd === "string" && params.cwd) req.cwd = params.cwd;
    const r = unwrap(await this.ctl().create(req));
    const sessionId = r?.sessionId ?? r?.session?.id ?? r?.id;
    if (!sessionId) fail("DSH_ERROR", "create 未返回 sessionId");
    return { sessionId, agentPreset: r?.agentPreset ?? null };
  }

  async history(params: Record<string, unknown>): Promise<unknown> {
    const sessionId = reqSession(params);
    const max = Math.min(Math.max(Number(params.maxMessages) || 50, 1), 200);
    const req: any = { address: { kind: "session", sessionId }, maxMessages: max };
    if (Number.isSafeInteger(params.beforeSeq)) req.beforeSeq = params.beforeSeq;
    const r = unwrap(await this.ctl().page(req, this.sig()));
    const messages: ChatMessage[] = [];
    for (const rec of r?.records || []) if (rec && rec.type === "event") applyEvent(messages, rec.event);
    return { sessionId, messages, hasMore: Boolean(r?.hasMore) };
  }

  private follower(sessionId: string): Follower {
    let f = this.followers.get(sessionId);
    if (!f || f.closed) {
      f = new Follower(this.ctl(), sessionId, () => { if (this.followers.get(sessionId) === f) this.followers.delete(sessionId); });
      this.followers.set(sessionId, f);
      this.ensureSweeper();
    }
    f.lastPoll = Date.now();
    return f;
  }

  private ensureSweeper() {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      const now = Date.now();
      for (const [id, f] of this.followers) if (now - f.lastPoll > this.idleMs) { f.close(); this.followers.delete(id); }
      if (this.followers.size === 0 && this.sweeper) { clearInterval(this.sweeper); this.sweeper = null; }
    }, 15_000);
    (this.sweeper as any).unref?.();
  }

  async prompt(params: Record<string, unknown>): Promise<unknown> {
    const sessionId = reqSession(params);
    const text = typeof params.text === "string" ? params.text : "";
    if (!text.trim()) fail("VALIDATION", "text required");
    if (text.length > 20_000) fail("VALIDATION", "text too long");
    const f = this.follower(sessionId);
    const requestId = typeof params.clientRequestId === "string" && params.clientRequestId ? params.clientRequestId : randomUUID();
    const req: any = { requestId, sessionId, mode: params.mode === "steer" ? "steer" : "followup", content: [{ type: "text", text }] };
    const r = unwrap(await this.ctl().prompt(req, this.sig()));
    f.markRunning(true);
    return { accepted: r?.accepted !== false, requestId, version: f.state.version };
  }

  /** Long-poll: returns immediately if version differs, else waits up to waitMs for a change. */
  async follow(params: Record<string, unknown>): Promise<FollowState & { unchanged?: boolean }> {
    const sessionId = reqSession(params);
    const since = Number.isSafeInteger(params.version) ? Number(params.version) : -1;
    const waitMs = Math.min(Math.max(Number(params.waitMs) || 0, 0), 20_000);
    const f = this.follower(sessionId);
    if (f.state.version === since && waitMs > 0) await f.wait(waitMs);
    if (f.state.version === since) return { ...f.state, messages: [], unchanged: true };
    return { ...f.state, messages: f.state.messages.map((m) => ({ ...m })) };
  }

  async cancel(params: Record<string, unknown>): Promise<unknown> {
    const sessionId = reqSession(params);
    unwrap(await this.ctl().cancel({ sessionId }));
    return { cancelled: true };
  }

  async modelsList(params: Record<string, unknown>): Promise<unknown> {
    const cat = unwrap(await this.ctl().modelCatalog());
    let current: any = cat?.default ?? null;
    const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
    if (sessionId && typeof this.ctl().projections === "function") {
      try {
        const p = unwrap(await this.ctl().projections({ sessionId }, this.sig(10_000)));
        const ms = p?.values?.modelSelection;
        const sel = ms?.next ?? ms?.pending ?? ms?.lastUsed;
        if (sel && sel.provider && sel.model) current = sel;
      } catch { /* fall back to default */ }
    }
    const groups = (cat?.groups || []).map((g: any) => ({
      id: g.id, name: g.name ?? g.id,
      models: (g.models || []).map((m: any) => ({
        id: m.id, name: m.name ?? m.displayName ?? m.id,
        reasoning: m.reasoning ? { efforts: (m.reasoning.efforts || []).map((e: any) => e.id ?? e), defaultEffort: m.reasoning.defaultEffort ?? null } : null,
      })),
    }));
    return { current, default: cat?.default ?? null, groups, failures: cat?.failures ?? [] };
  }

  async modelsSelect(params: Record<string, unknown>): Promise<unknown> {
    const sessionId = reqSession(params);
    const provider = typeof params.provider === "string" ? params.provider : "";
    const model = typeof params.model === "string" ? params.model : "";
    if (!provider || !model) fail("VALIDATION", "provider and model required");
    const req: any = { sessionId, provider, model };
    if (typeof params.reasoningEffort === "string" && params.reasoningEffort) req.reasoningEffort = params.reasoningEffort;
    const r = unwrap(await this.ctl().selectModel(req));
    return { selection: r ?? { provider, model } };
  }

  dispose() {
    for (const f of this.followers.values()) f.close();
    this.followers.clear();
    if (this.sweeper) { clearInterval(this.sweeper); this.sweeper = null; }
  }
}

function reqSession(params: Record<string, unknown>): string {
  const s = params.sessionId;
  if (typeof s !== "string" || !s || s.length > 200) fail("VALIDATION", "sessionId required");
  return s;
}
