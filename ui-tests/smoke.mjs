// UI smoke test: drives the real console in Chrome, fails on any JS error or CSP violation.
// node smoke.mjs <hubBinary>
import { chromium } from "playwright-core";
import { startEnv, totp, sleep } from "./env.mjs";
const env = await startEnv(process.argv[2]);
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errors = []; let n = 0;
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok", ++n, m); };
const nextWindow = async () => { const r = 30000 - (Date.now() % 30000); await sleep(r + 300); };
try {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: "zh-CN" });
    await ctx.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => console.error("CSP " + e.violatedDirective + " " + e.blockedURI)));
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource.*40[13]/.test(m.text())) errors.push(scheme + ": " + m.text()); });
    page.on("pageerror", (e) => errors.push(scheme + ": " + e.message));
    await page.goto(env.base + "/");
    if (scheme === "light") {
      await page.waitForSelector("#setup-token"); ok(true, "setup wizard shown on fresh hub");
      await page.fill("#setup-token", "wrong"); await page.click("[data-act=next]"); await page.waitForSelector(".err:not(:empty)"); ok(true, "bad setup token rejected");
      await page.fill("#setup-token", env.setupToken()); await page.click("[data-act=next]"); await page.waitForSelector("#setup-username");
      await page.fill("#setup-username", env.username); await page.fill("#setup-password", "short"); await page.fill("#setup-password2", "short"); await page.click("[data-act=next]");
      ok(await page.locator(".err:not(:empty)").count() > 0, "weak password rejected client-side");
      await page.fill("#setup-password", env.password); await page.fill("#setup-password2", env.password); await page.click("[data-act=next]");
      await page.waitForSelector(".qr img"); ok((await page.getAttribute(".qr img", "src")).startsWith("data:image/"), "TOTP QR rendered locally");
      const secret = (await page.textContent(".secret span")).replace(/\s/g, ""); env.secret = secret;
      await page.fill("#setup-code", totp(secret)); await page.waitForSelector("[data-act=to-login]"); ok(true, "setup finished via UI");
      await page.click("[data-act=to-login]"); await page.waitForSelector("#login-username");
      await page.fill("#login-username", env.username); await page.fill("#login-password", "nope-nope-nope"); await page.click("[data-act=login]");
      await page.waitForSelector(".err:not(:empty)"); ok(true, "wrong password shows error");
      await page.fill("#login-password", env.password); await page.click("[data-act=login]"); await page.waitForSelector("#login-code");
      await nextWindow(); await page.fill("#login-code", totp(secret));
      await page.waitForSelector("[data-act=add-device]"); ok(true, "login via UI reaches dashboard");
      const cookies = await ctx.cookies(); for (const c of cookies) env.jar.set(c.name, c.value);
      await env.devices();
      await page.reload(); await page.waitForSelector(".toast, [data-act=add-device]");
    } else {
      await ctx.addCookies([...env.jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" }))); await page.reload();
    }
    await page.waitForSelector(`[data-activate="${env.pending.deviceId}"]`); ok(await page.locator("text=MacBook-Pro").count() > 0, scheme + ": dashboard lists devices");
    for (const [r, t] of [["#/sessions", "会话"], ["#/audit", "审计"], ["#/settings", "设置"]]) {
      await page.goto(env.base + "/" + r); await page.waitForSelector("h1"); await sleep(300);
      ok((await page.textContent("h1")).includes(t), scheme + ": route " + r);
    }
    const id = (await env.req("GET", "/api/devices")).json[0].id;
    await page.goto(env.base + "/#/devices/" + id); await sleep(500); ok(await page.locator("h1").count() > 0, scheme + ": device detail");
    await page.goto(env.base + "/#/"); await page.click("[data-act=add-device]"); await page.fill("#enroll-name", "x-" + scheme); await page.click("[data-act=gen-code]");
    await page.waitForSelector(".code-box"); ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test((await page.textContent(".code-box .code")).trim()), scheme + ": enrollment code shown");
    await ctx.close();
  }
  // settings API: password change keeps current session and works for new login
  const np = "Another-pass-2026!";
  ok((await env.req("POST", "/api/me/password", { current: "bad", new: np })).status >= 400, "password change rejects wrong current");
  ok((await env.req("POST", "/api/me/password", { current: env.password, new: np })).status === 200, "password change ok");
  ok((await env.req("GET", "/api/me")).status === 200, "session survives own password change");
  ok((await env.req("POST", "/api/me/totp/begin", { password: np })).json?.uri?.startsWith("otpauth://"), "totp rebind begin");
  // device subdomain pages
  const http = await import("node:http");
  const sub = (host) => new Promise((res, rej) => http.get({ host: "127.0.0.1", port: env.port, path: "/", headers: { host } }, (r) => { let b = ""; r.setEncoding("utf8"); r.on("data", (d) => (b += d)); r.on("end", () => res([r.statusCode, b, r.headers["content-security-policy"]])); }).on("error", rej));
  let [s, b, csp] = await sub("dsh--nope.d.localhost"); ok(s === 404 && b.includes("找不到这台设备") && /frame-ancestors 'none'/.test(csp), "unknown device styled 404");
  [s, b] = await sub("dsh--office-mac.d.localhost"); console.log("  offline host status", s);
  ok(errors.length === 0, "no console/CSP errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  console.log("UI smoke: all", n, "checks passed");
} catch (e) { console.error(e.message); console.error(errors.join("\n")); process.exitCode = 1; }
finally { await browser.close(); env.stop(); }
