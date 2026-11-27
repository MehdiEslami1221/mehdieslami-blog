export const adminPage = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>مدیریت دیدگاه‌ها | مهدی اسلامی</title><style>
@font-face{font-family:IRANSansX;src:url('https://blog.mehdieslami.ir/assets/fonts/IRANSansX-Regular.woff2') format('woff2');font-weight:400;font-display:swap}@font-face{font-family:IRANSansX;src:url('https://blog.mehdieslami.ir/assets/fonts/IRANSansX-Bold.woff2') format('woff2');font-weight:700;font-display:swap}*{box-sizing:border-box}body{margin:0;background:#080e0b;color:#e4ecdf;font:15px/1.9 IRANSansX,Tahoma,Arial,sans-serif}main{max-width:1000px;margin:auto;padding:32px 20px}h1{font-size:clamp(23px,5vw,32px);margin:4px 0}h2{font-size:19px}p{color:#a8b8a1}header{display:flex;justify-content:space-between;gap:20px;align-items:center;flex-wrap:wrap}.eyebrow{color:#bdf66a;font-size:12px;letter-spacing:.05em}.card,form{padding:24px;background:#101b13;border:1px solid #b9dc9c30;border-radius:14px;margin-block:20px}#login{max-width:460px;margin:60px auto}label{display:block;margin-block:15px 6px}input,button,select{font:inherit;border:1px solid #99b98755;border-radius:8px;padding:10px 14px;min-height:46px}input{width:100%;background:#070e09;color:#edf4e6}button,select{background:#182615;color:#d6eacb;cursor:pointer}button:hover{border-color:#bdf66a}.primary{background:#bdf66a;color:#12200c;font-weight:bold}button:disabled{opacity:.5;cursor:wait}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid #bdf66a;outline-offset:4px}.toolbar,.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.toolbar{margin-block:24px}.toolbar label{margin:0}.body{white-space:pre-wrap;overflow-wrap:anywhere;color:#d7e3d0}.meta{font-size:12px;color:#9eae97}.status{border:1px solid #bdf66a40;border-radius:30px;padding:2px 12px;color:#c8e8ae}.parent{border-inline-start:2px solid #a0ca7350;padding-inline-start:14px;font-size:13px}.parent p{max-height:180px;overflow:auto}.summary{font-size:13px;color:#b5c8a8}a{color:#bdf66a;overflow-wrap:anywhere}#feedback{min-height:30px;color:#d5e9b1;position:sticky;top:0;background:#080e0bf2;padding:10px;border-radius:8px;z-index:2}small{color:#a8b8a1}.danger{color:#f1b9a9}#more{width:100%;margin-block:20px}[hidden]{display:none!important}details{margin-top:28px}summary{cursor:pointer;color:#bdf66a}#password-form{max-width:600px}.login-user{direction:ltr;color:#bdf66a}footer{margin:40px 0;color:#7e9575;font-size:12px}@media(max-width:500px){main{padding:20px 14px}.card,form{padding:18px}.actions button{flex:1 1 auto}.toolbar{align-items:stretch;flex-direction:column}.toolbar select{width:100%}}
</style><script src="/admin/app.js" defer></script></head><body><main><header><div><span class="eyebrow">ME / JOURNAL</span><h1>مدیریت دیدگاه‌ها</h1><p>بررسی و تأیید نظرها پیش از نمایش در وبلاگ</p></div><button id="logout" hidden>خروج از حساب</button></header><div id="feedback" role="status" aria-live="polite"></div>
<form id="login"><h2>ورود مدیر</h2><p>حساب مدیریت: <b class="login-user">admin</b></p><input name="username" autocomplete="username" value="admin" hidden><label for="password">رمز عبور</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" dir="ltr"><p><button class="primary" type="submit">ورود به مدیریت</button></p></form>
<section id="dashboard" hidden><p class="summary" id="summary"></p><div class="toolbar"><label for="filter">وضعیت نظرها</label><select id="filter"><option value="pending">در انتظار تأیید</option><option value="approved">تأییدشده</option><option value="rejected">ردشده</option><option value="removed">حذف‌شده</option><option value="all">همهٔ نظرها</option></select><button id="refresh" type="button">تازه‌سازی</button></div><div id="list"></div><button id="more" hidden>نظرهای قبلی</button><details><summary>تغییر رمز عبور</summary><form id="password-form"><label for="current-password">رمز فعلی</label><input id="current-password" type="password" autocomplete="current-password" required maxlength="256" dir="ltr"><label for="new-password">رمز جدید؛ دست‌کم ۱۶ نویسه</label><input id="new-password" type="password" autocomplete="new-password" required minlength="16" maxlength="256" dir="ltr"><label for="repeat-password">تکرار رمز جدید</label><input id="repeat-password" type="password" autocomplete="new-password" required minlength="16" maxlength="256" dir="ltr"><p><button type="submit">ثبت رمز جدید و خروج از همهٔ نشست‌ها</button></p><small>پس از تغییر رمز، دوباره وارد شوید.</small></form></details></section><footer>نام نویسنده را خود کاربر وارد کرده است. نظرهای تأییدنشده برای بازدیدکنندگان قابل مشاهده نیستند.</footer></main></body></html>`;
export const adminScript = String.raw`
"use strict";
const $ = s => document.querySelector(s);
const labels = {pending:"در انتظار تأیید",approved:"تأییدشده",rejected:"ردشده",removed:"حذف‌شده"};
let csrf = "", next = null, busy = false;
function node(tag,className,text) {
  const e = document.createElement(tag);
  if(className) e.className = className;
  if(text !== undefined) e.textContent = text;
  return e;
}
function tell(text) { $("#feedback").textContent = text; }
function controls(value) {
  busy = value;
  document.querySelectorAll("button").forEach(b => b.disabled = value);
  $("#filter").disabled = value;
  $("#dashboard").setAttribute("aria-busy",String(value));
}
function signedIn(value) {
  $("#login").hidden = value; $("#dashboard").hidden = !value; $("#logout").hidden = !value;
  if(!value) { csrf=""; $("#list").replaceChildren(); $("#summary").textContent=""; }
}
async function api(path,body,recover=true) {
  const res = await fetch("/admin/api/"+path, {
    method:body?"POST":"GET", credentials:"same-origin",cache:"no-store",
    headers:body?{"Content-Type":"application/json","X-CSRF-Token":csrf}:{},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)
  });
  const data = await res.json();
  if(!res.ok) {
    // A new login in another tab replaces the shared cookie, but this tab's CSRF
    // value stays in memory. Fetch the current session and retry that write once.
    if(res.status===403 && data.error==="csrf_required" && recover && body && path!=="login") {
      const current = await api("session",undefined,false);
      csrf = current.csrf;
      return api(path,body,false);
    }
    if(res.status===401 && data.error==="unauthorized") signedIn(false);
    throw new Error(data.error||"unavailable");
  }
  return data;
}
const messages = {
  invalid_password:"رمز عبور درست نیست.",unauthorized:"نشست شما پایان یافته است. دوباره وارد شوید.",
  rate_limited:"تعداد تلاش‌ها زیاد است. ۱۵ دقیقه دیگر دوباره تلاش کنید.",
  parent_not_approved:"ابتدا با دکمهٔ «تأیید نظر اصلی»، نظر بالادست را تأیید کنید؛ سپس پاسخ را تأیید کنید.",
  author_removed:"نویسنده این نظر را حذف کرده است و امکان انتشار دوبارهٔ آن وجود ندارد.",
  invalid_new_password:"رمز جدید باید بین ۱۶ تا ۲۵۶ نویسه باشد.",
  csrf_required:"نشست تغییر کرده است. صفحه را تازه کنید و دوباره وارد شوید."
};
async function perform(action) {
  if(busy) return;
  controls(true);
  try { await action(); }
  catch(e) { tell(messages[e.message]||"ارتباط با سرویس برقرار نشد. دوباره تلاش کنید."); }
  finally { controls(false); }
}
function actionButton(label,action,className="") {
  const b = node("button",className,label); b.type="button"; b.disabled=busy;
  b.addEventListener("click",()=>perform(action));
  return b;
}
async function moderate(id,state,published=true) {
  await api("moderate",{id,state});
  const saved = "وضعیت نظر ثبت شد: "+labels[state]+(!published?"؛ نوشتهٔ مرتبط فعلاً منتشر نیست.":"");
  // The write already succeeded. A failed follow-up read must not report that the
  // approval itself failed or encourage the owner to repeat a confirmed write.
  try { await load(); tell(saved); }
  catch { tell(saved+" فهرست به‌روز نشد؛ دکمهٔ تازه‌سازی را بزنید."); }
}
async function load(before) {
  const filter = $("#filter").value;
  const data = await api("comments?state="+filter+(before?"&before="+before:""));
  if(filter !== $("#filter").value) return;
  if(!before) $("#list").replaceChildren();
  next=data.next; $("#more").hidden=!next;
  $("#summary").textContent=Object.entries(labels).map(([key,label])=>label+": "+new Intl.NumberFormat("fa").format(data.counts[key]||0)).join(" · ");
  if(!data.comments.length && !before) $("#list").append(node("p","","نظری با این وضعیت وجود ندارد."));
  for(const c of data.comments) {
    const card=node("article","card"); card.dataset.commentId=c.id;
    const head=node("header"); head.append(node("bdi","",c.name||"نظر حذف‌شده"),node("span","status",labels[c.status])); card.append(head);
    card.append(node("p","meta",new Intl.DateTimeFormat("fa",{dateStyle:"medium",timeStyle:"short"}).format(new Date(c.createdAt))));
    if(c.article) {
      const a=node("a","",c.article.title);
      a.href="https://blog.mehdieslami.ir"+(c.article.language==="en"?"/en":"")+"/posts/"+encodeURIComponent(c.article.slug)+"/";
      a.target="_blank"; a.rel="noopener noreferrer"; card.append(a);
    } else card.append(node("p","meta","شناسهٔ نوشته: "+c.postId));
    if(!c.published) card.append(node("p","meta","این نوشته در فهرست انتشار فعلی نیست."));
    if(c.parent) {
      const context=node("div","parent");
      context.append(node("small","","پاسخ به "+(c.parent.name||"نظر حذف‌شده")+" · "+labels[c.parent.status]),node("p","body",c.parent.body));
      if(c.parent.id && ["pending","rejected","removed"].includes(c.parent.status) && !c.parent.authorRemoved)
        context.append(actionButton("تأیید نظر اصلی",()=>moderate(c.parent.id,"approved",c.published)));
      card.append(context);
    }
    const text=node("p","body",c.body||"متن توسط نویسنده حذف شده است."); text.dir="auto"; card.append(text);
    const actions=node("div","actions");
    if(!c.authorRemoved) for(const [state,label] of [["approved","تأیید و نمایش"],["rejected","رد نظر"],["removed","حذف از نمایش"]]) {
      if(c.status===state) continue;
      actions.append(actionButton(label,()=>moderate(c.id,state,c.published),state==="removed"?"danger":""));
    }
    card.append(actions); $("#list").append(card);
  }
}
$("#login").addEventListener("submit",event=>{
  event.preventDefault(); perform(async()=>{
    const data=await api("login",{password:$("#password").value}); $("#password").value="";
    csrf=data.csrf; signedIn(true); $("#filter").value="pending"; await load(); tell("ورود موفق بود.");
  });
});
$("#filter").addEventListener("change",()=>perform(()=>load()));
$("#refresh").addEventListener("click",()=>perform(()=>load()));
$("#more").addEventListener("click",()=>perform(()=>load(next)));
$("#logout").addEventListener("click",()=>perform(async()=>{await api("logout",{});signedIn(false);tell("از حساب خارج شدید.");}));
$("#password-form").addEventListener("submit",event=>{
  event.preventDefault();
  if($("#new-password").value!==$("#repeat-password").value) {tell("تکرار رمز با رمز جدید یکسان نیست.");return;}
  perform(async()=>{await api("password",{currentPassword:$("#current-password").value,newPassword:$("#new-password").value});$("#password-form").reset();signedIn(false);tell("رمز تغییر کرد. با رمز جدید وارد شوید.");});
});
perform(async()=>{
  try {const data=await api("session");csrf=data.csrf;signedIn(true);await load();}
  catch(e) {if(e.message!=="unauthorized")throw e;signedIn(false);tell("برای مدیریت نظرها وارد شوید.");}
});
`;
