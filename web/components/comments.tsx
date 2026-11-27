"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Lang } from "@/lib/content";
import styles from "./comments.module.css";

const endpoint = process.env.NEXT_PUBLIC_REACTIONS_URL || "";
const nameKey = "mehdi-blog-comment-name-v1";
type Comment = { id: string; sequence: number; parentId: string | null; name: string; body: string; language: Lang; createdAt: string; deleted: boolean; mine: boolean };
type Thread = Comment & { replies: Comment[]; nextReply: number | null };
type Page = { version: 1; postId: string; threads: Thread[]; next: number | null };
function randomId(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2,"0")).join("");
}
function validComment(value: Comment): boolean {
  return !!value && /^[a-f0-9]{32}$/.test(value.id) && Number.isSafeInteger(value.sequence) &&
    typeof value.name === "string" && typeof value.body === "string" && ["fa","en"].includes(value.language) &&
    typeof value.mine === "boolean" && typeof value.deleted === "boolean" && Number.isFinite(Date.parse(value.createdAt));
}
export function Comments({ postId, lang }: { postId: string; lang: Lang }) {
  const fa = lang === "fa";
  const [threads, setThreads] = useState<Thread[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [persistent, setPersistent] = useState(true);
  const [confirm, setConfirm] = useState<string | null>(null);
  const voter = useRef("");
  const alive = useRef(false);
  const generation = useRef(0);
  const lock = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  const textarea = useRef<HTMLTextAreaElement>(null);
  const draftId = useRef<{ draft: string; id: string } | null>(null);
  const text = (en: string, persian: string) => fa ? persian : en;
  async function api(query: string, data?: object) {
    const gen = generation.current;
    const controller = new AbortController();
    controllers.current.add(controller);
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(endpoint + "/v1/comments" + query, {
        method: data ? "POST" : "GET", credentials: "omit", cache: "no-store", signal: controller.signal,
        headers: { "X-Voter-ID": voter.current, ...(data ? { "Content-Type": "application/json" } : {}) },
        ...(data ? { body: JSON.stringify(data) } : {})
      });
      const result = await res.json();
      if (gen !== generation.current || !alive.current) throw new Error("stale");
      if (!res.ok) throw new Error(res.status === 429 ? "rate" : result.error === "invalid_parent" ? "parent" : "connection");
      if (result.version !== 1) throw new Error("connection");
      return result;
    } finally { clearTimeout(timer); controllers.current.delete(controller); }
  }
  async function read(before?: number) {
    const page = await api("?post=" + encodeURIComponent(postId) + (before ? "&before=" + before : "")) as Page;
    if (page.postId !== postId || !Array.isArray(page.threads) || page.threads.some(t =>
      !validComment(t) || !Array.isArray(t.replies) || t.replies.some(c => !validComment(c)))) throw new Error("connection");
    if (!alive.current) return;
    setThreads(previous => before ? [...previous, ...page.threads.filter(t => !previous.some(p => p.id === t.id))] : page.threads);
    setNext(page.next); setLoaded(true);
  }
  async function perform(action: () => Promise<void>) {
    if (lock.current) return;
    const gen = generation.current;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (cause) { if (alive.current && gen === generation.current) setError(cause instanceof Error ? cause.message : "connection"); }
    finally { if (gen === generation.current) { lock.current = false; if (alive.current) setBusy(false); } }
  }
  useEffect(() => {
    if (!endpoint) return;
    alive.current = true;
    generation.current += 1;
    lock.current = false;
    setThreads([]); setNext(null); setLoaded(false); setReply(null); setBody(""); setError(""); setMessage("");
    draftId.current = null;
    try {
      const stored = localStorage.getItem("mehdi-blog-voter-v1");
      voter.current = stored && /^[a-f0-9]{64}$/.test(stored) ? stored : randomId(32);
      localStorage.setItem("mehdi-blog-voter-v1", voter.current);
      setName((localStorage.getItem(nameKey) || "").slice(0,60));
    } catch { voter.current ||= randomId(32); setPersistent(false); }
    // Initial request owns its own lifecycle; a discarded Strict Mode request cannot update the next mount.
    let current = true;
    setBusy(true);
    void api("?post=" + encodeURIComponent(postId)).then((page: Page) => {
      if (!current || !alive.current) return;
      if (page.postId !== postId || !Array.isArray(page.threads) || page.threads.some(t =>
        !validComment(t) || !Array.isArray(t.replies) || t.replies.some(c => !validComment(c)))) throw new Error("connection");
      setThreads(page.threads); setNext(page.next); setLoaded(true);
    }).catch(() => { if (current) setError("connection"); }).finally(() => { if (current) setBusy(false); });
    return () => { current = false; alive.current = false; generation.current += 1; controllers.current.forEach(c => c.abort()); };
  // The post ID owns the request lifecycle. Form state never triggers a reload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);
  function remember(value: string) {
    setName(value);
    try { localStorage.setItem(nameKey,value); } catch { setPersistent(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const content = { postId, name: name.trim(), body: body.trim(), parentId: reply?.id || null, language: lang,
      website: String(form.get("website") || "") };
    if (!content.name || !content.body || !voter.current) return;
    const draft = JSON.stringify(content);
    if (draftId.current?.draft !== draft) draftId.current = { draft, id: randomId(16) };
    const id = draftId.current.id;
    void perform(async () => {
      const result = await api("", { ...content, id });
      if (result.id !== id || !["pending","approved","rejected","removed"].includes(result.status)) throw new Error("connection");
      if (!alive.current) return;
      setBody(""); setReply(null); draftId.current = null;
      setMessage(text("Your comment was submitted for review. It will appear after approval.", "نظر شما برای بررسی ثبت شد و پس از تأیید نمایش داده می‌شود."));

    });
  }
  async function olderReplies(thread: Thread) {
    const result = await api("?post=" + encodeURIComponent(postId) + "&parent=" + thread.id + "&before=" + thread.nextReply);
    if (!Array.isArray(result.comments) || result.comments.some((c: Comment) => !validComment(c))) throw new Error("connection");
    if (alive.current) setThreads(previous => previous.map(t => t.id === thread.id ? { ...t,
      replies: [...result.comments.filter((c: Comment) => !t.replies.some(p => p.id === c.id)), ...t.replies], nextReply: result.next } : t));
  }
  async function remove(comment: Comment) {
    const result = await api("", { postId, action: "delete", id: comment.id });
    if (!result.deleted || !alive.current) return;
    const deleted = (c: Comment) => c.id === comment.id ? { ...c, deleted: true, name: "", body: "" } : c;
    setThreads(previous => previous.map(t => ({ ...t, ...deleted(t), replies: t.replies.map(deleted) })));
    setConfirm(null); setMessage(text("Your comment was removed.", "نظر شما حذف شد."));
  }
  function renderComment(comment: Comment, root = false) {
    return <article className={styles.comment} key={comment.id} id={"comment-" + comment.id}>
      <header><bdi>{comment.deleted ? text("Removed comment", "نظر حذف‌شده") : comment.name}</bdi>
        <time dateTime={comment.createdAt}>{new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.createdAt))}</time></header>
      <p dir="auto">{comment.deleted ? text("This comment has been removed.", "این نظر حذف شده است.") : comment.body}</p>
      {!comment.deleted && <div className={styles.actions}>
        {root && <button type="button" disabled={busy} onClick={() => { setReply({ id: comment.id, name: comment.name }); setError(""); textarea.current?.focus(); }}>
          {text("Reply / discuss", "پاسخ / نقد این نظر")}</button>}
        {comment.mine && (confirm === comment.id ? <>
          <button type="button" disabled={busy} onClick={() => void perform(() => remove(comment))}>{text("Confirm removal", "تأیید حذف")}</button>
          <button type="button" onClick={() => setConfirm(null)}>{text("Cancel", "انصراف")}</button>
        </> : <button type="button" disabled={busy} onClick={() => setConfirm(comment.id)}>{text("Remove my comment", "حذف نظر من")}</button>)}
      </div>}
    </article>;
  }
  if (!endpoint) return null;
  return <section className={styles.panel} aria-labelledby="comments-heading">
    <div className={styles.heading}><span aria-hidden="true">{ "{ … }" }</span><h2 id="comments-heading">{text("Join the discussion", "گفت‌وگو دربارهٔ این نوشته")}</h2></div>
    <p className={styles.intro}>{text("Leave a question, share your experience or discuss a comment. No account needed. Names are chosen by visitors and are not verified.", "پرسش یا تجربهٔ خود را بنویسید و دربارهٔ نظر دیگران گفت‌وگو کنید. نیازی به ثبت‌نام نیست؛ نام‌ها را کاربران انتخاب می‌کنند و تأیید هویت نمی‌شوند.")}</p>
    <form onSubmit={submit} className={styles.form}>
      <label htmlFor="comment-name">{text("Your name", "نام شما")}</label>
      <input id="comment-name" name="name" autoComplete="nickname" value={name} onChange={e => remember(e.target.value)} maxLength={60} required dir="auto" />
      <small>{persistent ? text("Saved in this browser for your next visit.", "برای مراجعهٔ بعدی، در همین مرورگر ذخیره می‌شود.") : text("Browser storage is unavailable. Your name will not be remembered.", "ذخیره‌سازی مرورگر در دسترس نیست؛ نام شما برای مراجعهٔ بعدی حفظ نمی‌شود.")}</small>
      <div className={styles.trap} aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {reply && <div className={styles.replying}>{text("Replying to ", "پاسخ به ")}<bdi>{reply.name}</bdi><button type="button" onClick={() => setReply(null)}>{text("Cancel reply", "لغو پاسخ")}</button></div>}
      <label htmlFor="comment-body">{reply ? text("Your reply", "پاسخ شما") : text("Your comment", "نظر شما")}</label>
      <textarea ref={textarea} id="comment-body" name="body" value={body} onChange={e => setBody(e.target.value)} maxLength={2000} required rows={4} dir="auto" />
      <div className={styles.submit}><small>{new Intl.NumberFormat(lang).format(body.length)} / {new Intl.NumberFormat(lang).format(2000)}</small>
        <button type="submit" disabled={busy || !loaded || !name.trim() || !body.trim()}>{busy ? text("Please wait…", "لطفاً صبر کنید…") : reply ? text("Submit reply", "ثبت پاسخ") : text("Submit comment", "ثبت نظر")}</button></div>
      <small>{text("Comments appear after review. Please keep the discussion respectful and avoid sharing private information.", "نظرها پس از بررسی و تأیید نمایش داده می‌شوند. لطفاً محترمانه و مرتبط بنویسید و اطلاعات خصوصی را در نظر وارد نکنید.")}</small>
    </form>
    <p className={styles.status} role="status">{error ? error === "rate" ? text("Too many requests. Please try again in 10 minutes.", "تعداد درخواست‌ها زیاد است؛ ۱۰ دقیقه دیگر دوباره تلاش کنید.") : error === "parent" ? text("That comment is no longer available for replies. Cancel the reply and refresh.", "نظر انتخاب‌شده دیگر قابل پاسخ نیست. پاسخ را لغو و فهرست را تازه کنید.") : text("Comments could not be updated. Your draft is still here; please try again.", "ارتباط با بخش نظرها برقرار نشد. متن شما حفظ شده است؛ دوباره تلاش کنید.") : message || (!loaded && busy ? text("Loading discussion…", "در حال دریافت نظرها…") : "")}</p>
    <div className={styles.toolbar}><h3>{text("Discussion", "نظرها و پاسخ‌ها")}</h3><button type="button" disabled={busy} onClick={() => void perform(() => read())}>{text("Refresh comments", "تازه‌سازی نظرها")}</button></div>
    {loaded && !threads.length && <p className={styles.empty}>{text("Be the first to start the discussion.", "شما آغازگر این گفت‌وگو باشید.")}</p>}
    {threads.map(thread => <div key={thread.id} className={styles.thread}>{renderComment(thread,true)}
      {(thread.replies.length > 0 || thread.nextReply) && <div className={styles.replies}>
        {thread.nextReply && <button type="button" disabled={busy} onClick={() => void perform(() => olderReplies(thread))}>{text("Earlier replies", "پاسخ‌های قبلی")}</button>}
        {thread.replies.map(c => renderComment(c))}
      </div>}</div>)}
    {next && <button className={styles.more} type="button" disabled={busy} onClick={() => void perform(() => read(next))}>{text("Earlier comments", "نظرهای قبلی")}</button>}
  </section>;
}
