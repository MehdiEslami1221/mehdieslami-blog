import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import worker, { passwordRecord } from "../reactions/worker.mjs";
import { setup } from "./helpers/worker.mjs";
const site="https://blog.mehdieslami.ir", host="https://reactions.example";
const password="Local-Test-Password-123456";
async function configured(t) {
 const result=setup(t);
 result.sqlite.prepare("INSERT INTO settings(key,value) VALUES('admin-password',?)").run(JSON.stringify(await passwordRecord(password)));
 const send=async(path,{body,cookie,csrf,origin=host,ip="192.0.2.9",method=body?"POST":"GET"}={})=>{
  const response=await worker.fetch(new Request(host+path,{method,headers:{...(origin?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...(csrf?{"X-CSRF-Token":csrf}:{}),...(body?{"Content-Type":"application/json"}:{}),"CF-Connecting-IP":ip},...(body?{body:JSON.stringify(body)}:{})}),result.env);
  const text=await response.text();let data;try{data=JSON.parse(text)}catch{data=text}
  return {status:response.status,data,headers:response.headers};
 };
 const login=async()=>{const r=await send('/admin/api/login',{body:{password}});assert.equal(r.status,200);return {cookie:r.headers.get('Set-Cookie').split(';')[0],csrf:r.data.csrf};};
 const post=async(change={})=>{
  const body={id:randomBytes(16).toString('hex'),postId:"fa-one",name:"Reader",body:"Private pending opinion",language:"en",...change};
  const r=await worker.fetch(new Request(host+'/v1/comments',{method:'POST',headers:{Origin:site,"X-Voter-ID":"a".repeat(64),"CF-Connecting-IP":"192.0.2.10","Content-Type":"application/json"},body:JSON.stringify(body)}),result.env);
  return {status:r.status,data:await r.json(),body};
 };
 const read=async(query='post=fa-one')=>{const r=await worker.fetch(new Request(host+'/v1/comments?'+query,{headers:{Origin:site}}),result.env);return {status:r.status,data:await r.json()};};
 return {...result,send,login,post,read};
}
test("New and legacy comments stay private until approval, including reply endpoints and translated lists",async t=>{
 const {sqlite,post,read,send,login}=await configured(t);
 const pending=await post();assert.equal(pending.data.status,'pending');assert.ok(!pending.data.comment);
 assert.deepEqual((await read()).data.threads,[]);assert.deepEqual((await read('post=en-one')).data.threads,[]);
 assert.equal((await read('post=en-one&parent='+pending.body.id)).status,404);
 const auth=await login();const queue=await send('/admin/api/comments',auth);assert.equal(queue.data.comments.length,1);assert.equal(queue.data.comments[0].body,pending.body.body);
 assert.ok(!JSON.stringify(queue.data).includes('voter'));assert.ok(!JSON.stringify(queue.data).includes('token_hash'));
 assert.equal((await send('/admin/api/moderate',{...auth,body:{id:pending.body.id,state:'approved'}})).status,200);
 assert.equal((await read('post=en-one')).data.threads[0].body,pending.body.body);
 const reply=await post({postId:'en-one',parentId:pending.body.id,body:'Unreviewed reply'});
 assert.equal(reply.data.status,'pending');assert.equal((await read()).data.threads[0].replies.length,0);
 assert.equal((await read('post=en-one&parent='+pending.body.id)).data.comments.length,0);
 await send('/admin/api/moderate',{...auth,body:{id:reply.body.id,state:'approved'}});
 assert.equal((await read()).data.threads[0].replies.length,1);
 await send('/admin/api/moderate',{...auth,body:{id:pending.body.id,state:'removed'}});
 assert.equal((await read()).data.threads.length,0);assert.equal((await read('post=en-one&parent='+pending.body.id)).status,404);
 assert.equal(sqlite.prepare('SELECT body FROM comments WHERE id=?').get(pending.body.id).body,pending.body.body);
 await send('/admin/api/moderate',{...auth,body:{id:pending.body.id,state:'approved'}});
 assert.equal((await read()).data.threads[0].replies.length,1);
});
test("Private moderation requires server-side authentication, secure session cookies, same origin and CSRF",async t=>{
 const {send,login,post,sqlite}=await configured(t);const pending=await post();
 assert.equal((await send('/admin/api/comments')).status,401);
 assert.equal((await send('/admin/api/login',{body:{password},origin:site})).status,403);
 assert.equal((await send('/admin/api/login',{body:{password},origin:null})).status,403);
 const wrong=await send('/admin/api/login',{body:{password:'wrong'}});assert.equal(wrong.status,401);
 const successful=await send('/admin/api/login',{body:{password}});
 assert.match(successful.headers.get('Set-Cookie'),/__Host-journal-admin=.*Path=\/; HttpOnly; Secure; SameSite=Strict/);
 assert.ok(!successful.headers.has('Access-Control-Allow-Origin'));
 const auth={cookie:successful.headers.get('Set-Cookie').split(';')[0],csrf:successful.data.csrf};
 assert.equal((await send('/admin/api/moderate',{cookie:auth.cookie,body:{id:pending.body.id,state:'approved'}})).status,403);
 assert.equal((await send('/admin/api/moderate',{...auth,origin:'https://evil.example',body:{id:pending.body.id,state:'approved'}})).status,403);
 assert.equal((await send('/admin/api/moderate',{...auth,csrf:'fake',body:{id:pending.body.id,state:'approved'}})).status,403);
 assert.equal((await send('/admin/api/moderate',{...auth,body:{id:pending.body.id,state:'admin'}})).status,400);
 assert.equal((await send('/admin/api/moderate',{...auth,body:{id:pending.body.id,state:'rejected'}})).status,200);
 assert.equal(sqlite.prepare('SELECT state FROM comment_moderation WHERE comment_id=?').get(pending.body.id).state,'rejected');
 await send('/admin/api/logout',{...auth,body:{}});assert.equal((await send('/admin/api/comments',auth)).status,401);
 const auth2=await login();sqlite.prepare('UPDATE admin_sessions SET expires_at=?').run(Date.now()-1);
 assert.equal((await send('/admin/api/comments',auth2)).status,401);
});
test("Password rotation revokes all sessions, keeps only a verifier and preserves comments and votes",async t=>{
 const {send,login,post,sqlite}=await configured(t);const p=await post();const first=await login(),second=await login();
 sqlite.prepare("INSERT INTO settings(key,value) VALUES('admin-bootstrap-envelope','encrypted')").run();
 assert.equal((await send('/admin/api/password',{...first,body:{currentPassword:'incorrect',newPassword:'An-Entirely-New-Password-4567'}})).status,401);
 const updated=await send('/admin/api/password',{...first,body:{currentPassword:password,newPassword:'An-Entirely-New-Password-4567'}});
 assert.equal(updated.status,200);assert.match(updated.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.equal((await send('/admin/api/session',second)).status,401);
 assert.equal((await send('/admin/api/login',{body:{password:'An-Entirely-New-Password-4567'},ip:'192.0.2.22'})).status,200);
 const saved=sqlite.prepare("SELECT value FROM settings WHERE key='admin-password'").get().value;
 assert.ok(!saved.includes(password));assert.ok(!saved.includes('An-Entirely-New-Password-4567'));
 assert.equal(sqlite.prepare("SELECT value FROM settings WHERE key='admin-bootstrap-envelope'").get(),undefined);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM comments').get().n,1);
 assert.equal(sqlite.prepare('SELECT id FROM comments').get().id,p.body.id);
});
test("Login attempts are rate limited and admin HTML/scripts have restrictive security headers",async t=>{
 const {send}=await configured(t);
 for(let i=0;i<5;i++)assert.equal((await send('/admin/api/login',{body:{password:'wrong'}})).status,401);
 const limited=await send('/admin/api/login',{body:{password}});assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'900');
 const page=await send('/admin/');assert.equal(page.status,200);assert.match(page.data,/مدیریت دیدگاه‌ها/);
 assert.match(page.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);assert.equal(page.headers.get('Cache-Control'),'no-store');
 assert.equal(page.headers.get('X-Frame-Options'),'DENY');assert.ok(!page.data.includes(password));
 const js=await send('/admin/app.js');assert.equal(js.status,200);assert.ok(!js.data.includes('innerHTML'));assert.ok(!js.data.includes(password));
});

test("A replacement login cookie requires its own CSRF value and exposes the pending parent ID for review",async t=>{
 const {send,login,post}=await configured(t);const root=await post();const first=await login();
 await send('/admin/api/moderate',{...first,body:{id:root.body.id,state:'approved'}});
 const reply=await post({parentId:root.body.id,body:'Reply waiting for review'});
 const second=await login();
 assert.equal((await send('/admin/api/moderate',{cookie:second.cookie,csrf:first.csrf,body:{id:reply.body.id,state:'approved'}})).status,403);
 const fresh=await send('/admin/api/session',{cookie:second.cookie});assert.equal(fresh.data.csrf,second.csrf);
 assert.equal((await send('/admin/api/moderate',{cookie:second.cookie,csrf:fresh.data.csrf,body:{id:reply.body.id,state:'approved'}})).status,200);
 const queue=await send('/admin/api/comments?state=approved',second);
 assert.equal(queue.data.comments.find(c=>c.id===reply.body.id).parent.id,root.body.id);
 assert.equal(queue.data.comments.find(c=>c.id===reply.body.id).parent.authorRemoved,false);
});
