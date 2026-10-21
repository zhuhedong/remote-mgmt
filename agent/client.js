/* dsh-remote-agent web client: a "远程" entry in the sidebar footer (same slot
 * mechanism as dsh-cloudflare-tunnel) opening a panel for enrollment & status.
 * Calls the server through ctx.connection.rpc.call("/dsh-remote-agent", ep, payload). */
(function () {
  if (typeof window === "undefined" || !window.__ModuleLoader__) return;
  window.__ModuleLoader__.load({
    id: "dsh-remote-agent",
    factory: function (require) {
      var module = { exports: {} };
      var React = require("react");
      var ReactDOM = null; try { ReactDOM = require("react-dom"); } catch (_) {}
      var h = React.createElement;
      var PREFIX = "/dsh-remote-agent";
      var css = {
        mask: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" },
        panel: { background: "var(--dsw-alias-bg-elevated, #1d2026)", color: "inherit", borderRadius: "12px", padding: "18px 20px", width: "min(520px, 92vw)", maxHeight: "86vh", overflow: "auto", boxShadow: "0 10px 40px rgba(0,0,0,.4)", fontSize: "13px" },
        row: { display: "flex", alignItems: "center", gap: "8px", margin: "6px 0" }, k: { width: "84px", opacity: 0.7, flex: "none" },
        input: { flex: 1, padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--dsw-alias-border-default, #444)", background: "transparent", color: "inherit" },
        act: { padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--dsw-alias-border-default, #555)", background: "transparent", color: "inherit", cursor: "pointer" },
        btn: { display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "6px 10px", border: 0, borderRadius: "8px", background: "transparent", color: "inherit", cursor: "pointer" },
        warn: { background: "rgba(255,170,0,.12)", border: "1px solid rgba(255,170,0,.4)", borderRadius: "8px", padding: "8px", margin: "8px 0" },
      };
      var LABEL = { online: "● 已连接", connecting: "连接中…", waiting: "等待重连", pending: "等待在 Hub 激活", revoked: "已被 Hub 移除", stopped: "已断开", "not-enrolled": "未登记", idle: "空闲" };
      function Icon() { return h("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 }, h("rect", { x: 3, y: 4, width: 18, height: 12, rx: 2 }), h("path", { d: "M8 20h8M12 16v4" })); }
      function Panel(props) {
        var s = React.useState(null), st = s[0], setSt = s[1];
        var e = React.useState(""), err = e[0], setErr = e[1];
        var b = React.useState(""), busy = b[0], setBusy = b[1];
        var f = React.useState({ hub: "", code: "" }), form = f[0], setForm = f[1];
        var run = function (ep, p) { setBusy(ep); setErr(""); return props.control(ep, p).then(function (v) { setSt(v); setBusy(""); return v; }, function (x) { setErr(String(x.message || x)); setBusy(""); }); };
        React.useEffect(function () { run("status"); var t = setInterval(function () { props.control("status").then(setSt, function () {}); }, 3000); return function () { clearInterval(t); }; }, []);
        if (!st) return h("div", { style: css.panel, onClick: function (ev) { ev.stopPropagation(); } }, "读取中…");
        var enrolled = st.enrolled && !st.revoked;
        return h("div", { style: css.panel, onClick: function (ev) { ev.stopPropagation(); } },
          h("div", { style: { display: "flex", justifyContent: "space-between" } }, h("b", null, "远程管理"), h("button", { style: css.act, onClick: props.onClose }, "关闭")),
          h("div", { style: css.row }, h("span", { style: css.k }, "状态"), h("span", null, (LABEL[st.state] || st.state) + (st.rtt != null && st.state === "online" ? "（延迟 " + st.rtt + "ms）" : ""))),
          st.lastError && st.state !== "online" ? h("div", { style: { opacity: 0.75 } }, st.lastError) : null,
          h("div", { style: css.row }, h("span", { style: css.k }, "Hub"), h("span", null, st.hub)),
          enrolled ? h(React.Fragment, null,
            h("div", { style: css.row }, h("span", { style: css.k }, "实例"), h("span", null, st.name)),
            h("div", { style: css.row }, h("span", { style: css.k }, "指纹"), h("code", null, st.fingerprint || "-"), h("span", { style: { opacity: 0.6 } }, "在 Hub 控制台核对后激活")),
            h("div", { style: css.row }, h("span", { style: css.k }, "访问地址"), h("span", null, st.url || "-")),
            h("div", { style: css.row }, h("span", { style: css.k }, "密钥存储"), h("span", null, st.keyStore === "keychain" ? "macOS 钥匙串" : st.keyStore === "file" ? "加密文件" : "-")),
            h("div", { style: css.row },
              st.state === "stopped" ? h("button", { style: css.act, disabled: !!busy, onClick: function () { run("connect"); } }, "连接") : h("button", { style: css.act, disabled: !!busy, onClick: function () { run("disconnect"); } }, "断开"),
              h("button", { style: css.act, disabled: !!busy, onClick: function () { if (confirm("清除本机设备密钥并解除登记？之后需要新的登记码。")) run("forget"); } }, "解除登记"))
          ) : h(React.Fragment, null,
            h("div", { style: { opacity: 0.75, margin: "6px 0" } }, "在 Hub 控制台「添加设备」获取登记码（10 分钟内有效，只能用一次）。"),
            h("div", { style: css.row }, h("span", { style: css.k }, "Hub 地址"), h("input", { style: css.input, placeholder: st.hub, value: form.hub, onChange: function (ev) { setForm(Object.assign({}, form, { hub: ev.target.value })); } })),
            h("div", { style: css.row }, h("span", { style: css.k }, "登记码"), h("input", { style: css.input, placeholder: "XXXX-XXXX-XXXX", value: form.code, autoComplete: "off", onChange: function (ev) { setForm(Object.assign({}, form, { code: ev.target.value })); } })),
            h("button", { style: css.act, disabled: !!busy || !form.code, onClick: function () { run("enroll", { hub: form.hub || st.hub, code: form.code }).then(function (v) { if (v) setForm({ hub: "", code: "" }); }); } }, busy === "enroll" ? "登记中…" : "登记")),
          st.restartNeeded ? h("div", { style: css.warn }, "已把访问域名加入 DSH 的 trustedHosts，需要重启 DSH 才生效。重启后点：",
            h("button", { style: Object.assign({}, css.act, { marginLeft: "6px" }), onClick: function () { run("restart.done"); } }, "我已重启")) : null,
          st.recent && st.recent.length ? h("div", { style: { marginTop: "10px" } }, h("div", { style: { opacity: 0.7 } }, "最近远程操作"),
            st.recent.map(function (r, i) { return h("div", { key: i, style: { opacity: 0.85 } }, new Date(r.ts).toLocaleTimeString() + "  " + r.text); })) : null,
          err ? h("div", { style: { color: "#f77", marginTop: "8px" } }, err) : null);
      }
      function Action(props) {
        var o = React.useState(false), open = o[0], setOpen = o[1];
        var iconOnly = props.wide === false;
        var modal = open ? h("div", { style: css.mask, onClick: function () { setOpen(false); } }, h(Panel, { control: props.control, onClose: function () { setOpen(false); } })) : null;
        return h(React.Fragment, null,
          h("button", { style: Object.assign({}, css.btn, iconOnly ? { width: "36px", justifyContent: "center", padding: "6px" } : {}), title: "远程管理", "aria-label": "远程管理", onClick: function () { setOpen(true); },
            onMouseEnter: function (e) { e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover)"; }, onMouseLeave: function (e) { e.currentTarget.style.background = "transparent"; } }, h(Icon), iconOnly ? null : "远程"),
          modal && ReactDOM && ReactDOM.createPortal ? ReactDOM.createPortal(modal, document.body) : modal);
      }
      var inject = ["connection", "slots"];
      function apply(ctx) {
        var control = function (ep, p) { return Promise.resolve(ctx.connection.rpc.call(PREFIX, ep, p || {})).then(function (r) { if (r && r.ok === false) throw new Error((r.error && r.error.message) || "请求失败"); return r && "value" in r ? r.value : r; }); };
        ctx.slots.inject("sidebar.footer.action", function () { return ctx.slots.register({ name: "sidebar.footer.action", id: "dsh-remote-agent", order: -19, inject: function () { return { control: control }; } }, Action); });
      }
      module.exports = { name: "dsh-remote-agent", inject: inject, apply: apply };
      return module.exports;
    },
  });
})();
