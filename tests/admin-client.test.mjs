import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { adminPage, adminScript } from "../reactions/admin-page.mjs";
const sample = {id:"a".repeat(32),name:"Reader",status:"pending",createdAt:"2026-11-28T00:00:00Z",body:"A test comment",published:true,article:null,postId:"post-one",parent:null,authorRemoved:false};
const response = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
const page = (comments=[sample]) => ({comments,next:null,counts:{pending:comments.length}});
async function ready(check) { for(let i=0;i<60;i++) { if(check())return;await new Promise(setImmediate); }assert.ok(check(),"Client did not settle"); }
function setup(t,fetch) {
  const dom=new JSDOM(adminPage,{url:"https://moderation.example/admin/",runScripts:"outside-only"});
  dom.window.fetch=fetch;dom.window.AbortSignal=AbortSignal;dom.window.eval(adminScript);
  t.after(()=>dom.window.close());return dom.window.document;
}
test("Controls remain locked during queue loads; newly rendered actions become usable after completion",async t=>{
  let finish;const wait=new Promise(resolve=>finish=resolve);
  const doc=setup(t,async path=>path.endsWith("session")?response({csrf:"session-a"}):(await wait,response(page())));
  await ready(()=>!doc.querySelector('#dashboard').hidden);
  assert.equal(doc.querySelector('#filter').disabled,true);assert.equal(doc.querySelector('#refresh').disabled,true);
  finish();await ready(()=>doc.querySelector('.card button')&&!doc.querySelector('#filter').disabled);
  assert.ok([...doc.querySelectorAll('.card button')].every(b=>!b.disabled));
  assert.equal(doc.querySelector('#dashboard').getAttribute('aria-busy'),'false');
});
test("A changed session cookie recovers CSRF once and completes the original approval",async t=>{
  let sessions=0,writes=0,approved=false;
  const doc=setup(t,async(path,options)=>{
    if(path.endsWith('session'))return response({csrf:++sessions===1?'old-tab':'new-cookie-session'});
    if(path.endsWith('moderate')){writes++;if(options.headers['X-CSRF-Token']!=='new-cookie-session')return response({error:'csrf_required'},403);approved=true;return response({ok:true});}
    return response(page(approved?[]:[sample]));
  });
  await ready(()=>doc.querySelector('.card button')&&!doc.querySelector('#refresh').disabled);
  doc.querySelector('.card button').click();
  await ready(()=>doc.querySelector('#feedback').textContent.includes('تأییدشده'));
  assert.equal(sessions,2);assert.equal(writes,2);assert.equal(approved,true);
  assert.equal(doc.querySelectorAll('.card').length,0);
});
test("A successful moderation write followed by a failed refresh is reported as saved",async t=>{
  let written=false;
  const doc=setup(t,async path=>{
    if(path.endsWith('session'))return response({csrf:'session'});
    if(path.endsWith('moderate')){written=true;return response({ok:true});}
    if(written)return response({error:'unavailable'},503);
    return response(page());
  });
  await ready(()=>doc.querySelector('.card button')&&!doc.querySelector('#refresh').disabled);doc.querySelector('.card button').click();
  await ready(()=>doc.querySelector('#feedback').textContent.includes('فهرست به‌روز نشد'));
  assert.match(doc.querySelector('#feedback').textContent,/وضعیت نظر ثبت شد: تأییدشده/);
  assert.equal(doc.querySelector('#refresh').disabled,false);
});
test("A pending parent has a distinct approval action and a reply is approved separately",async t=>{
  const writes=[];let parentApproved=false;
  const reply={...sample,parent:{id:'b'.repeat(32),name:'Parent',body:'Parent content',status:'pending',authorRemoved:false}};
  const doc=setup(t,async(path,options)=>{
    if(path.endsWith('session'))return response({csrf:'session'});
    if(path.endsWith('moderate')){writes.push(JSON.parse(options.body));parentApproved=true;return response({ok:true});}
    return response(page([{...reply,parent:{...reply.parent,status:parentApproved?'approved':'pending'}}]));
  });
  await ready(()=>doc.querySelector('.parent button')&&!doc.querySelector('#refresh').disabled);
  assert.equal(doc.querySelector('.parent button').textContent,'تأیید نظر اصلی');doc.querySelector('.parent button').click();
  await ready(()=>writes.length===1&&!doc.querySelector('#refresh').disabled);
  assert.deepEqual(writes[0],{id:reply.parent.id,state:'approved'});
  assert.equal(doc.querySelector('.parent button'),null);
  doc.querySelector('.actions button').click();await ready(()=>writes.length===2&&!doc.querySelector('#refresh').disabled);
  assert.equal(writes[1].id,reply.id);
});
test("CSRF recovery retries at most once and does not hide failed moderation behind a generic message",async t=>{
  let writes=0;
  const doc=setup(t,async path=>{
    if(path.endsWith('session'))return response({csrf:'session'});
    if(path.endsWith('moderate')){writes++;return response({error:'csrf_required'},403);}
    return response(page());
  });
  await ready(()=>doc.querySelector('.actions button')&&!doc.querySelector('#refresh').disabled);doc.querySelector('.actions button').click();
  await ready(()=>doc.querySelector('#feedback').textContent.includes('نشست تغییر کرده'));
  assert.equal(writes,2);assert.equal(doc.querySelector('#refresh').disabled,false);
});
test("The moderation shell applies the supplied IRANSansX files to text and form controls",async t=>{
  const doc=setup(t,async()=>response({error:'unauthorized'},401));
  assert.match(doc.querySelector('style').textContent,/IRANSansX-Regular\.woff2/);
  assert.match(doc.querySelector('style').textContent,/IRANSansX-Bold\.woff2/);
  assert.match(doc.defaultView.getComputedStyle(doc.body).fontFamily,/IRANSansX/);
  await ready(()=>doc.querySelector('#feedback').textContent.includes('برای مدیریت')&&!doc.querySelector('#refresh').disabled);
});
