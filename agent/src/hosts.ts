// Maintain DSH's /api host allowlist (connection.trustedHosts) in
// profiles/web/cordis.patch.yml. Only touches hosts this plugin manages; keeps
// user entries and the `...ctx.webStartup.trustedHosts` spread.
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";

const CONN = "@deepseek-ai/dsh-client-connection";
const SPREAD = "...ctx.webStartup.trustedHosts";
const HOST_RE = /^[a-z0-9.-]+$/;

export interface HostsResult { changed: boolean; hosts: string[]; manual?: string; backup?: string }

function parseList(expr: string): string[] | null {
  const m = /^\s*\[(.*)\]\s*$/s.exec(expr);
  if (!m) return null;
  const items: string[] = [];
  for (const raw of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
    const q = /^(['"])(.*)\1$/.exec(raw);
    if (q) items.push(q[2]); else if (raw === SPREAD) items.push(SPREAD); else return null;
  }
  return items;
}
function render(items: string[]): string {
  return `!!js "[${items.map((h) => (h === SPREAD ? SPREAD : `'${h}'`)).join(", ")}]"`;
}

/** Compute new file text. desired = hosts we want present; managed = all hosts we own (may remove those not desired). */
export function applyHosts(text: string, desired: string[], managed: string[]): { text: string; hosts: string[] } | { error: string } {
  for (const h of [...desired, ...managed]) if (!HOST_RE.test(h)) return { error: "invalid host " + h };
  const lines = text.split("\n");
  const nameIdx = lines.findIndex((l) => l.includes(CONN) && /^\s+name:/.test(l));
  const want = (current: string[]) => {
    const keep = current.filter((h) => h === SPREAD || !managed.includes(h) || desired.includes(h));
    for (const d of desired) if (!keep.includes(d)) keep.splice(keep.indexOf(SPREAD) >= 0 ? keep.indexOf(SPREAD) : keep.length, 0, d);
    if (!keep.includes(SPREAD)) keep.push(SPREAD);
    return keep;
  };
  if (nameIdx < 0) {
    const items = want([]);
    const block = ["- id: connection", `  name: '${CONN}'`, "  config:", `    trustedHosts: ${render(items)}`];
    return { text: (text && !text.endsWith("\n") ? text + "\n" : text) + block.join("\n") + "\n", hosts: items };
  }
  let start = nameIdx; while (start > 0 && !/^-\s/.test(lines[start])) start--;
  let end = start + 1; while (end < lines.length && !/^\S/.test(lines[end])) end++;
  const thIdx = lines.slice(start, end).findIndex((l) => /^\s+trustedHosts:/.test(l));
  if (thIdx >= 0) {
    const i = start + thIdx;
    const m = /^(\s+trustedHosts:\s*)!!js\s+"(.*)"\s*$/.exec(lines[i]);
    if (!m) return { error: "unrecognised trustedHosts format" };
    const cur = parseList(m[2]);
    if (!cur) return { error: "unrecognised trustedHosts list" };
    const items = want(cur);
    lines[i] = m[1] + render(items);
    return { text: lines.join("\n"), hosts: items };
  }
  const cfgIdx = lines.slice(start, end).findIndex((l) => /^\s+config:\s*$/.test(l));
  const items = want([]);
  if (cfgIdx >= 0) { lines.splice(start + cfgIdx + 1, 0, `    trustedHosts: ${render(items)}`); return { text: lines.join("\n"), hosts: items }; }
  if (lines.slice(start, end).some((l) => /^\s+config:/.test(l))) return { error: "inline config block" };
  lines.splice(end, 0, "  config:", `    trustedHosts: ${render(items)}`);
  return { text: lines.join("\n"), hosts: items };
}

export function syncHostsFile(file: string, desired: string[], managed: string[]): HostsResult {
  const before = existsSync(file) ? readFileSync(file, "utf8") : "";
  const r = applyHosts(before, desired, managed);
  if ("error" in r) return { changed: false, hosts: [], manual: `无法自动修改（${r.error}），请手动把 ${desired.join(", ")} 加入 connection.trustedHosts` };
  if (r.text === before) return { changed: false, hosts: r.hosts };
  let backup: string | undefined;
  if (before) { backup = `${file}.remote-agent-bak-${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}`; copyFileSync(file, backup); }
  writeFileSync(file, r.text);
  const check = readFileSync(file, "utf8");
  if (!desired.every((d) => check.includes(`'${d}'`))) { if (backup) copyFileSync(backup, file); return { changed: false, hosts: [], manual: "写入校验失败，已回滚" }; }
  return { changed: true, hosts: r.hosts, backup };
}
