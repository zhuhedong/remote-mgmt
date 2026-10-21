import http from "node:http";
import https from "node:https";
import { execFile } from "node:child_process";
import { HttpsProxyAgent } from "https-proxy-agent";

/** Resolve the proxy to use: "direct", an explicit http(s) URL, or "system" (env, then macOS scutil). */
export async function resolveProxy(setting: string | undefined, target: string): Promise<string | null> {
  const s = (setting || "system").trim();
  if (s === "direct") return null;
  if (/^https?:\/\//.test(s)) return s;
  const host = new URL(target).hostname;
  if (host === "127.0.0.1" || host === "localhost" || host === "::1") return null;
  const np = process.env.NO_PROXY || process.env.no_proxy || "";
  if (np.split(",").map((x) => x.trim()).filter(Boolean).some((d) => d === "*" || host === d.replace(/^\./, "") || host.endsWith("." + d.replace(/^\./, "")))) return null;
  const env = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy;
  if (env && /^https?:\/\//.test(env)) return env;
  if (process.platform !== "darwin") return null;
  return new Promise((res) => execFile("/usr/sbin/scutil", ["--proxy"], { timeout: 3000 }, (e, out) => {
    const o = String(out || "");
    const en = /HTTPSEnable\s*:\s*1/.test(o), h = /HTTPSProxy\s*:\s*(\S+)/.exec(o), p = /HTTPSPort\s*:\s*(\d+)/.exec(o);
    res(!e && en && h && p ? `http://${h[1]}:${p[1]}` : null);
  }));
}

export function agentFor(proxy: string | null): http.Agent | undefined { return proxy ? (new HttpsProxyAgent(proxy) as any) : undefined; }

export function postJSON(url: string, body: unknown, agent?: http.Agent, timeout = 15000): Promise<{ status: number; json: any }> {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const data = Buffer.from(JSON.stringify(body));
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(u, { method: "POST", agent, timeout, headers: { "content-type": "application/json", "content-length": data.length } }, (r) => {
      const chunks: Buffer[] = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => { let j: any = {}; try { j = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch {} res({ status: r.statusCode || 0, json: j }); });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", rej);
    req.end(data);
  });
}
