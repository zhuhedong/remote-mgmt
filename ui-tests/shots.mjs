// node shots.mjs <before|after> <hubBinary>
import { chromium } from "playwright-core";
import { startEnv, totp, sleep } from "./env.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const [mode, hubBin] = process.argv.slice(2);
const out = join(dirname(fileURLToPath(import.meta.url)), "../screenshots");
const VIEWS = { mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { width: 1280, height: 800 } };
const env = await startEnv(hubBin);
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const shot = async (page, name, v) => { await sleep(350); await page.screenshot({ path: join(out, `${mode}-${name}-${v}.png`), fullPage: false }); console.log("saved", `${mode}-${name}-${v}.png`); };
try {
  for (const v of Object.keys(VIEWS)) {
    const ctx = await browser.newContext({ viewport: { width: VIEWS[v].width, height: VIEWS[v].height }, deviceScaleFactor: VIEWS[v].deviceScaleFactor || 1, isMobile: VIEWS[v].isMobile, hasTouch: VIEWS[v].hasTouch, colorScheme: process.env.SCHEME || "light", locale: "zh-CN" });
    const page = await ctx.newPage();
    await page.goto(env.base + "/"); await shot(page, "setup", v);
    if (mode === "after") {
      await page.fill("#setup-token", env.setupToken()); await page.click("[data-act=next]"); await page.waitForSelector("#setup-username");
      await page.fill("#setup-username", "me"); await page.fill("#setup-password", "Demo-pass"); await page.dispatchEvent("#setup-password", "input"); await shot(page, "setup-account", v);
      await page.fill("#setup-password", "Demo-password-2026!"); await page.fill("#setup-password2", "Demo-password-2026!"); await page.click("[data-act=next]"); await page.waitForSelector(".qr img"); await shot(page, "setup-totp", v);
    }
    await ctx.close();
  }
  await env.doSetup(); await env.login(); await env.devices();
  for (const v of Object.keys(VIEWS)) {
    const ctx = await browser.newContext({ viewport: { width: VIEWS[v].width, height: VIEWS[v].height }, deviceScaleFactor: VIEWS[v].deviceScaleFactor || 1, isMobile: VIEWS[v].isMobile, hasTouch: VIEWS[v].hasTouch, colorScheme: process.env.SCHEME || "light", locale: "zh-CN" });
    const page = await ctx.newPage();
    await page.goto(env.base + "/"); await shot(page, "login", v);
    await ctx.addCookies([...env.jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })));
    await page.goto(env.base + "/"); await page.waitForTimeout(600); await shot(page, "dashboard", v);
    if (mode === "before") {
      await page.fill("#dn", "iPad-Studio"); await page.click("text=生成登记码"); await page.waitForTimeout(300);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await shot(page, "add-device", v);
      await page.click("nav >> text=会话"); await shot(page, "sessions", v);
      await page.click("nav >> text=审计"); await shot(page, "audit", v);
    } else {
      await page.click("[data-act=add-device]"); await page.fill("#enroll-name", "iPad-Studio"); await page.click("[data-act=gen-code]"); await page.waitForSelector(".code-box"); await shot(page, "add-device", v);
      await page.goto(env.base + "/#/"); await page.waitForTimeout(300);
      await page.click(`[data-activate="${env.pending.deviceId}"]`); await page.waitForSelector("dialog[open]"); await shot(page, "activate", v);
      await page.goto(env.base + "/#/devices/" + (await env.req("GET", "/api/devices")).json[0].id); await page.waitForTimeout(500); await shot(page, "device", v);
      await page.goto(env.base + "/#/sessions"); await page.waitForTimeout(400); await shot(page, "sessions", v);
      await page.goto(env.base + "/#/audit"); await page.waitForTimeout(400); await shot(page, "audit", v);
      await page.goto(env.base + "/#/settings"); await page.waitForTimeout(400); await shot(page, "settings", v);
    }
    await ctx.close();
  }
} finally { await browser.close(); env.stop(); }
process.exit(0);
