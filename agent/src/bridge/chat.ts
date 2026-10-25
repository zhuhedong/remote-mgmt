/**
 * A1 chat/models adapters over the in-process DSH `sessionController` (Typert `session.*`).
 * Streaming model: a per-session in-process follower (sessionController.follow with
 * assistantStream) folds frames into a small state; the App long-polls `chat.follow`
 * with the last `version` it saw. No public HTTP, no mux.
 */
import { randomUUID } from "node:crypto";
import { homedir as osHomedir } from "node:os";
import path from "node:path";

export interface AskOption {
  label: string;
  description?: string;
}

export interface AskQuestion {
  id: string;
  question: string;
  header?: string;
  options?: AskOption[];
  multiSelect?: boolean;
}

/** Structured ask_user_question payload for mobile UI. */
export interface AskPayload {
  callId: string;
  questions: AskQuestion[];
}

export interface ChatMessage {
  seq: number;
  role: "user" | "assistant" | "step";
  text: string;
  /** step: tool name; status running|done|error */
  name?: string;
  status?: "running" | "done" | "error";
  callId?: string;
  time?: number;
  /** When name is ask_user_question, parsed arguments for native UI. */
  ask?: AskPayload;
}

export interface AskAnswerItem {
  id: string;
  selected: string[];
  custom?: string;
}

export interface FollowState {
  sessionId: string;
  version: number;
  cursor: number;
  messages: ChatMessage[];
  live: string;
  running: boolean;
  error: string | null;
  /** Active ask_user_question waiting for a mobile answer (mirrors waterfall park). */
  pendingAsk: AskPayload | null;
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

/**
 * Expand `~` / resolve a session cwd before handing it to DSH.
 * DSH `mkdir(cwd)` does NOT expand tilde; relative paths fall back to process.cwd().
 * Exported for unit tests (inject home/cwd).
 */
export function resolveSessionCwd(
  raw: string,
  home: string = osHomedir(),
  baseCwd: string = process.cwd(),
): string {
  const s = String(raw ?? "").trim();
  if (!s) fail("VALIDATION", "cwd 不能为空");
  let expanded: string;
  if (s === "~") expanded = home;
  else if (s.startsWith("~/") || s.startsWith("~\\")) expanded = path.join(home, s.slice(2));
  else expanded = s;
  if (!path.isAbsolute(expanded)) expanded = path.resolve(baseCwd, expanded);
  // Normalize trailing separators away except root
  const norm = path.normalize(expanded);
  return norm.length > 1 && (norm.endsWith("/") || norm.endsWith("\\")) ? norm.replace(/[\\/]+$/, "") : norm;
}

/** Visible text only: string or `type===text|undefined` parts. Drops thinking/reasoning/tool blobs. */
export function textOf(content: any): string {
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


/** Parse ask_user_question tool arguments into a stable AskPayload. */
export function parseAskArguments(callId: string, raw: unknown): AskPayload | undefined {
  let args: any = raw;
  if (typeof args === "string") {
    try { args = JSON.parse(args); } catch { return undefined; }
  }
  if (!args || typeof args !== "object") return undefined;
  const list = Array.isArray(args.questions) ? args.questions : null;
  if (!list || list.length === 0) return undefined;
  const questions: AskQuestion[] = [];
  for (const q of list) {
    if (!q || typeof q !== "object") continue;
    const id = typeof q.id === "string" ? q.id : "";
    const question = typeof q.question === "string" ? q.question : "";
    if (!id || !question) continue;
    const options = Array.isArray(q.options)
      ? q.options.map((o: any) => ({
          label: String(o?.label ?? ""),
          ...(typeof o?.description === "string" ? { description: o.description } : {}),
        })).filter((o: AskOption) => o.label)
      : undefined;
    questions.push({
      id,
      question,
      ...(typeof q.header === "string" ? { header: q.header } : {}),
      ...(options && options.length ? { options } : {}),
      ...((q.multi_select === true || q.multiSelect === true) ? { multiSelect: true } : {}),
    });
  }
  if (!questions.length) return undefined;
  return { callId: callId || "unknown", questions };
}

/** Fold one durable Session wire event into the message list. Exported for tests. */
export function applyEvent(msgs: ChatMessage[], ev: any): boolean {
  if (!ev || typeof ev.type !== "string") return false;
  // DSH marks some external/system events ignorable — never surface them in the chat UI.
  if (ev.ignorable === true) return false;
  const d = ev.data ?? ev;
  const seq = Number(ev.seq) || 0;
  const time = typeof ev.time === "number" ? ev.time : undefined;
  switch (ev.type) {
    case "user/message": {
      // Mirror DSH list.js lastPromptAt filter: only human-authored prompts.
      if (d?.source?.kind !== "user") return false;
      const t = textOf(d.content ?? d.message?.content);
      if (!t.trim()) return false;
      msgs.push({ seq, role: "user", text: t, time });
      return true;
    }
    case "assistant/message": {
      const t = textOf(d.message?.content ?? d.content);
      if (t.trim()) msgs.push({ seq, role: "assistant", text: t, time });
      return true;
    }
    case "system/message":
    case "developer/message":
      return false;
    case "tool/call": {
      const name = String(d.name || "tool");
      const callId = typeof d.callId === "string" ? d.callId : undefined;
      const ask = name === "ask_user_question" || name === "request_user_input"
        ? parseAskArguments(callId || `seq-${seq}`, d.arguments ?? d.input ?? d.params)
        : undefined;
      msgs.push({
        seq, role: "step",
        text: ask ? (ask.questions[0]?.header || ask.questions[0]?.question || name) : name,
        name, status: "running", callId, time,
        ...(ask ? { ask } : {}),
      });
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
    this.state = { sessionId, version: 0, cursor: -1, messages: [], live: "", running: false, error: null, pendingAsk: null };
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
          this.syncPendingAskFromMessages();
          this.bump();
        } else if (f.type === "event") {
          const ev = f.event;
          applyEvent(this.state.messages, ev);
          this.state.cursor = Number(ev?.seq) || this.state.cursor;
          if (ev?.type === "assistant/message") this.state.live = "";
          if (ev?.type === "turn/start") this.state.running = true;
          if (ev?.type === "turn/end" || ev?.type === "agent/idle") { this.state.running = false; this.state.live = ""; }
          if (ev?.type === "tool/call" || ev?.type === "tool/result") this.syncPendingAskFromMessages();
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

  setPendingAsk(ask: AskPayload | null) {
    const prev = this.state.pendingAsk?.callId;
    const next = ask?.callId;
    if (prev === next && (ask == null) === (this.state.pendingAsk == null)) return;
    this.state.pendingAsk = ask;
    this.bump();
  }

  clearPendingAsk(callId?: string) {
    if (!this.state.pendingAsk) return;
    if (callId && this.state.pendingAsk.callId !== callId) return;
    this.state.pendingAsk = null;
    this.bump();
  }

  /** Refresh pendingAsk from the latest running ask_user_question step. */
  syncPendingAskFromMessages() {
    let found: AskPayload | undefined;
    for (let i = this.state.messages.length - 1; i >= 0; i--) {
      const m = this.state.messages[i];
      if (m.role === "step" && m.status === "running" && m.ask) { found = m.ask; break; }
    }
    const cur = this.state.pendingAsk;
    if ((found?.callId || null) === (cur?.callId || null) && Boolean(found) === Boolean(cur)) return;
    this.state.pendingAsk = found ?? null;
    // bump called by caller after applyEvent
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
    const workspaceId = typeof params.workspaceId === "string" ? params.workspaceId.trim() : "";
    const hasCwd = typeof params.cwd === "string";
    const cwdRaw = hasCwd ? params.cwd : "";
    if (workspaceId && hasCwd && cwdRaw.trim()) fail("VALIDATION", "workspaceId 与 cwd 不能同时指定");
    if (workspaceId) {
      req.workspaceId = workspaceId;
    } else if (hasCwd) {
      // Explicit empty string is a client bug; omitting cwd is fine (DSH defaultCwd).
      if (!cwdRaw.trim()) fail("VALIDATION", "cwd 不能为空");
      req.cwd = resolveSessionCwd(cwdRaw);
    }
    // else: omit both → DSH uses defaultCwd
    const r = unwrap(await this.ctl().create(req));
    const sessionId = r?.sessionId ?? r?.session?.id ?? r?.id;
    if (!sessionId) fail("DSH_ERROR", "create 未返回 sessionId");
    let cwd: string | null = req.cwd ?? null;
    try {
      const list = unwrap(await this.ctl().list({}, this.sig(10_000)));
      const item = (list?.items || []).find((it: any) => it.sessionId === sessionId);
      if (item && typeof item.cwd === "string" && item.cwd) cwd = item.cwd;
    } catch { /* keep resolved cwd */ }
    return { sessionId, cwd, agentPreset: r?.agentPreset ?? null };
  }

  async sessionRename(params: Record<string, unknown>): Promise<unknown> {
    const sessionId = reqSession(params);
    const title = typeof params.title === "string" ? params.title.trim() : "";
    if (!title) fail("BAD_REQUEST", "title 不能为空");
    unwrap(await this.ctl().rename({ sessionId, title }));
    return { sessionId, title };
  }

  async sessionDelete(params: Record<string, unknown>): Promise<unknown> {
    const sessionId = reqSession(params);
    this.followers.get(sessionId)?.close();
    this.followers.delete(sessionId);
    unwrap(await this.ctl().delete({ sessionId }));
    return { sessionId, deleted: true };
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

  private parks = new Map<string, {
    callId: string;
    questions: AskQuestion[];
    resolve: (v: { answers: AskAnswerItem[] }) => void;
    reject: (e: unknown) => void;
    cleanup: () => void;
  }>();

  /**
   * Host waterfall handler: race Desktop Web UI (next) with a remote park so the
   * phone can answer ask_user_question. First successful answer wins.
   */
  raceUserQuestion(request: any, next: () => any): Promise<{ answers: AskAnswerItem[] }> {
    const callId = typeof request?.wait?.callId === "string" && request.wait.callId
      ? request.wait.callId
      : randomUUID();
    const questions = Array.isArray(request?.questions) ? request.questions : [];
    const park = this.parkAsk(callId, questions, request?.signal);

    let desktop: Promise<any>;
    try {
      desktop = Promise.resolve(next());
    } catch (e) {
      return park;
    }

    return new Promise((resolve, reject) => {
      let done = false;
      const win = (value: any, from: "remote" | "desktop") => {
        if (done) return;
        done = true;
        if (from === "desktop") this.dropPark(callId);
        resolve(value);
      };
      park.then((v) => win(v, "remote"), (err: any) => {
        if (done) return;
        if (err && err.code === "SUPERSEDED") return;
        // park aborted — wait for desktop unless already done
        desktop.then((v) => win(v, "desktop"), reject);
      });
      desktop.then((v) => win(v, "desktop"), (_err) => {
        // Desktop declined (NO_PROVIDER / no session) — remote only
        if (done) return;
        park.then((v) => win(v, "remote"), reject);
      });
    });
  }

  private parkAsk(callId: string, questions: AskQuestion[], signal?: AbortSignal): Promise<{ answers: AskAnswerItem[] }> {
    this.dropPark(callId);
    const ask: AskPayload = {
      callId,
      questions: questions.map((q: any) => ({
        id: String(q.id),
        question: String(q.question ?? ""),
        ...(typeof q.header === "string" ? { header: q.header } : {}),
        ...(Array.isArray(q.options) ? {
          options: q.options.map((o: any) => ({
            label: String(o?.label ?? ""),
            ...(typeof o?.description === "string" ? { description: o.description } : {}),
          })).filter((o: AskOption) => o.label),
        } : {}),
        ...((q.multiSelect === true || q.multi_select === true) ? { multiSelect: true } : {}),
      })),
    };
    // Surface on every active follower so the phone UI can render without waiting for tool/call parse.
    for (const f of this.followers.values()) {
      if (!f.closed) f.setPendingAsk(ask);
    }
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        signal?.removeEventListener?.("abort", onAbort);
        this.parks.delete(callId);
      };
      const onAbort = () => {
        cleanup();
        for (const f of this.followers.values()) f.clearPendingAsk(callId);
        reject(Object.assign(new Error("ask aborted"), { code: "ABORTED" }));
      };
      if (signal?.aborted) { onAbort(); return; }
      signal?.addEventListener?.("abort", onAbort);
      this.parks.set(callId, {
        callId,
        questions: ask.questions,
        resolve: (v) => { cleanup(); for (const f of this.followers.values()) f.clearPendingAsk(callId); resolve(v); },
        reject: (e) => { cleanup(); for (const f of this.followers.values()) f.clearPendingAsk(callId); reject(e); },
        cleanup,
      });
    });
  }

  dropPark(callId?: string) {
    if (!callId) return;
    const p = this.parks.get(callId);
    if (!p) return;
    // Resolve as superseded so raceUserQuestion's park branch does not hang.
    try { p.reject(Object.assign(new Error("superseded"), { code: "SUPERSEDED" })); } catch {}
    p.cleanup();
    this.parks.delete(callId);
    for (const f of this.followers.values()) f.clearPendingAsk(callId);
  }

  /** App submits answers for a parked ask_user_question. */
  async answerAsk(params: Record<string, unknown>): Promise<unknown> {
    const callId = typeof params.callId === "string" ? params.callId : "";
    if (!callId) fail("VALIDATION", "callId required");
    const raw = params.answers;
    if (!Array.isArray(raw) || raw.length === 0) fail("VALIDATION", "answers required");
    const answers: AskAnswerItem[] = [];
    for (const a of raw) {
      if (!a || typeof a !== "object") continue;
      const id = typeof (a as any).id === "string" ? (a as any).id : "";
      const selected = Array.isArray((a as any).selected)
        ? (a as any).selected.filter((x: unknown) => typeof x === "string")
        : [];
      if (!id) continue;
      const item: AskAnswerItem = { id, selected };
      if (typeof (a as any).custom === "string" && (a as any).custom.trim()) item.custom = String((a as any).custom);
      answers.push(item);
    }
    if (!answers.length) fail("VALIDATION", "answers required");
    const park = this.parks.get(callId);
    if (park) {
      park.resolve({ answers });
      return { ok: true, callId, via: "waterfall" };
    }
    // No live park: try continued answer via injected userQuestions (timed mode after timeout).
    const uq = this.userQuestions?.();
    const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
    if (uq && typeof uq.answer === "function" && sessionId) {
      try {
        const agent = typeof uq.agentOf === "function" ? uq.agentOf(sessionId) : sessionId;
        unwrap(await uq.answer(agent, callId, { answers }));
        for (const f of this.followers.values()) f.clearPendingAsk(callId);
        return { ok: true, callId, via: "continued" };
      } catch (e: any) {
        fail(e?.code || "DSH_ERROR", e?.message || "userQuestions.answer failed");
      }
    }
    fail("NOT_FOUND", "没有等待中的提问（callId 无效或已结束）");
  }

  private userQuestions: (() => any | null) | null = null;

  /** Optional: wire ctx.userQuestions for continued (timed) answers. */
  setUserQuestions(getter: () => any | null) { this.userQuestions = getter; }

  dispose() {
    for (const p of this.parks.values()) {
      try { p.reject(Object.assign(new Error("disposed"), { code: "ABORTED" })); } catch {}
    }
    this.parks.clear();
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
