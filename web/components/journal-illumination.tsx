"use client";

import { useEffect, useRef } from "react";

// One shared moving source, with cached viewport bounds for nearby reflections.
export function JournalIllumination() {
  const source = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const light = source.current;
    const main = document.querySelector("#main");
    if (!light || !main) return;
    const stage = light.parentElement!;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, dirty = true, stopped = false, last = 0;
    const started = performance.now();
    let stageRect = stage.getBoundingClientRect();
    let panels: { overlay: HTMLElement; rect: DOMRect }[] = [];

    function measure() {
      stageRect = stage.getBoundingClientRect();
      panels = Array.from(main!.querySelectorAll<HTMLElement>(".journal-reflection"))
        .filter(overlay => overlay.parentElement instanceof HTMLElement)
        .map(overlay => ({ overlay, rect: overlay.parentElement!.getBoundingClientRect() }));
      dirty = false;
    }
    function invalidate() { dirty = true; }
    function clear() {
      light!.style.opacity = "0";
      panels.forEach(({ overlay }) => { overlay.style.opacity = "0"; });
    }
    function tick(now: number) {
      if (stopped || document.hidden || reducedMotion.matches) return;
      const mobile = innerWidth < 700;
      if (now - last >= 1000 / (mobile ? 18 : 24)) {
        if (dirty) measure();
        const phase = (now - started) / 48000 * Math.PI * 2;
        // The fixed field can start after an RTL scrollbar. Keep its local
        // drawing coordinates separate from the viewport coordinates of cards.
        const localX = stageRect.width * (.5 + .42 * Math.sin(phase - .75));
        const localY = stageRect.height * (.5 + .32 * Math.sin(phase * 2 - .3));
        const x = stageRect.left + localX, y = stageRect.top + localY;
        light!.style.transform = `translate3d(${localX}px,${localY}px,0)`;
        light!.style.opacity = "1";
        const reach = mobile ? 180 : 300;
        for (const { overlay, rect } of panels) {
          if (rect.bottom < 0 || rect.top > innerHeight || !rect.width) {
            if (overlay.style.opacity !== "0") overlay.style.opacity = "0";
            continue;
          }
          const dx = x - Math.max(rect.left, Math.min(rect.right, x));
          const dy = y - Math.max(rect.top, Math.min(rect.bottom, y));
          const strength = Math.max(0, 1 - Math.hypot(dx, dy) / reach);
          if (strength <= .01) {
            if (overlay.style.opacity !== "0") overlay.style.opacity = "0";
            continue;
          }
          overlay.style.setProperty("--reflection-x", `${x - rect.left}px`);
          overlay.style.setProperty("--reflection-y", `${y - rect.top}px`);
          overlay.style.opacity = String(strength * strength * (mobile ? .55 : .75));
        }
        last = now;
      }
      frame = requestAnimationFrame(tick);
    }
    function resume() {
      cancelAnimationFrame(frame);
      clear();
      dirty = true;
      if (!document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(tick);
    }
    // React owns the overlays; observe filtered cards without injecting DOM nodes.
    const mutations = new MutationObserver(invalidate);
    mutations.observe(main, { childList: true, subtree: true });
    const resize = new ResizeObserver(invalidate);
    resize.observe(main);
    addEventListener("scroll", invalidate, { passive: true });
    addEventListener("resize", invalidate);
    main.addEventListener("load", invalidate, true);
    document.addEventListener("visibilitychange", resume);
    reducedMotion.addEventListener("change", resume);
    resume();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      clear();
      mutations.disconnect();
      resize.disconnect();
      removeEventListener("scroll", invalidate);
      removeEventListener("resize", invalidate);
      main.removeEventListener("load", invalidate, true);
      document.removeEventListener("visibilitychange", resume);
      reducedMotion.removeEventListener("change", resume);
    };
  }, []);

  return <div ref={source} className="journal-light-source" aria-hidden="true"><span>01</span><i /></div>;
}
