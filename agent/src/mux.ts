// Minimal yamux (hashicorp/yamux spec) client session over a message transport.
// Why hand-written: the protocol is small (12-byte header, 4 frame types), the
// hub uses Go's hashicorp/yamux, and this avoids pulling libp2p-sized deps into
// a plugin that must install offline. Spec: github.com/hashicorp/yamux/spec.md
import { Duplex } from "node:stream";
import { EventEmitter } from "node:events";

export const T_DATA = 0, T_WINDOW = 1, T_PING = 2, T_GOAWAY = 3;
export const F_SYN = 1, F_ACK = 2, F_FIN = 4, F_RST = 8;
export const INITIAL_WINDOW = 256 * 1024;
const MAX_CHUNK = 64 * 1024;

export function encodeHeader(type: number, flags: number, id: number, length: number): Buffer {
  const b = Buffer.alloc(12);
  b[0] = 0; b[1] = type; b.writeUInt16BE(flags, 2); b.writeUInt32BE(id >>> 0, 4); b.writeUInt32BE(length >>> 0, 8);
  return b;
}

export interface Transport { send(buf: Buffer): void; close(): void }

export class MuxStream extends Duplex {
  sendWindow = INITIAL_WINDOW;
  recvWindow = INITIAL_WINDOW;
  private unacked = 0;
  private queue: { buf: Buffer; cb: (e?: Error | null) => void }[] = [];
  private finalCb: ((e?: Error | null) => void) | null = null;
  localClosed = false; remoteClosed = false; reset = false;
  constructor(public session: MuxSession, public id: number) { super({ allowHalfOpen: true, highWaterMark: 64 * 1024 }); }

  _write(chunk: Buffer, _enc: string, cb: (e?: Error | null) => void) {
    if (this.reset) return cb(new Error("stream reset"));
    this.queue.push({ buf: Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk), cb });
    this.flush();
  }
  flush() {
    while (this.queue.length && this.sendWindow > 0 && !this.reset) {
      const q = this.queue[0];
      const n = Math.min(q.buf.length, this.sendWindow, MAX_CHUNK);
      this.session.frame(T_DATA, 0, this.id, q.buf.subarray(0, n));
      this.sendWindow -= n;
      if (n === q.buf.length) { this.queue.shift(); q.cb(); } else q.buf = q.buf.subarray(n);
    }
    if (!this.queue.length && this.finalCb) { const cb = this.finalCb; this.finalCb = null; this.sendFin(); cb(); }
  }
  private sendFin() {
    if (this.localClosed || this.reset) return;
    this.localClosed = true;
    this.session.frame(T_WINDOW, F_FIN, this.id);
    this.maybeGone();
  }
  _final(cb: (e?: Error | null) => void) { this.finalCb = cb; this.flush(); }
  _read() {
    if (this.unacked > 0 && !this.reset && !this.remoteClosed) {
      const d = this.unacked; this.unacked = 0; this.recvWindow += d;
      this.session.frame(T_WINDOW, 0, this.id, undefined, d);
    }
  }
  _destroy(err: Error | null, cb: (e?: Error | null) => void) {
    if (!this.reset && !(this.localClosed && this.remoteClosed)) { this.reset = true; this.session.frame(T_WINDOW, F_RST, this.id); }
    for (const q of this.queue) q.cb(new Error("stream destroyed"));
    this.queue = [];
    this.session.forget(this.id);
    cb(err);
  }
  onData(buf: Buffer) {
    if (buf.length > this.recvWindow) { this.session.protocolError("receive window exceeded"); return; }
    this.recvWindow -= buf.length; this.unacked += buf.length;
    if (!this.remoteClosed) this.push(buf);
  }
  onWindow(delta: number) { this.sendWindow += delta; this.flush(); }
  onFlags(flags: number) {
    if (flags & F_RST) { this.reset = true; this.remoteClosed = true; this.localClosed = true; this.destroy(); return; }
    if (flags & F_FIN) { if (!this.remoteClosed) { this.remoteClosed = true; this.push(null); } this.maybeGone(); }
  }
  private maybeGone() { if (this.localClosed && this.remoteClosed) this.session.forget(this.id); }
}

export class MuxSession extends EventEmitter {
  private streams = new Map<number, MuxStream>();
  private nextId = 1; // client: odd ids
  private buf: Buffer = Buffer.alloc(0);
  private pingId = 0;
  private pings = new Map<number, (rtt: number) => void>();
  closed = false;
  maxStreams = 256;
  constructor(private t: Transport) { super(); }

  frame(type: number, flags: number, id: number, payload?: Buffer, length?: number) {
    if (this.closed) return;
    const len = payload ? payload.length : (length || 0);
    const h = encodeHeader(type, flags, id, len);
    this.t.send(payload && payload.length ? Buffer.concat([h, payload]) : h);
  }

  open(): MuxStream {
    if (this.closed) throw new Error("session closed");
    const id = this.nextId; this.nextId += 2;
    const s = new MuxStream(this, id);
    this.streams.set(id, s);
    this.frame(T_WINDOW, F_SYN, id, undefined, 0);
    return s;
  }

  ping(timeoutMs = 45000): Promise<number> {
    const id = ++this.pingId >>> 0; const start = Date.now();
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pings.delete(id); rej(new Error("ping timeout")); }, timeoutMs);
      t.unref?.();
      this.pings.set(id, () => { clearTimeout(t); res(Date.now() - start); });
      this.frame(T_PING, F_SYN, 0, undefined, id);
    });
  }

  forget(id: number) { this.streams.delete(id); }
  get streamCount() { return this.streams.size; }

  feed(chunk: Buffer) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 12 && !this.closed) {
      const ver = this.buf[0], type = this.buf[1], flags = this.buf.readUInt16BE(2), id = this.buf.readUInt32BE(4), len = this.buf.readUInt32BE(8);
      if (ver !== 0) return this.protocolError("bad version");
      const need = type === T_DATA ? 12 + len : 12;
      if (type === T_DATA && len > INITIAL_WINDOW * 4) return this.protocolError("frame too large");
      if (this.buf.length < need) return;
      const payload = type === T_DATA ? this.buf.subarray(12, need) : null;
      this.buf = this.buf.subarray(need);
      this.handle(type, flags, id, len, payload);
    }
  }

  private handle(type: number, flags: number, id: number, len: number, payload: Buffer | null) {
    if (type === T_PING) {
      if (flags & F_SYN) this.frame(T_PING, F_ACK, 0, undefined, len);
      else if (flags & F_ACK) { const cb = this.pings.get(len); if (cb) { this.pings.delete(len); cb(0); } }
      return;
    }
    if (type === T_GOAWAY) { this.close(new Error("remote goaway")); return; }
    if (type !== T_DATA && type !== T_WINDOW) return this.protocolError("bad type");
    let s = this.streams.get(id);
    if (flags & F_SYN) {
      if (s || id % 2 === 1) return this.protocolError("bad SYN");
      if (this.streams.size >= this.maxStreams) { this.frame(T_WINDOW, F_RST, id); return; }
      s = new MuxStream(this, id);
      this.streams.set(id, s);
      this.frame(T_WINDOW, F_ACK, id, undefined, 0);
      this.emit("stream", s);
    }
    if (!s) return; // late frame for a closed stream
    if (type === T_WINDOW) s.onWindow(len);
    else if (payload && payload.length) s.onData(Buffer.from(payload));
    s.onFlags(flags);
  }

  protocolError(msg: string) { this.close(new Error("yamux: " + msg)); }

  close(err?: Error) {
    if (this.closed) return;
    try { this.frame(T_GOAWAY, 0, 0, undefined, err ? 1 : 0); } catch {}
    this.closed = true;
    for (const s of [...this.streams.values()]) { s.reset = true; s.destroy(); }
    this.streams.clear();
    for (const cb of this.pings.values()) void cb;
    this.pings.clear();
    try { this.t.close(); } catch {}
    this.emit("close", err);
  }
}
