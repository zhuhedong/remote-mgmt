// Same control-route mechanism as dsh-cloudflare-tunnel 0.8.0 (lib/route.js).
const SEG = /^[A-Za-z0-9_$.-]+$/;
export function registerControlRoute(prefix: string, connection: any, webServer: any, handler: (ep: string, p: any) => Promise<any>) {
  if (webServer && typeof webServer.register === "function" && connection && typeof connection.requestRejection === "function") {
    return webServer.register({ kind: "prefix", path: prefix, handler: (req: any, res: any) => handle(prefix, connection, handler, req, res) });
  }
  if (connection && connection.rpc && typeof connection.rpc.handle === "function") return connection.rpc.handle(prefix, async (ep: string, p: any) => wrap(handler, ep, p), { authority: "loopback" });
  return undefined;
}
async function wrap(handler: any, ep: string, p: any) {
  try { return { ok: true, value: await handler(ep, p || {}) }; }
  catch (e: any) { return { ok: false, error: { code: "dsh-remote-agent/error", message: String((e && e.message) || e) } }; }
}
export async function handle(prefix: string, connection: any, handler: any, req: any, res: any) {
  const rej = connection.requestRejection(req);
  if (rej !== undefined) { res.writeHead(rej); res.end(rej === 401 ? "unauthorized" : "forbidden"); return; }
  const path = new URL(req.url || "/", "http://dsh.internal").pathname;
  const ep = path.startsWith(prefix + "/") ? path.slice(prefix.length + 1) : "";
  if (!ep || ep.split("/").some((s) => !SEG.test(s) || s === "." || s === "..")) return text(res, 404, "not found");
  if (req.method !== "POST") return text(res, 405, "method not allowed");
  const ct = String([].concat(req.headers["content-type"] || "")[0]).split(";")[0].trim().toLowerCase();
  if (ct !== "application/json") return text(res, 415, "content type must be application/json");
  let body: any;
  try { const chunks: Buffer[] = []; for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return text(res, 400, "body is not JSON"); }
  const rpcId = body && typeof body.rpcId === "string" ? body.rpcId : "invalid-request";
  if (!body || body.type !== "client-request" || typeof body.method !== "string" || body.method !== ep) {
    return json(res, { type: "server-response", rpcId, result: { ok: false, error: { code: "gateway/bad-request", message: "invalid client-request message", details: { issues: [] } } } });
  }
  json(res, { type: "server-response", rpcId, result: await wrap(handler, ep, body.payload) });
}
function json(res: any, body: unknown) { res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(body)); }
function text(res: any, code: number, s: string) { res.writeHead(code); res.end(s); }
