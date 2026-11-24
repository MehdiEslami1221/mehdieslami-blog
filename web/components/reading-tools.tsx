"use client";
import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/content";
export function ReadingTools() {
  const progress = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      const fraction = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      if (progress.current)
        progress.current.style.transform = `scaleX(${fraction})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    update();
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="reading-progress" aria-hidden="true">
      <div ref={progress} />
    </div>
  );
}
export function ArticleShare({ lang }: { lang: Lang }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href);
      setMessage(lang === "fa" ? "پیوند کپی شد" : "Link copied");
    } catch {
      setMessage(location.href);
    }
  }
  return (
    <div className="article-share">
      <button className="share-article" type="button" onClick={copy}>
        {lang === "fa" ? "کپی پیوند نوشته" : "Copy article link"}
      </button>
      <span className="share-status" role="status" dir="auto">
        {message}
      </span>
    </div>
  );
}
