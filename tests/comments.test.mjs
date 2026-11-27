import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setup } from "./helpers/worker.mjs";
import worker from "../reactions/worker.mjs";
const origin = "https://blog.mehdieslami.ir";
function client(env, token = "a".repeat(64), ip = "192.0.2.10") {
  return async (body, query = "post=fa-one", method = body ? "POST" : "GET") => {
    const res = await worker.fetch(new Request("https://example.test/v1/comments?" + query, {
      method, headers: { Origin: origin, "X-Voter-ID": token, "CF-Connecting-IP": ip, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    }), env);
    const data = await res.json();
    // These legacy lifecycle scenarios explicitly publish each accepted submission.
    // Moderation privacy/authentication has separate tests without this helper.
    if (res.ok && body && data.status) await env.DB.prepare("INSERT INTO comment_moderation(comment_id,state,updated_at) VALUES(?, 'approved', ?) ON CONFLICT(comment_id) DO UPDATE SET state='approved'").bind(data.id,Date.now()).run();
    return { status: res.status, data, headers: res.headers };
  };
}
function draft(change = {}) { return { id: randomBytes(16).toString("hex"), postId:"fa-one", name:"مهدی", body:"یک نظر برای آزمون", language:"fa", ...change }; }
test("Anonymous names, text, translated discussions and retry IDs persist without exposing identifiers", async t => {
  const {env,sqlite} = setup(t); const call = client(env);
  const first = draft();
  const result = await call(first);
  assert.equal(result.status,200); assert.equal(result.data.status,"pending"); const saved=(await call()).data.threads[0];assert.equal(saved.name,"مهدی");assert.equal(saved.mine,true);
  assert.equal((await call(first)).data.id, result.data.id);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM comments").get().n,1);
  const other = client(env,"b".repeat(64));
  const reply = await other(draft({postId:"en-one", parentId:first.id, language:"en", name:"Reader",body:"I disagree: <script>alert(1)</script>"}));
  assert.equal(reply.status,200);
  const page = await call(null,"post=en-one");
  assert.equal(page.data.threads.length,1); assert.equal(page.data.threads[0].replies.length,1);
  assert.equal(page.data.threads[0].replies[0].body,"I disagree: <script>alert(1)</script>");
  assert.equal(page.data.threads[0].replies[0].mine,false);
  assert.ok(!JSON.stringify(page.data).includes("voter"));
  assert.notEqual(sqlite.prepare("SELECT voter FROM comments LIMIT 1").get().voter,"a".repeat(64));
});
test("Only the originating browser removes a comment; root removal keeps discussion and cannot be resurrected", async t => {
  const {env} = setup(t); const call=client(env); const root=draft(); await call(root);
  const reply=draft({parentId:root.id});await call(reply);
  assert.equal((await client(env,"b".repeat(64))({postId:"fa-one",id:root.id,action:"delete"})).status,404);
  assert.equal((await call({postId:"en-one",id:root.id,action:"delete"})).status,200);
  const page=(await call()).data;
  assert.equal(page.threads[0].deleted,true);assert.equal(page.threads[0].body,"");assert.equal(page.threads[0].name,"");assert.equal(page.threads[0].replies.length,1);
  assert.equal((await call(root)).status,409);
  assert.equal((await call(draft({parentId:root.id}))).status,400);
});
test("Parents must be roots of this published discussion; size, name, controls, cursor, draft and honeypot inputs are validated", async t => {
  const {env} = setup(t); const call=client(env); const root=draft();await call(root);const reply=draft({parentId:root.id});await call(reply);
  for(const invalid of [draft({parentId:reply.id}),draft({parentId:"f".repeat(32)}),draft({name:" "}),draft({name:"x".repeat(61)}),draft({body:"x".repeat(2001)}),draft({body:"a\u0000b"}),draft({website:"spam"}),draft({language:"xx"}),draft({postId:"drafts.hidden"}),draft({id:"bad"})]) assert.equal((await call(invalid)).status,400);
  assert.equal((await call(draft({postId:"unknown"}))).status,404);
  assert.equal((await call(null,"post=fa-one&before=NaN")).status,400);
  assert.equal((await call({...root,body:"new"})).status,409);
  assert.equal((await client(env,"b".repeat(64))(root)).status,409);
  env.DB = { prepare() { throw new Error("private DB failure"); } };
  assert.deepEqual((await call()).data,{error:"unavailable"});
});
test("Thread and reply cursors paginate without duplicates or omitted rows", async t => {
  const {env,sqlite}=setup(t);const insert=sqlite.prepare("INSERT INTO comments(id,post_id,parent_id,voter,name,body,language,created_at) VALUES(?,?,?,?,?,?,?,?)");
  const ids=Array.from({length:24},()=>randomBytes(16).toString("hex"));
  ids.forEach(id=>insert.run(id,"fa-one",null,"hash","Reader","Body","en",Date.now()));
  for(let i=0;i<25;i++) insert.run(randomBytes(16).toString("hex"),"fa-one",ids.at(-1),"hash","Reader","Reply "+i,"en",Date.now());
  sqlite.prepare("INSERT INTO comment_moderation(comment_id,state,updated_at) SELECT id, 'approved', ? FROM comments").run(Date.now());
  const call=client(env); let cursor=null;const seen=[];
  do {const data=(await call(null,"post=en-one"+(cursor?"&before="+cursor:""))).data;seen.push(...data.threads.map(c=>c.id));cursor=data.next;}while(cursor);
  assert.equal(seen.length,24);assert.equal(new Set(seen).size,24);
  const first=(await call()).data.threads[0];assert.equal(first.replies.length,10);assert.ok(first.nextReply);
  let replies=[...first.replies],before=first.nextReply;
  while(before){const data=(await call(null,"post=en-one&parent="+first.id+"&before="+before)).data;replies=[...data.comments,...replies];before=data.next;}
  assert.equal(replies.length,25);assert.equal(new Set(replies.map(c=>c.id)).size,25);assert.ok(replies.every((c,i)=>!i||c.sequence>replies[i-1].sequence));
});
test("Bounded anonymous posting uses separate network/browser windows and does not block article reactions", async t => {
  const {env}=setup(t);const call=client(env);
  for(let i=0;i<4;i++) assert.equal((await call(draft())).status,200);
  const blocked=await call(draft());assert.equal(blocked.status,429);assert.equal(blocked.headers.get("Retry-After"),"600");
  const other=client(env,"b".repeat(64));assert.equal((await other(draft())).status,200);
  const vote=await worker.fetch(new Request("https://x.test/v1/reactions",{method:"POST",headers:{Origin:origin,"X-Voter-ID":"a".repeat(64),"CF-Connecting-IP":"192.0.2.10","Content-Type":"application/json"},body:JSON.stringify({postId:"fa-one",vote:1})}),env);
  assert.equal(vote.status,200);
});

test("Concurrent retries create one row and unrelated article threads cannot receive replies", async t => {
  const {env,sqlite,registry}=setup(t);const call=client(env);const first=draft();
  const replies=await Promise.all([call(first),call(first)]);
  assert.ok(replies.every(r=>r.status===200));
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM comments").get().n,1);
  registry({"fa-one":["fa-one"],"en-one":["en-one"]});
  assert.equal((await call(draft({postId:"en-one",parentId:first.id,language:"en"}))).status,400);
  assert.equal((await call(null,"post=en-one&parent="+first.id)).status,404);
  assert.equal((await call(null,"post=en-one")).data.threads.length,0);
});
