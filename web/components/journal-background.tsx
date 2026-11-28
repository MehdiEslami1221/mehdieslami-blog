import type { CSSProperties } from "react";

const motifs = [
  { kind: "book", left: "7%", top: "19%", size: 42 },
  { kind: "quote", left: "89%", top: "12%", size: 30 },
  { kind: "page", left: "94%", top: "46%", size: 36 },
  { kind: "pen", left: "4%", top: "67%", size: 34 },
  { kind: "rss", left: "78%", top: "83%", size: 30 },
  { kind: "bookmark", left: "34%", top: "90%", size: 28 },
] as const;

function Motif({ kind }: { kind: (typeof motifs)[number]["kind"] }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      {kind === "book" && <path d="M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z" />}
      {kind === "quote" && <path d="M9 5H4v7h5v3c0 2-2 4-4 4M20 5h-5v7h5v3c0 2-2 4-4 4" />}
      {kind === "page" && <path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h6" />}
      {kind === "pen" && <path d="m16 3 5 5L8 21H3v-5L16 3Zm-3 3 5 5M3 16l5 5" />}
      {kind === "rss" && <><circle cx="5" cy="19" r="1" /><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" /></>}
      {kind === "bookmark" && <path d="M6 3h12v18l-6-4-6 4V3Z" />}
    </svg>
  );
}

// Static markup: only CSS moves the decoration; no browser controller is needed.
export function JournalBackground() {
  return (
    <div className="journal-atmosphere" aria-hidden="true">
      {[0, 1, 2].map(layer => (
        <div className={`journal-starfield starfield-${layer}`} key={layer}>
          {Array.from({ length: 14 }, (_, index) => {
            const seed = layer * 14 + index;
            const size = seed % 7 === 0 ? 2 : 1;
            return <span className="journal-star" key={seed} style={{
              left: `${(seed * 73 + 11) % 100}%`,
              top: `${(seed * 37 + 7) % 100}%`,
              width: size,
              height: size,
              opacity: seed % 3 === 0 ? .32 : .18,
            }} />;
          })}
        </div>
      ))}
      {motifs.map(({ kind, left, top, size }, index) => (
        <span className="journal-motif" key={kind} style={{
          left, top, width: size, height: size,
          "--motif-delay": `${-index * 7}s`,
          "--motif-duration": `${32 + index * 3}s`,
        } as CSSProperties}>
          <Motif kind={kind} />
        </span>
      ))}
    </div>
  );
}
