"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/content";
import styles from "./reactions.module.css";

type Vote = -1 | 0 | 1;
type Result = { version: 1; postId: string; likes: number; dislikes: number; selected: Vote };
const endpoint = process.env.NEXT_PUBLIC_REACTIONS_URL || "";
const ID_KEY = "mehdi-blog-voter-v1";
const UPDATE_KEY = "mehdi-blog-reaction-update";

export function Reactions({ postId, lang }: { postId: string; lang: Lang }) {
  const fa = lang === "fa";
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(Boolean(endpoint));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [canVote, setCanVote] = useState(false);
  const voter = useRef<string | null>(null);
  const alive = useRef(false);
  const pending = useRef(false);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const lastRead = useRef(0);
  const request = useCallback(async (value?: Vote) => {
    if (!endpoint || pending.current) return;
    const seq = ++sequence.current;
    pending.current = true;
    if (alive.current && seq === sequence.current) { setBusy(true); setError(""); setSaved(false); }
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 10000);
    try {
      const headers: Record<string, string> = {};
      if (voter.current) headers["X-Voter-ID"] = voter.current;
      if (value !== undefined) headers["Content-Type"] = "application/json";
      const response = await fetch(endpoint + "/v1/reactions" +
        (value === undefined ? "?post=" + encodeURIComponent(postId) : ""), {
          method: value === undefined ? "GET" : "POST", headers,
          credentials: "omit", cache: "no-store", signal: abort.signal,
          ...(value !== undefined ? { body: JSON.stringify({ postId, vote: value }) } : {})
        });
      if (response.status === 429) throw new Error("rate");
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      if (data.version !== 1 || data.postId !== postId ||
          !Number.isSafeInteger(data.likes) || data.likes < 0 ||
          !Number.isSafeInteger(data.dislikes) || data.dislikes < 0 ||
          ![-1, 0, 1].includes(data.selected)) throw new Error("unavailable");
      if (alive.current && seq === sequence.current) {
        setResult(data as Result);
        setSaved(value !== undefined);
      }
      lastRead.current = Date.now();
      if (value !== undefined) {
        try { localStorage.setItem(UPDATE_KEY, String(Date.now())); } catch {}
      }
    } catch (cause) {
      if (alive.current && seq === sequence.current) setError(cause instanceof Error && cause.message === "rate" ? "rate" : "unavailable");
    } finally {
      clearTimeout(timer);
      if (seq === sequence.current) {
        pending.current = false;
        if (alive.current) setBusy(false);
      }
    }
  }, [postId]);
  useEffect(() => {
    if (!endpoint) return;
    alive.current = true;
    setResult(null);
    try {
      let token = localStorage.getItem(ID_KEY);
      if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        token = Array.from(crypto.getRandomValues(new Uint8Array(32)),
          b => b.toString(16).padStart(2, "0")).join("");
        localStorage.setItem(ID_KEY, token);
      }
      voter.current = token;
      setCanVote(true);
    } catch {
      voter.current = null;
      setCanVote(false);
    }
    void request();
    const refresh = () => { if (Date.now() - lastRead.current > 15000) void request(); };
    const changed = (event: StorageEvent) => { if (event.key === UPDATE_KEY) void request(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", changed);
    return () => {
      alive.current = false;
      controller.current?.abort();
      sequence.current += 1;
      pending.current = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", changed);
    };
  }, [request]);
  if (!endpoint) return null;
  const disabled = busy || !result || !canVote || Boolean(error);
  const label = fa ? "این نوشته برایتان مفید بود؟" : "Was this post useful?";
  const message = error === "rate"
    ? (fa ? "کمی صبر کنید و پس از یک دقیقه دوباره تلاش کنید." : "Please wait a minute before trying again.")
    : error
      ? (fa ? "ارتباط با سرویس رأی‌دهی برقرار نشد. دوباره تلاش کنید." : "Reactions could not be updated. Please try again.")
      : busy
        ? (fa ? "در حال دریافت و ثبت رأی‌ها…" : "Updating reactions…")
        : saved
          ? (fa ? (result?.selected ? "رأی شما ثبت شد." : "رأی شما حذف شد.") : (result?.selected ? "Your vote is saved." : "Your vote was removed."))
          : !canVote
            ? (fa ? "برای ثبت رأی، ذخیره‌سازی مرورگر باید فعال باشد." : "Browser storage must be available to save your vote.")
            : (fa ? "انتخاب دوباره، رأی را حذف می‌کند." : "Select again to remove your vote.");
  return (
    <section className={styles.panel} aria-label={label} aria-busy={busy}>
      <h2 className={styles.title}>{label}</h2>
      <div className={styles.options} role="group" aria-label={fa ? "رأی شما" : "Your reaction"}>
        {([1, -1] as const).map(value => (
          <button key={value} type="button"
            className={styles.vote}
            aria-pressed={result?.selected === value}
            disabled={disabled}
            onClick={() => void request(result?.selected === value ? 0 : value)}>
            <svg className={value === -1 ? styles.down : undefined} width="20" height="20"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 10v11H3V10h4Zm0 0 4-8a3 3 0 0 1 3 3v4h5a2 2 0 0 1 2 2l-1 8a2 2 0 0 1-2 2H7" />
            </svg>
            <span>{fa ? (value === 1 ? "مفید بود" : "مفید نبود") : (value === 1 ? "Useful" : "Not useful")}</span>
            <span className={styles.count}>{result ? new Intl.NumberFormat(lang).format(value === 1 ? result.likes : result.dislikes) : "—"}</span>
          </button>
        ))}
      </div>
      <p className={styles.status} role="status">{message}</p>
      {error && <button type="button" className={styles.retry} disabled={busy} onClick={() => void request()}>
        {fa ? "تلاش دوباره" : "Try again"}
      </button>}
    </section>
  );
}
