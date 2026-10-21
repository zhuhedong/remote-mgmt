// Fake DSH web: HTTP + WebSocket + an authenticatedUrl stub, with a Host
// allowlist read from cordis.patch.yml (like DSH's connection.trustedHosts).
import http from "node:http";
import { readFileSync } from "node:fs";
import { WebSocketServer } from "ws";
import crypto from "node:crypto";

export const LAUNCH_TOKEN = "LAUNCH-SECRET-" + crypto.randomBytes(6).toString("hex");
export const SESSION = "DSHSESS-" + crypto.randomBytes(6).toString("hex");
export const BIG = crypto.randomBytes(5 * 1024 * 1024);

export function startFakeDsh(patchFile) {
  const allowed = (host) => {
    const h = String(host || "").split(":")[0];
    if (h === "127.0.0.1" || h === "localhost") return true;
    try { return readFileSync(patchFile, "utf8").includes(`'${h}'`); } catch { return false; }
  };
  const cookie = (req) => /(?:^|;\s*)dsh_session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/auth") {
      if (u.searchParams.get("token") !== LAUNCH_TOKEN) { res.writeHead(403); return res.end("bad token"); }
      res.writeHead(303, { location: "/", "set-cookie": `dsh_session=${SESSION}; Path=/; HttpOnly; SameSite=Lax` });
      return res.end();
    }
    if (!allowed(req.headers.host)) { res.writeHead(403); return res.end("host not trusted"); }
    if (cookie(req) !== SESSION) { res.writeHead(401, { "content-type": "text/html" }); return res.end("dsh web authentication required"); }
    if (u.pathname === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(`DSH HOME host=${req.headers.host}`); }
    if (u.pathname === "/api/echo") {
      const names = (req.headers.cookie || "").split(";").map((s) => s.trim().split("=")[0]).filter(Boolean);
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ host: req.headers.host, cookies: names, xfp: req.headers["x-forwarded-proto"] || null }));
    }
    if (u.pathname === "/big") { res.writeHead(200, { "content-type": "application/octet-stream", "content-length": BIG.length }); return res.end(BIG); }
    if (u.pathname === "/upload" && req.method === "POST") {
      const h = crypto.createHash("sha256"); let n = 0;
      req.on("data", (c) => { h.update(c); n += c.length; });
      req.on("end", () => { res.writeHead(200); res.end(JSON.stringify({ n, sha: h.digest("hex") })); });
      return;
    }
    res.writeHead(404); res.end();
  });
  const wss = new WebSocketServer({ noServer: true });
  srv.on("upgrade", (req, sock, head) => {
    if (!allowed(req.headers.host) || cookie(req) !== SESSION) { sock.end("HTTP/1.1 403 Forbidden\r\n\r\n"); return; }
    wss.handleUpgrade(req, sock, head, (ws) => ws.on("message", (m) => ws.send("echo:" + m)));
  });
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r({ srv, port: srv.address().port })));
}

export const connectionStub = {
  authenticatedUrl: (u) => new URL("/auth?token=" + LAUNCH_TOKEN, u),
  requestRejection: () => undefined,
};
