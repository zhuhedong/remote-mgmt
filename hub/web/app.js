/* DSH 远程管理 · console (vanilla JS, CSP-safe: no inline scripts/styles) */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var toastsEl = document.getElementById("toasts");
  var me = null, timer = null;

  // ---------- helpers ----------
  function h(tag, attrs) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "text") e.textContent = v;
      else if (k === "class") e.className = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (k === "value") e.value = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) { if (c == null || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(e, x); }); return; } e.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c); }
  var ICONS = {
    monitor: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 21h8M12 17v4",
    devices: "M3 6h13v9H3zM8 19h3M19 9h2v10h-4v-4",
    shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    plus: "M12 5v14M5 12h14", arrow: "M5 12h14M13 6l6 6-6 6", back: "M15 18l-6-6 6-6", copy: "M9 9h11v11H9zM5 15H4V4h11v1",
    check: "M5 12l5 5L20 7", x: "M6 6l12 12M18 6L6 18", alert: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    info: "M12 16v-4M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
    cpu: "M6 6h12v12H6zM9 9h6v6H9zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4", key: "M15 7a4 4 0 1 1-3.5 6L5 19.5V22H2v-3l6.5-6.5A4 4 0 0 1 15 7z",
    phone: "M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2", laptop: "M4 5h16v11H4zM2 19h20",
    trash: "M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15", logout: "M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3", lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4", refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
    globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18", box: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8",
  };
  function icon(name) { var s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "icon"); s.setAttribute("aria-hidden", "true"); var p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", ICONS[name] || ""); s.appendChild(p); return s; }

  function api(method, path, body) {
    return fetch(path, { method: method, headers: { "Content-Type": "application/json", "X-Hub": "1" }, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(zh(j.error) || ("请求失败（HTTP " + r.status + "）")); e.status = r.status; throw e; } return j; }); },
        function () { throw new Error("网络连接失败，请检查网络"); });
  }
  var ERR = {
    "invalid setup token": "设置令牌不正确", "wrong username or password": "用户名或密码错误", "wrong code": "验证码不正确", "invalid TOTP code": "验证码不正确",
    "login first": "请先输入用户名和密码", "login expired": "登录已超时，请重新输入密码", "too many attempts": "尝试次数过多，请 15 分钟后再试", "too many attempts, try later": "尝试次数过多，请 15 分钟后再试",
    "username >= 2 chars, password >= 10 chars": "用户名至少 2 位，密码至少 10 位", "setup already done": "已经完成过首次设置", "unauthorized": "登录已失效，请重新登录",
    "current password is wrong": "当前密码不正确", "password is wrong": "密码不正确", "password >= 10 chars": "新密码至少 10 位", "start again": "已超时，请重新开始",
    "name required": "请填写设备名称", "no pending device": "该设备不在待激活状态", "no such device/service": "设备不存在或未激活", "not found": "未找到",
  };
  function zh(m) { if (!m) return ""; if (ERR[m]) return ERR[m]; if (/^fingerprint mismatch/.test(m)) return "指纹不一致，请核对 DSH 侧栏显示的指纹（至少前 6 位）"; return m; }

  function toast(msg, kind) {
    var t = h("div", { class: "toast " + (kind || "ok"), role: "status" }, icon(kind === "err" ? "alert" : "check"), h("span", { text: msg }));
    toastsEl.appendChild(t);
    setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 300); }, 2600);
  }
  function copy(text, label) {
    var done = function () { toast((label || "内容") + "已复制"); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var ta = h("textarea", { value: text }); document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { toast("复制失败，请手动复制", "err"); } ta.remove(); }
  }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.textContent = ""; btn.appendChild(h("span", { class: "spinner" })); if (label) btn.appendChild(document.createTextNode(label)); }
    else { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; }
  }
  function ago(ts) {
    if (!ts) return "从未";
    var s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
    if (s < 60) return "刚刚"; if (s < 3600) return Math.floor(s / 60) + " 分钟前"; if (s < 86400) return Math.floor(s / 3600) + " 小时前";
    if (s < 86400 * 30) return Math.floor(s / 86400) + " 天前"; return fmt(ts);
  }
  function fmt(ts) { if (!ts) return "-"; var d = new Date(ts * 1000); var p = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()); }
  function field(label, input, hint) { return h("div", { class: "field" }, h("label", { class: "label", for: input.id, text: label }), input, hint ? h("div", { class: "hint", text: hint }) : null); }
  function input(id, attrs) { var a = { class: "input", id: id, autocomplete: "off" }; for (var k in attrs || {}) a[k] = attrs[k]; return h("input", a); }
  function errLine(id) { return h("div", { class: "err", id: id || "err", role: "alert" }); }
  function setErr(msg, id) { var e = document.getElementById(id || "err"); if (e) e.textContent = msg || ""; }
  function otpInput(id, onFull) {
    var i = input(id, { class: "input otp", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "6", placeholder: "••••••", pattern: "[0-9]*" });
    i.addEventListener("input", function () { i.value = i.value.replace(/\D/g, "").slice(0, 6); if (i.value.length === 6 && onFull) onFull(); });
    return i;
  }
  function qrImg(text) {
    try { var q = window.qrcode(0, "M"); q.addData(text); q.make(); return h("img", { src: q.createDataURL(5, 0), alt: "两步验证二维码" }); }
    catch (e) { return h("div", { class: "muted small", text: "二维码生成失败，请使用下方密钥手动添加" }); }
  }
  function strength(pw) {
    var s = 0; if (pw.length >= 10) s++; if (pw.length >= 14) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^\w]/.test(pw)) s++;
    if (pw.length < 10) s = Math.min(s, 1);
    return [{ t: "太短", c: "var(--danger)" }, { t: "弱", c: "var(--danger)" }, { t: "一般", c: "var(--warn)" }, { t: "较强", c: "var(--ok)" }, { t: "强", c: "var(--ok)" }, { t: "很强", c: "var(--ok)" }][s] && { s: s, t: ["太短", "弱", "一般", "较强", "强", "很强"][s], c: ["var(--danger)", "var(--danger)", "var(--warn)", "var(--ok)", "var(--ok)", "var(--ok)"][s] };
  }
  function meter(pwInput) {
    var bar = h("i"), lbl = h("span", { class: "hint" });
    var upd = function () { var r = strength(pwInput.value); bar.style.width = (pwInput.value ? Math.max(8, r.s * 20) : 0) + "%"; bar.style.background = r.c; lbl.textContent = pwInput.value ? "密码强度：" + r.t : "至少 10 位，建议混合大小写、数字和符号"; };
    pwInput.addEventListener("input", upd); upd();
    return h("div", { class: "stack", }, h("div", { class: "meter" }, bar), lbl);
  }
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var d = h("dialog", {}, h("form", { class: "dlg", method: "dialog" },
        h("h2", { text: opts.title }), h("p", { class: "lead", text: opts.body }),
        h("div", { class: "btns" }, h("button", { class: "btn", value: "cancel", text: "取消" }), h("button", { class: "btn " + (opts.danger ? "danger solid" : "primary"), value: "ok", text: opts.ok || "确定" }))));
      document.body.appendChild(d);
      d.addEventListener("close", function () { resolve(d.returnValue === "ok"); d.remove(); });
      d.addEventListener("click", function (e) { if (e.target === d) d.close("cancel"); });
      d.showModal();
    });
  }
  function dialog(content) {
    var d = h("dialog", {}, h("div", { class: "dlg" }, content));
    document.body.appendChild(d);
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
    d.addEventListener("close", function () { d.remove(); });
    d.showModal();
    return d;
  }
  function brand(sub) { return h("div", { class: "brand" }, h("img", { src: "/icon.svg", alt: "" }), h("div", {}, h("b", { text: "DSH 远程管理" }), sub ? h("span", { class: "muted small", text: sub }) : null)); }
  function clearTimer() { if (timer) { clearInterval(timer); timer = null; } }

  // ---------- setup wizard ----------
  function setup() {
    clearTimer();
    var st = { step: 1, token: "", secret: "", uri: "", username: "", password: "" };
    var wrap = h("div", { class: "panel" });
    app.className = ""; app.replaceChildren(h("div", { class: "auth" }, wrap));
    function steps() { return h("div", { class: "steps" }, [1, 2, 3, 4].map(function (i) { return h("span", { class: i <= st.step ? "on" : "" }); })); }
    function render() {
      var body;
      if (st.step === 1) {
        var tok = input("setup-token", { type: "password", placeholder: "粘贴一次性设置令牌", autocomplete: "off" });
        var next = h("button", { class: "btn primary lg block", "data-act": "next", type: "submit", text: "下一步" });
        body = h("form", { class: "stack lg", onsubmit: function (e) { e.preventDefault(); setErr(""); busy(next, true, "验证中");
          api("POST", "/api/auth/setup/begin", { token: tok.value.trim() }).then(function (r) { st.token = tok.value.trim(); st.secret = r.secret; st.uri = r.uri; st.step = 2; render(); }, function (e) { busy(next, false); setErr(e.message); }); } },
          h("div", {}, h("div", { class: "step-label", text: "第 1 步 / 共 4 步" }), h("h1", { text: "欢迎使用 DSH 远程管理" }), h("p", { class: "lead", text: "首次使用需要验证你是服务器的管理员。设置令牌只保存在服务器上，用完会自动删除。" })),
          field("设置令牌", tok, "在服务器上运行 sudo cat /opt/remote-hub/data/setup-token 获取"), errLine(), next);
        setTimeout(function () { tok.focus(); }, 30);
      } else if (st.step === 2) {
        var u = input("setup-username", { placeholder: "例如 zhuhedong", autocomplete: "username", autocapitalize: "off", value: st.username });
        var p = input("setup-password", { type: "password", placeholder: "至少 10 位", autocomplete: "new-password", value: st.password });
        var p2 = input("setup-password2", { type: "password", placeholder: "再输入一次", autocomplete: "new-password", value: st.password });
        body = h("form", { class: "stack lg", onsubmit: function (e) { e.preventDefault();
          if (u.value.trim().length < 2) return setErr("用户名至少 2 位"); if (p.value.length < 10) return setErr("密码至少 10 位"); if (p.value !== p2.value) return setErr("两次输入的密码不一致");
          st.username = u.value.trim(); st.password = p.value; st.step = 3; render(); } },
          h("div", {}, h("div", { class: "step-label", text: "第 2 步 / 共 4 步" }), h("h1", { text: "创建管理员账户" }), h("p", { class: "lead", text: "这个账户可以访问和管理所有已连接的 DSH，请使用强密码。" })),
          field("用户名", u), h("div", { class: "stack" }, field("密码", p), meter(p)), field("确认密码", p2), errLine(),
          h("div", { class: "row" }, h("button", { class: "btn lg", type: "button", text: "上一步", onclick: function () { st.step = 1; render(); } }), h("button", { class: "btn primary lg grow", type: "submit", "data-act": "next", text: "下一步" })));
        setTimeout(function () { u.focus(); }, 30);
      } else if (st.step === 3) {
        var code = otpInput("setup-code", function () { fin.click(); });
        var fin = h("button", { class: "btn primary lg block", type: "submit", "data-act": "finish", text: "验证并完成" });
        body = h("form", { class: "stack lg", onsubmit: function (e) { e.preventDefault(); setErr(""); if (code.value.length !== 6) return setErr("请输入 6 位验证码"); busy(fin, true, "正在创建");
          api("POST", "/api/auth/setup/finish", { token: st.token, username: st.username, password: st.password, code: code.value }).then(function () { st.password = ""; st.step = 4; render(); }, function (e) { busy(fin, false); setErr(e.message); code.select(); }); } },
          h("div", {}, h("div", { class: "step-label", text: "第 3 步 / 共 4 步" }), h("h1", { text: "绑定两步验证" }), h("p", { class: "lead", text: "用 Google Authenticator、Microsoft Authenticator、1Password 或系统密码 App 扫描二维码。" })),
          h("div", {}, h("div", { class: "qr" }, qrImg(st.uri.replace("DSH%20Remote:owner", "DSH%20Remote:" + encodeURIComponent(st.username)))),
            h("div", { class: "secret" }, h("span", { text: st.secret.replace(/(.{4})/g, "$1 ").trim() }), h("button", { class: "btn sm ghost", type: "button", onclick: function () { copy(st.secret, "密钥"); } }, icon("copy"), "复制")),
            h("p", { class: "hint", text: "无法扫码时，在 App 里选择“输入设置密钥”，类型选“基于时间”。" })),
          field("App 显示的 6 位验证码", code), errLine(),
          h("div", { class: "row" }, h("button", { class: "btn lg", type: "button", text: "上一步", onclick: function () { st.step = 2; render(); } }), fin));
        setTimeout(function () { code.focus(); }, 30);
      } else {
        body = h("div", { class: "stack lg" },
          h("div", { class: "done-mark" }, icon("check")),
          h("div", {}, h("div", { class: "step-label", text: "第 4 步 / 共 4 步" }), h("h1", { text: "设置完成" }), h("p", { class: "lead", text: "管理员账户 " + st.username + " 已创建，两步验证已启用。" })),
          h("div", { class: "notice info" }, icon("info"), h("div", {}, h("b", { text: "请妥善保管验证器 App。" }), h("div", { class: "small", text: "目前没有恢复码：如果手机丢失，需要在服务器上重置账户。建议在 1Password 等密码管理器里同时保存一份两步验证密钥。" }))),
          h("button", { class: "btn primary lg block", "data-act": "to-login", text: "去登录", onclick: function () { location.hash = "#/"; route(); } }));
      }
      wrap.replaceChildren(brand("首次设置"), h("div", { class: "card" }, steps(), body), h("div", { class: "foot", text: "所有数据只保存在你自己的服务器上" }));
    }
    render();
  }

  // ---------- login ----------
  function login() {
    clearTimer();
    var wrap = h("div", { class: "panel" });
    app.className = ""; app.replaceChildren(h("div", { class: "auth" }, wrap));
    function step1() {
      var u = input("login-username", { placeholder: "用户名", autocomplete: "username", autocapitalize: "off" });
      var p = input("login-password", { type: "password", placeholder: "密码", autocomplete: "current-password" });
      var b = h("button", { class: "btn primary lg block", type: "submit", "data-act": "login", text: "继续" });
      wrap.replaceChildren(brand(), h("div", { class: "card" }, h("form", { class: "stack lg", onsubmit: function (e) { e.preventDefault(); setErr(""); busy(b, true, "验证中");
        api("POST", "/api/auth/login", { username: u.value.trim(), password: p.value }).then(step2, function (e) { busy(b, false); setErr(e.message); p.select(); }); } },
        h("div", {}, h("h1", { text: "登录" }), h("p", { class: "lead", text: "登录后可以访问你所有的 DSH。" })), field("用户名", u), field("密码", p), errLine(), b)),
        h("div", { class: "foot" }, h("span", { class: "row", }, icon("lock"), "连接已加密 · 需要两步验证")));
      setTimeout(function () { u.focus(); }, 30);
    }
    function step2() {
      var c = otpInput("login-code", function () { b.click(); });
      var b = h("button", { class: "btn primary lg block", type: "submit", "data-act": "verify", text: "登录" });
      wrap.replaceChildren(brand(), h("div", { class: "card" }, h("form", { class: "stack lg", onsubmit: function (e) { e.preventDefault(); setErr(""); if (c.value.length !== 6) return setErr("请输入 6 位验证码"); busy(b, true, "登录中");
        api("POST", "/api/auth/totp", { code: c.value }).then(function () { toast("登录成功"); route(); }, function (e) { busy(b, false); setErr(e.message); c.value = ""; c.focus(); if (e.status === 401 && /超时|请先/.test(e.message)) setTimeout(step1, 1200); }); } },
        h("div", {}, h("h1", { text: "两步验证" }), h("p", { class: "lead", text: "打开验证器 App，输入 DSH Remote 当前显示的 6 位数字。" })), c, errLine(), b,
        h("button", { class: "btn ghost block", type: "button", text: "返回", onclick: step1 }))));
      setTimeout(function () { c.focus(); }, 30);
    }
    step1();
  }

  // ---------- shell ----------
  var NAV = [["#/", "设备", "devices"], ["#/sessions", "会话", "shield"], ["#/audit", "审计", "list"], ["#/settings", "设置", "gear"]];
  function shell(active, content) {
    var initial = (me && me.username ? me.username[0] : "?").toUpperCase();
    var top = h("header", { class: "topbar" }, h("a", { href: "#/", class: "brand" }, h("img", { src: "/icon.svg", alt: "" }), h("b", { text: "DSH 远程管理" })),
      h("nav", { class: "tabs" }, NAV.map(function (n) { return h("a", { href: n[0], class: "tab" + (active === n[0] ? " on" : "") }, icon(n[2]), n[1]); })),
      h("div", { class: "user" }, h("span", { class: "uname muted small", text: me ? me.username : "" }), h("a", { href: "#/settings", class: "avatar", title: "设置", text: initial })));
    var bottom = h("nav", { class: "bottombar" }, NAV.map(function (n) { return h("a", { href: n[0], class: active === n[0] ? "on" : "" }, icon(n[2]), n[1]); }));
    var main = h("main", { class: "view" }, content);
    app.className = ""; app.replaceChildren(top, main, bottom);
    return main;
  }
  function loading(active) { shell(active, h("div", { class: "grid" }, h("div", { class: "skeleton" }), h("div", { class: "skeleton" }))); }
  function errorState(active, e, retry) {
    if (e && e.status === 401) { route(); return; }
    shell(active, h("div", { class: "card empty" }, h("div", { class: "art" }, icon("alert")), h("h3", { text: "加载失败" }), h("p", { text: e ? e.message : "未知错误" }), h("button", { class: "btn", onclick: retry }, icon("refresh"), "重试")));
  }

  // ---------- dashboard ----------
  function osLabel(d) {
    var r = d.status_report || {}, v = d.versions || {};
    var os = v.os || (r.platform ? r.platform + "-" + r.arch : "");
    var m = { darwin: "macOS", linux: "Linux", win32: "Windows" };
    var parts = os.split("-");
    return os ? (m[parts[0]] || parts[0]) + (parts[1] ? " · " + (parts[1] === "arm64" ? "Apple 芯片" : parts[1] === "x64" ? "Intel" : parts[1]) : "") : "未知系统";
  }
  function statusChip(d) {
    if (d.status === "pending") return h("span", { class: "chip warn", text: "待激活" });
    return d.online ? h("span", { class: "chip ok", text: "在线" }) : h("span", { class: "chip", text: "离线" });
  }
  function bars(r) {
    if (!r || (r.cpu == null && r.memUsed == null)) return null;
    var bar = function (label, v) { var i = h("i", { class: v >= 85 ? "hot" : "" }); i.style.width = Math.max(2, Math.min(100, v || 0)) + "%"; return h("div", { class: "bar" }, h("label", {}, label, h("b", { text: v == null ? "-" : v + "%" })), h("div", { class: "track" }, i)); };
    return h("div", { class: "bars" }, bar("CPU", r.cpu), bar("内存", r.memUsed));
  }
  function openDevice(d, btn) {
    busy(btn, true, "正在打开");
    api("POST", "/api/open", { device: d.id, service: "dsh" }).then(function (r) { location.href = r.url; }, function (e) { busy(btn, false); toast(e.message, "err"); });
  }
  function deviceCard(d, refresh) {
    var r = d.status_report || {};
    var openBtn = d.status === "pending"
      ? h("button", { class: "btn primary lg", "data-activate": d.id, onclick: function () { activateDialog(d, refresh); } }, icon("key"), "核对指纹并激活")
      : h("button", { class: "btn primary lg", "data-open": d.id, disabled: !d.online, onclick: function (e) { openDevice(d, e.currentTarget); } }, icon("arrow"), d.online ? "打开 DSH" : "设备离线");
    return h("article", { class: "card device" },
      h("div", { class: "head" },
        h("a", { href: "#/devices/" + d.id, class: "dev-icon", "aria-label": "设备详情" }, icon("laptop"), h("i", { class: "dot " + (d.status === "pending" ? "wait" : d.online ? "on" : "") })),
        h("div", { class: "grow" }, h("a", { href: "#/devices/" + d.id, class: "name", text: d.name }),
          h("div", { class: "meta" }, h("span", {}, icon("clock"), d.online ? "已连接 " + ago(d.since).replace("前", "").replace("刚刚", "不到 1 分钟") : d.status === "pending" ? "登记于 " + ago(d.created) : "最后在线 " + ago(d.lastSeen)))),
        statusChip(d)),
      h("div", { class: "meta" }, h("span", {}, icon("monitor"), osLabel(d)), d.versions && d.versions.plugin ? h("span", {}, icon("box"), "插件 " + d.versions.plugin) : null, d.versions && d.versions.node ? h("span", {}, "Node " + d.versions.node) : null),
      d.online ? bars(r) : null,
      r.restartNeeded ? h("div", { class: "notice" }, icon("alert"), h("span", { text: "DSH 需要重启一次，访问域名才会生效。" })) : null,
      h("div", { class: "actions" }, openBtn, h("a", { href: "#/devices/" + d.id, class: "btn lg", "aria-label": "详情" }, icon("info"))));
  }
  function dashboard() {
    loading("#/");
    var first = true;
    function load() {
      return api("GET", "/api/devices").then(function (list) {
        if (!/^#\/?$/.test(location.hash || "#/")) return;
        var online = list.filter(function (d) { return d.online; }).length, pending = list.filter(function (d) { return d.status === "pending"; }).length;
        var head = h("div", { class: "section-title" }, h("div", {}, h("h1", { text: "我的设备" }), h("p", { class: "muted small", text: list.length ? "共 " + list.length + " 台 · " + online + " 台在线" : "还没有连接任何 DSH" })),
          h("button", { class: "btn primary", "data-act": "add-device", onclick: function () { addDeviceDialog(load); } }, icon("plus"), "添加设备"));
        var body = list.length
          ? [h("div", { class: "stats" }, h("div", { class: "card stat" }, h("b", { text: list.length }), h("span", { text: "设备" })), h("div", { class: "card stat" }, h("b", { text: online }), h("span", { text: "在线" })), h("div", { class: "card stat" }, h("b", { text: pending }), h("span", { text: "待激活" }))),
             h("div", { class: "grid" }, list.map(function (d) { return deviceCard(d, load); }))]
          : h("div", { class: "card empty" }, h("div", { class: "art" }, icon("devices")), h("h3", { text: "连接你的第一台 DSH" }), h("p", { text: "在 Mac 的 DSH 里安装 dsh-remote-agent 插件，然后用登记码把它连接到这里。" }),
              h("button", { class: "btn primary lg", "data-act": "add-device", onclick: function () { addDeviceDialog(load); } }, icon("plus"), "添加设备"));
        var main = document.querySelector("main.view");
        if (first || !main) { shell("#/", [head, body]); first = false; } else if (!document.querySelector("dialog[open]")) main.replaceChildren(head, h("div", {}, body));
      }, function (e) { if (first) errorState("#/", e, dashboard); });
    }
    load(); clearTimer(); timer = setInterval(load, 10000);
  }

  function addDeviceDialog(refresh) {
    var name = input("enroll-name", { placeholder: "例如 MacBook-Pro", maxlength: "60" });
    var gen = h("button", { class: "btn primary", type: "submit", "data-act": "gen-code", text: "生成登记码" });
    var body = h("div", {});
    var cd = null, poll = null, known = null;
    var d = dialog(body);
    d.addEventListener("close", function () { clearInterval(cd); clearInterval(poll); refresh && refresh(); });
    api("GET", "/api/devices").then(function (l) { known = l.map(function (x) { return x.id; }); }, function () {});
    body.replaceChildren(h("form", { onsubmit: function (e) { e.preventDefault(); setErr("", "enroll-err"); busy(gen, true, "生成中");
        api("POST", "/api/enroll-codes", { name: name.value.trim() }).then(showCode, function (e) { busy(gen, false); setErr(e.message, "enroll-err"); }); } },
      h("h2", { text: "添加设备" }), h("p", { class: "lead", text: "给这台 DSH 起个名字，生成一次性登记码，然后在 DSH 里填写。" }),
      h("div", { class: "stack" }, field("设备名称", name), errLine("enroll-err")),
      h("div", { class: "btns" }, h("button", { class: "btn", type: "button", text: "取消", onclick: function () { d.close(); } }), gen)));
    setTimeout(function () { name.focus(); }, 30);
    function showCode(r) {
      var left = h("span", {}), pi = h("i");
      var tick = function () { var s = Math.max(0, r.expires - Math.floor(Date.now() / 1000)); left.textContent = s ? "剩余 " + Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2) : "已过期"; pi.style.width = (s / 600 * 100) + "%"; if (!s) { clearInterval(cd); pi.style.background = "var(--danger)"; } };
      body.replaceChildren(h("h2", { text: "登记码已生成" }), h("p", { class: "lead", text: "10 分钟内有效，只能使用一次。" }),
        h("div", { class: "code-box" }, h("div", { class: "code", text: r.code }), h("div", { class: "ring" }, h("div", { class: "pbar" }, pi), left),
          h("div", { class: "row" }, h("button", { class: "btn sm", onclick: function () { copy(r.code, "登记码"); } }, icon("copy"), "复制登记码"), h("button", { class: "btn sm", onclick: function () { copy(r.hub, "Hub 地址"); } }, icon("copy"), "复制 Hub 地址"))),
        h("ol", { class: "howto" }, h("li", {}, "在 Mac 上打开 DSH，点左下角侧栏的「远程」"), h("li", {}, "Hub 地址填 ", h("code", { text: r.hub })), h("li", {}, "填入登记码并点「登记」"), h("li", {}, "回到这里核对 DSH 显示的指纹，激活设备")),
        h("div", { class: "notice info", id: "enroll-wait" }, h("span", { class: "spinner" }), h("span", { text: "等待设备登记…" })),
        h("div", { class: "btns" }, h("button", { class: "btn", text: "完成", onclick: function () { d.close(); } })));
      tick(); cd = setInterval(tick, 1000);
      poll = setInterval(function () { api("GET", "/api/devices").then(function (l) {
        var nd = l.filter(function (x) { return x.status === "pending" && known && known.indexOf(x.id) < 0; })[0];
        if (nd) { clearInterval(poll); clearInterval(cd); d.close(); toast("「" + nd.name + "」已登记，请核对指纹"); activateDialog(nd, refresh); }
      }, function () {}); }, 3000);
    }
  }

  function activateDialog(dev, refresh) {
    var fp = input("fp-input", { placeholder: "输入 DSH 显示的指纹（至少前 6 位）", autocapitalize: "off", class: "input mono" });
    var ok = h("button", { class: "btn primary", type: "submit", "data-act": "activate", text: "核对并激活" });
    var d = dialog(h("form", { onsubmit: function (e) { e.preventDefault(); setErr("", "fp-err"); busy(ok, true, "激活中");
        api("POST", "/api/devices/activate", { id: dev.id, fingerprint: fp.value.trim() }).then(function () { d.close(); toast("「" + dev.name + "」已激活"); refresh && refresh(); }, function (e) { busy(ok, false); setErr(e.message, "fp-err"); }); } },
      h("h2", { text: "激活「" + dev.name + "」" }),
      h("p", { class: "lead", text: "为了防止别人冒用登记码，请在 Mac 的 DSH 侧栏「远程」里查看指纹，确认与下面一致后输入。" }),
      h("div", { class: "stack" }, h("div", { class: "label", text: "Hub 收到的指纹" }), h("div", { class: "fp", text: dev.fingerprint.replace(/(.{4})/g, "$1 ").trim() }),
        field("DSH 显示的指纹", fp), errLine("fp-err")),
      h("div", { class: "btns" }, h("button", { class: "btn", type: "button", text: "取消", onclick: function () { d.close(); } }), ok)));
    setTimeout(function () { fp.focus(); }, 30);
  }

  // ---------- device detail ----------
  function deviceDetail(id) {
    clearTimer(); loading("#/");
    api("GET", "/api/devices").then(function (list) {
      var d = list.filter(function (x) { return x.id === id; })[0];
      if (!d) return shell("#/", h("div", { class: "card empty" }, h("div", { class: "art" }, icon("devices")), h("h3", { text: "设备不存在" }), h("p", { text: "它可能已经被移除。" }), h("a", { href: "#/", class: "btn" }, "返回设备列表")));
      var r = d.status_report || {}, v = d.versions || {};
      var svc = d.services && d.services[0];
      var openBtn = d.status === "pending" ? h("button", { class: "btn primary lg", onclick: function () { activateDialog(d, function () { deviceDetail(id); }); } }, icon("key"), "核对指纹并激活")
        : h("button", { class: "btn primary lg", disabled: !d.online, onclick: function (e) { openDevice(d, e.currentTarget); } }, icon("arrow"), d.online ? "打开 DSH" : "设备离线");
      var info = h("dl", { class: "kv" },
        h("dt", { text: "状态" }), h("dd", {}, statusChip(d)),
        h("dt", { text: "访问地址" }), h("dd", { class: "mono small", text: svc ? "https://" + svc.host : "-" }),
        h("dt", { text: "指纹" }), h("dd", { class: "mono", text: d.fingerprint }),
        h("dt", { text: "主机名" }), h("dd", { text: d.hostname || "-" }),
        h("dt", { text: "系统" }), h("dd", { text: osLabel(d) }),
        h("dt", { text: "插件版本" }), h("dd", { text: v.plugin || "-" }),
        h("dt", { text: "Node" }), h("dd", { text: v.node || "-" }),
        h("dt", { text: d.online ? "在线自" : "最后在线" }), h("dd", { text: d.online ? fmt(d.since) + "（" + ago(d.since) + "）" : (d.lastSeen ? fmt(d.lastSeen) + "（" + ago(d.lastSeen) + "）" : "从未") }),
        h("dt", { text: "登记时间" }), h("dd", { text: fmt(d.created) }),
        h("dt", { text: "设备 ID" }), h("dd", { class: "mono small muted", text: d.id }));
      var live = d.online ? h("div", { class: "card pad stack" }, h("h3", { text: "运行状态" }), bars(r) || h("p", { class: "muted small", text: "暂无指标" }),
        h("dl", { class: "kv" }, h("dt", { text: "负载" }), h("dd", { text: r.load != null ? Number(r.load).toFixed(2) : "-" }), h("dt", { text: "开机时长" }), h("dd", { text: r.uptime ? Math.floor(r.uptime / 86400) + " 天 " + Math.floor(r.uptime % 86400 / 3600) + " 小时" : "-" }),
          h("dt", { text: "插件内存" }), h("dd", { text: r.rss ? r.rss + " MB" : "-" }), h("dt", { text: "连接延迟" }), h("dd", { text: r.rtt != null ? r.rtt + " ms" : "-" }), h("dt", { text: "DSH" }), h("dd", { text: r.dshReady ? "运行中" : "未就绪" })),
        r.restartNeeded ? h("div", { class: "notice" }, icon("alert"), h("span", { text: "DSH 需要重启一次，访问域名才会生效。" })) : null)
        : h("div", { class: "card pad empty" }, h("div", { class: "art" }, icon("monitor")), h("h3", { text: d.status === "pending" ? "等待激活" : "设备离线" }), h("p", { text: d.status === "pending" ? "核对指纹并激活后，设备会自动连接。" : "确认电脑已开机、DSH 正在运行并联网。" }));
      shell("#/", [h("a", { href: "#/", class: "back" }, icon("back"), "设备"),
        h("div", { class: "page-head" }, h("div", { class: "dev-icon" }, icon("laptop"), h("i", { class: "dot " + (d.status === "pending" ? "wait" : d.online ? "on" : "") })), h("div", { class: "grow" }, h("h1", { text: d.name }), h("p", { class: "muted small", text: osLabel(d) }))),
        h("div", { class: "row wrap", }, openBtn), h("div", { class: "two" }, h("div", { class: "card pad stack" }, h("h3", { text: "设备信息" }), info), h("div", { class: "stack" }, live,
          h("div", { class: "card pad stack" }, h("h3", { text: "危险操作" }), h("p", { class: "muted small", text: "移除后，这台 DSH 会立即断开，本机密钥作废，需要新的登记码才能重新连接。" }),
            h("button", { class: "btn danger", "data-act": "revoke", onclick: function () { confirmDialog({ title: "移除「" + d.name + "」？", body: "设备会立即断开且无法再连接，已打开的 DSH 页面也会失效。", ok: "移除设备", danger: true }).then(function (y) { if (!y) return; api("POST", "/api/devices/revoke", { id: d.id }).then(function () { toast("已移除「" + d.name + "」"); location.hash = "#/"; }, function (e) { toast(e.message, "err"); }); }); } }, icon("trash"), "移除设备"))))]);
      document.querySelector(".row.wrap").classList.add("stack"); document.querySelector(".row.wrap").style.marginBottom = "16px";
    }, function (e) { errorState("#/", e, function () { deviceDetail(id); }); });
  }

  // ---------- sessions ----------
  function uaLabel(ua) {
    ua = ua || ""; var dev = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "未知设备";
    var br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /node|curl/i.test(ua) ? "脚本" : "浏览器";
    return { dev: dev, br: br, mobile: /iPhone|Android|iPad/.test(ua) };
  }
  function sessions() {
    clearTimer(); loading("#/sessions");
    api("GET", "/api/sessions").then(function (list) {
      var others = list.filter(function (s) { return !s.current; }).length;
      var items = list.map(function (s) {
        var u = uaLabel(s.ua);
        return h("div", { class: "item" + (s.current ? " current" : "") }, h("div", { class: "ico" }, icon(u.mobile ? "phone" : "laptop")),
          h("div", { class: "grow" }, h("div", { class: "row" }, h("span", { class: "t", text: u.dev + " · " + u.br }), s.current ? h("span", { class: "chip accent", text: "当前设备" }) : null),
            h("div", { class: "muted small", text: (s.ip || "-") + " · 最近活动 " + ago(s.lastSeen) + " · 登录于 " + fmt(s.created) })),
          s.current ? null : h("button", { class: "btn sm danger", "data-kick": s.id, onclick: function () { confirmDialog({ title: "踢出这个会话？", body: u.dev + " · " + u.br + "（" + s.ip + "）将立即退出登录，已打开的 DSH 页面也会失效。", ok: "踢出", danger: true }).then(function (y) { if (y) api("POST", "/api/sessions/revoke", { id: s.id }).then(function () { toast("已踢出"); sessions(); }, function (e) { toast(e.message, "err"); }); }); } }, "踢出"));
      });
      shell("#/sessions", [h("div", { class: "section-title" }, h("div", {}, h("h1", { text: "登录会话" }), h("p", { class: "muted small", text: "所有登录了你账户的手机和电脑。不认识的会话请立即踢出并修改密码。" })),
          others ? h("button", { class: "btn danger", onclick: function () { confirmDialog({ title: "踢出其它全部会话？", body: "除了当前设备，其它 " + others + " 个会话都会立即退出登录。", ok: "全部踢出", danger: true }).then(function (y) { if (y) api("POST", "/api/sessions/revoke", { all: true }).then(function () { toast("已踢出其它会话"); sessions(); }); }); } }, "踢出其它全部") : null),
        h("div", { class: "card list" }, items),
        h("div", { class: "row", }, h("button", { class: "btn ghost", onclick: logout }, icon("logout"), "退出当前设备"))]);
    }, function (e) { errorState("#/sessions", e, sessions); });
  }
  function logout() { confirmDialog({ title: "退出登录？", body: "退出后需要重新输入密码和验证码。", ok: "退出" }).then(function (y) { if (y) api("POST", "/api/auth/logout").then(function () { me = null; location.hash = "#/"; route(); }); }); }

  // ---------- audit ----------
  var ACTIONS = {
    "setup": ["首次设置", "acct"], "login": ["登录成功", "login"], "login.password": ["密码错误", "login"], "login.totp": ["验证码错误", "login"], "logout": ["退出登录", "login"],
    "session.revoke": ["踢出会话", "session"], "password.change": ["修改密码", "acct"], "totp.rebind": ["重新绑定两步验证", "acct"],
    "enroll.code": ["生成登记码", "device"], "device.enroll": ["设备登记", "device"], "device.activate": ["激活设备", "device"], "device.revoke": ["移除设备", "device"],
    "device.connect": ["设备上线", "device"], "device.disconnect": ["设备离线", "device"], "service.open": ["打开 DSH", "device"],
  };
  function audit() {
    clearTimer(); loading("#/audit");
    var filter = "all", q = "";
    var names = {};
    Promise.all([api("GET", "/api/audit"), api("GET", "/api/devices").catch(function () { return []; })]).then(function (res) {
      var list = res[0]; res[1].forEach(function (d) { names[d.id] = d.name; if (d.services) d.services.forEach(function (x) { names[x.host] = d.name + " · " + x.name; }); });
      var tbody = h("tbody"), count = h("span", { class: "muted small" });
      var bad = function (a) { return a.result === "fail" || a.result === "bad code"; };
      function draw() {
        var rows = list.filter(function (a) {
          var cat = (ACTIONS[a.action] || [a.action, "other"])[1];
          if (filter === "fail" && !bad(a)) return false; if (filter !== "all" && filter !== "fail" && cat !== filter) return false;
          if (q) { var s = ((ACTIONS[a.action] || [a.action])[0] + " " + a.action + " " + a.user + " " + a.ip + " " + a.target).toLowerCase(); if (s.indexOf(q) < 0) return false; }
          return true;
        });
        count.textContent = rows.length + " 条";
        tbody.replaceChildren.apply(tbody, rows.length ? rows.map(function (a) {
          var lab = (ACTIONS[a.action] || [a.action])[0];
          return h("tr", {}, h("td", { class: "c-act" }, h("div", { class: "row" }, h("span", { class: "chip " + (bad(a) ? "bad" : a.result === "ok" ? "ok" : a.result === "pending" ? "warn" : ""), text: bad(a) ? "失败" : a.result === "ok" ? "成功" : a.result === "pending" ? "待激活" : "记录" }), h("b", { text: lab }))),
            h("td", { class: "c-target" + (names[a.target] ? "" : " mono"), text: names[a.target] || a.target || "" }), h("td", { class: "c-user", text: a.user || "-" }), h("td", { class: "c-ip mono", text: a.ip || "" }), h("td", { class: "c-time", text: fmt(a.ts) + " · " + ago(a.ts) }));
        }) : [h("tr", {}, h("td", { colspan: "5" }, h("div", { class: "empty" }, h("div", { class: "art" }, icon("search")), h("h3", { text: "没有匹配的记录" }), h("p", { text: "换个筛选条件试试。" }))))]);
      }
      var seg = h("div", { class: "seg", role: "tablist" }, [["all", "全部"], ["login", "登录"], ["device", "设备"], ["session", "会话"], ["acct", "账户"], ["fail", "失败"]].map(function (f) {
        return h("button", { class: f[0] === filter ? "on" : "", "data-filter": f[0], onclick: function (e) { filter = f[0]; seg.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b === e.currentTarget); }); draw(); } }, f[1]);
      }));
      var search = input("audit-q", { placeholder: "搜索操作、IP、设备…", type: "search" });
      search.addEventListener("input", function () { q = search.value.trim().toLowerCase(); draw(); });
      shell("#/audit", [h("div", { class: "section-title" }, h("div", {}, h("h1", { text: "审计日志" }), h("p", { class: "muted small", text: "最近 200 条操作记录，保留 180 天。" })), count),
        h("div", { class: "toolbar" }, seg, h("div", { class: "search" }, icon("search"), search)),
        h("div", { class: "card" }, h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, h("th", { text: "操作" }), h("th", { text: "对象" }), h("th", { text: "用户" }), h("th", { text: "IP" }), h("th", { text: "时间" }))), tbody))]);
      draw();
    }, function (e) { errorState("#/audit", e, audit); });
  }

  // ---------- settings ----------
  function settings() {
    clearTimer();
    var cur = input("pw-current", { type: "password", autocomplete: "current-password" });
    var nw = input("pw-new", { type: "password", autocomplete: "new-password", placeholder: "至少 10 位" });
    var nw2 = input("pw-new2", { type: "password", autocomplete: "new-password" });
    var save = h("button", { class: "btn primary", type: "submit", text: "修改密码" });
    var pwCard = h("form", { class: "card pad stack lg", onsubmit: function (e) { e.preventDefault(); setErr("", "pw-err");
        if (nw.value.length < 10) return setErr("新密码至少 10 位", "pw-err"); if (nw.value !== nw2.value) return setErr("两次输入的新密码不一致", "pw-err");
        busy(save, true, "保存中");
        api("POST", "/api/me/password", { current: cur.value, new: nw.value }).then(function () { busy(save, false); cur.value = nw.value = nw2.value = ""; nw.dispatchEvent(new Event("input")); toast("密码已修改，其它会话已退出"); }, function (e) { busy(save, false); setErr(e.message, "pw-err"); }); } },
      h("div", {}, h("h2", { text: "修改密码" }), h("p", { class: "muted small", text: "修改后，除当前设备外的所有会话都会退出登录。" })),
      field("当前密码", cur), h("div", { class: "stack" }, field("新密码", nw), meter(nw)), field("确认新密码", nw2), errLine("pw-err"), h("div", {}, save));
    var totpBody = h("div", { class: "stack lg" });
    function totpStart() {
      var pw = input("totp-pw", { type: "password", autocomplete: "current-password", placeholder: "输入当前密码以继续" });
      var go = h("button", { class: "btn", type: "submit", text: "开始重新绑定" });
      totpBody.replaceChildren(h("div", {}, h("h2", { text: "两步验证" }), h("p", { class: "muted small", text: "换手机或验证器 App 时，在这里重新绑定。旧的验证码会立即失效。" })),
        h("div", { class: "row" }, h("span", { class: "chip ok" }, icon("check"), "已启用"), h("span", { class: "muted small", text: "基于时间的 6 位验证码（TOTP）" })),
        h("form", { class: "stack", onsubmit: function (e) { e.preventDefault(); setErr("", "totp-err"); busy(go, true, "验证中");
          api("POST", "/api/me/totp/begin", { password: pw.value }).then(totpBind, function (e) { busy(go, false); setErr(e.message, "totp-err"); }); } }, field("当前密码", pw), errLine("totp-err"), h("div", {}, go)));
    }
    function totpBind(r) {
      var c = otpInput("totp-code", function () { fin.click(); });
      var fin = h("button", { class: "btn primary", type: "submit", text: "验证并替换" });
      totpBody.replaceChildren(h("div", {}, h("h2", { text: "扫描新的二维码" }), h("p", { class: "muted small", text: "用新的验证器 App 扫描，然后输入它显示的验证码。10 分钟内有效。" })),
        h("div", { class: "qr" }, qrImg(r.uri)), h("div", { class: "secret" }, h("span", { text: r.secret.replace(/(.{4})/g, "$1 ").trim() }), h("button", { class: "btn sm ghost", type: "button", onclick: function () { copy(r.secret, "密钥"); } }, icon("copy"), "复制")),
        h("form", { class: "stack", onsubmit: function (e) { e.preventDefault(); setErr("", "totp-err"); busy(fin, true, "验证中");
          api("POST", "/api/me/totp/finish", { code: c.value }).then(function () { toast("两步验证已重新绑定"); totpStart(); }, function (e) { busy(fin, false); setErr(e.message, "totp-err"); c.select(); }); } },
          field("新的 6 位验证码", c), errLine("totp-err"), h("div", { class: "row" }, h("button", { class: "btn", type: "button", text: "取消", onclick: totpStart }), fin)));
      setTimeout(function () { c.focus(); }, 30);
    }
    totpStart();
    shell("#/settings", [h("div", { class: "section-title" }, h("div", {}, h("h1", { text: "设置" }), h("p", { class: "muted small", text: "当前账户：" + (me ? me.username : "") })),
        h("button", { class: "btn", onclick: logout }, icon("logout"), "退出登录")),
      h("div", { class: "two" }, pwCard, h("div", { class: "card pad" }, totpBody))]);
  }

  // ---------- router ----------
  function route() {
    clearTimer();
    document.querySelectorAll("dialog").forEach(function (d) { d.remove(); });
    api("GET", "/api/state").then(function (s) {
      if (s.setupRequired) return setup();
      if (!s.authenticated) return login();
      var go = function () {
        var hsh = location.hash || "#/", m;
        if ((m = /^#\/devices\/([\w-]+)/.exec(hsh))) return deviceDetail(m[1]);
        if (hsh === "#/sessions") return sessions();
        if (hsh === "#/audit") return audit();
        if (hsh === "#/settings") return settings();
        return dashboard();
      };
      if (me) return go();
      api("GET", "/api/me").then(function (m) { me = m; go(); }, function () { login(); });
    }, function (e) {
      app.className = ""; app.replaceChildren(h("div", { class: "auth" }, h("div", { class: "panel" }, brand(), h("div", { class: "card empty" }, h("div", { class: "art" }, icon("alert")), h("h3", { text: "无法连接到 Hub" }), h("p", { text: e.message }), h("button", { class: "btn", onclick: route }, icon("refresh"), "重试")))));
    });
  }
  window.addEventListener("hashchange", route);
  route();
})();
