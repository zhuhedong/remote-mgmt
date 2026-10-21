(function(){
"use strict";
var app=document.getElementById("app");
function el(t,a){var e=document.createElement(t);a=a||{};for(var k in a){if(k==="text")e.textContent=a[k];else if(k.slice(0,2)==="on")e.addEventListener(k.slice(2),a[k]);else e.setAttribute(k,a[k]);}
for(var i=2;i<arguments.length;i++){var c=arguments[i];if(c==null)continue;e.appendChild(typeof c==="string"?document.createTextNode(c):c);}return e;}
function api(m,p,b){return fetch(p,{method:m,headers:{"Content-Type":"application/json","X-Hub":"1"},body:b?JSON.stringify(b):undefined,credentials:"same-origin"}).then(function(r){return r.json().catch(function(){return{};}).then(function(j){if(!r.ok)throw new Error(j.error||("HTTP "+r.status));return j;});});}
function input(id,ph,type){return el("input",{id:id,placeholder:ph,type:type||"text",autocomplete:"off"});}
function v(id){return document.getElementById(id).value;}
function show(){app.textContent="";for(var i=0;i<arguments.length;i++)app.appendChild(arguments[i]);}
function errBox(){return el("div",{class:"err",id:"err"});}
function fail(e){var b=document.getElementById("err");if(b)b.textContent=e.message;}
function t(ts){return ts?new Date(ts*1000).toLocaleString():"-";}

function setup(){
  var step2=el("div");
  show(el("div",{class:"card"},el("h3",{text:"首次设置"}),el("p",{class:"muted",text:"在服务器 data 目录的 setup-token 文件里找到一次性设置令牌。"}),
    input("tok","设置令牌","password"),el("button",{text:"下一步",onclick:function(){api("POST","/api/auth/setup/begin",{token:v("tok")}).then(function(r){
      step2.textContent="";step2.appendChild(el("p",{text:"在验证器 App 里添加以下密钥（或用 otpauth 链接）："}));step2.appendChild(el("p",null,el("code",{text:r.secret})));
      step2.appendChild(input("u","用户名"));step2.appendChild(input("p","密码（至少 10 位）","password"));step2.appendChild(input("c","验证器 6 位码"));
      step2.appendChild(el("button",{text:"完成设置",onclick:function(){api("POST","/api/auth/setup/finish",{token:v("tok"),username:v("u"),password:v("p"),code:v("c")}).then(route).catch(fail);}}));
    }).catch(fail);}}),step2,errBox()));
}
function login(){
  show(el("div",{class:"card"},el("h3",{text:"登录"}),input("u","用户名"),input("p","密码","password"),
    el("button",{text:"下一步",onclick:function(){api("POST","/api/auth/login",{username:v("u"),password:v("p")}).then(totp).catch(fail);}}),errBox()));
}
function totp(){
  show(el("div",{class:"card"},el("h3",{text:"两步验证"}),input("c","验证器 6 位码"),
    el("button",{text:"登录",onclick:function(){api("POST","/api/auth/totp",{code:v("c")}).then(route).catch(fail);}}),errBox()));
}
function nav(){return el("nav",null,el("button",{text:"设备",onclick:devices}),el("button",{text:"会话",onclick:sessions}),el("button",{text:"审计",onclick:audit}),
  el("button",{text:"退出",class:"sec",onclick:function(){api("POST","/api/auth/logout").then(route);}}));}
function devices(){
  api("GET","/api/devices").then(function(list){
    var cards=list.map(function(d){
      var box=el("div",{class:"card"},el("div",null,el("span",{class:"dot "+(d.online?"on":"off")}),el("b",{text:d.name}),el("span",{class:"muted",text:"  "+(d.online?"在线":"离线 · 最后在线 "+t(d.lastSeen))})),
        el("div",{class:"muted",text:"状态 "+d.status+" · 指纹 "+d.fingerprint+(d.versions&&d.versions.plugin?" · 插件 "+d.versions.plugin:"")}));
      if(d.status==="pending"){var fp=input("fp-"+d.id,"在 DSH 侧栏看到的指纹（前 6 位以上）");box.appendChild(fp);
        box.appendChild(el("button",{text:"核对指纹并激活",onclick:function(){api("POST","/api/devices/activate",{id:d.id,fingerprint:fp.value}).then(devices).catch(fail);}}));}
      if(d.status==="active")d.services.forEach(function(s){box.appendChild(el("button",{text:"打开 "+s.name,onclick:function(){api("POST","/api/open",{device:d.id,service:s.id}).then(function(r){location.href=r.url;}).catch(fail);}}));});
      box.appendChild(el("button",{text:"移除设备",class:"danger",onclick:function(){if(confirm("确定移除 "+d.name+"？设备将立即断开且无法重连。"))api("POST","/api/devices/revoke",{id:d.id}).then(devices).catch(fail);}}));
      return box;});
    var add=el("div",{class:"card"},el("h3",{text:"添加设备"}),input("dn","设备名称，例如 MacBook-Pro"),el("div",{id:"code"}),
      el("button",{text:"生成登记码",onclick:function(){api("POST","/api/enroll-codes",{name:v("dn")}).then(function(r){var c=document.getElementById("code");c.textContent="";
        c.appendChild(el("p",null,"在 DSH 侧栏「远程管理」中填入 Hub 地址 ",el("code",{text:r.hub})," 和登记码 ",el("code",{text:r.code}),"（10 分钟内有效，只能用一次）"));}).catch(fail);}}));
    show.apply(null,[nav(),errBox()].concat(cards,[add]));
  }).catch(function(e){fail(e);route();});
}
function sessions(){api("GET","/api/sessions").then(function(list){
  var tb=el("table");list.forEach(function(s){tb.appendChild(el("tr",null,el("td",{text:(s.current?"（当前）":"")+s.ua.slice(0,60)}),el("td",{text:s.ip}),el("td",{text:t(s.lastSeen)}),
    el("td",null,s.current?null:el("button",{text:"踢出",class:"danger",onclick:function(){api("POST","/api/sessions/revoke",{id:s.id}).then(sessions);}}))));});
  show(nav(),el("div",{class:"card"},el("h3",{text:"我的会话"}),tb,el("button",{text:"踢出其它全部",class:"danger",onclick:function(){api("POST","/api/sessions/revoke",{all:true}).then(sessions);}})));});}
function audit(){api("GET","/api/audit").then(function(list){var tb=el("table");list.forEach(function(a){tb.appendChild(el("tr",null,el("td",{text:t(a.ts)}),el("td",{text:a.user}),el("td",{text:a.action}),el("td",{text:a.target}),el("td",{text:a.result}),el("td",{text:a.ip})));});
  show(nav(),el("div",{class:"card"},el("h3",{text:"审计日志"}),tb));});}
function route(){api("GET","/api/state").then(function(s){if(s.setupRequired)return setup();if(!s.authenticated)return login();api("GET","/api/me").then(function(m){document.getElementById("who").textContent=m.username;});devices();});}
route();
})();
