import type { CSSProperties } from "react";

const binaryLines = [
  "010010", "101101", "001011", "110100", "011010", "100101",
  "010110", "101001", "001101", "110010", "011001", "100110",
];
const streams = [
  { left: "5%", top: "8%", duration: 38, delay: -12 },
  { left: "32%", top: "72%", duration: 46, delay: -28 },
  { left: "62%", top: "-7%", duration: 42, delay: -18 },
  { left: "95%", top: "49%", duration: 50, delay: -34 },
];
const fragments = [
  { text: "<article>", left: "18%", top: "14%" },
  { text: "{ write() }", left: "79%", top: "24%" },
  { text: "</>", left: "7%", top: "55%" },
  { text: "# journal", left: "67%", top: "88%" },
  { text: "const ideas = []", left: "39%", top: "57%" },
  { text: "</article>", left: "89%", top: "78%" },
];

// Decorative server-rendered markup; all motion is CSS, with no runtime controller.
export function JournalBackground() {
  return (
    <div className="journal-atmosphere" aria-hidden="true" dir="ltr">
      <div className="journal-haze" />
      {streams.map(({ left, top, duration, delay }, index) => (
        <div className={`binary-window binary-window-${index}`} key={left} style={{
          left, top, "--stream-duration": `${duration}s`, "--stream-delay": `${delay}s`,
        } as CSSProperties}>
          <div className="binary-track">
            {[0, 1].map(copy => (
              <div className="binary-chunk" key={copy}>
                {binaryLines.map((line, row) => <span key={row}>{index % 2 ? line.split("").reverse().join("") : line}</span>)}
              </div>
            ))}
          </div>
        </div>
      ))}
      {fragments.map(({ text, left, top }, index) => (
        <span className="journal-code" key={text} style={{
          left, top, "--float-delay": `${-index * 5}s`, "--float-duration": `${24 + index * 3}s`,
        } as CSSProperties}>{text}</span>
      ))}
      <div className="journal-ghost-note ghost-note-one">
        <div className="ghost-note-heading"><span className="ghost-dot" /><span>post.md</span><span>{"{ }"}</span></div>
        <div className="ghost-note-body"><b>{"<blog />"}</b><i /><i /><i /></div>
        <div className="ghost-note-footer"><span>01 / ideas</span><span>↗</span></div>
      </div>
      <div className="journal-ghost-note ghost-note-two">
        <div className="ghost-note-heading"><span className="ghost-dot" /><span>journal</span><span>···</span></div>
        <div className="ghost-note-body"><b className="ghost-quote">“</b><i /><i /><i /></div>
        <div className="ghost-note-footer"><span>write. build.</span><span>{"</>"}</span></div>
      </div>
    </div>
  );
}
