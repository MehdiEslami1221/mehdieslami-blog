import type { CSSProperties } from "react";
import { JournalIllumination } from "./journal-illumination";

const binaryLines = [
  "010010", "101101", "001011", "110100", "011010", "100101",
  "010110", "101001", "001101", "110010", "011001", "100110",
];
const streams = [
  { left: "5%", top: "8%", duration: 38, delay: -12 },
  { left: "32%", top: "72%", duration: 46, delay: -28 },
  { left: "62%", top: "-7%", duration: 42, delay: -18 },
  { left: "95%", top: "49%", duration: 50, delay: -34 },
  { left: "18%", top: "40%", duration: 54, delay: -21 },
  { left: "77%", top: "60%", duration: 44, delay: -9 },
];
const fragments = [
  { text: "<article>", left: "18%", top: "14%" },
  { text: "{ write() }", left: "79%", top: "24%" },
  { text: "</>", left: "7%", top: "55%" },
  { text: "# journal", left: "67%", top: "88%" },
  { text: "const ideas = []", left: "39%", top: "57%" },
  { text: "</article>", left: "89%", top: "78%" },
  { text: "0101", left: "46%", top: "20%" },
  { text: "[ ideas ]", left: "25%", top: "40%" },
  { text: "post.publish()", left: "55%", top: "72%" },
  { text: "# learn", left: "19%", top: "94%" },
  { text: "<section>", left: "85%", top: "5%" },
  { text: "{ notes }", left: "6%", top: "35%" },
];

// The decorative field stays server-rendered; only shared illumination uses JS.
export function JournalBackground() {
  return (
    <div className="journal-atmosphere" aria-hidden="true" dir="ltr">
      <div className="journal-haze" />
      <span className="journal-watermark watermark-one">01</span>
      <span className="journal-watermark watermark-two">{"{ }"}</span>
      <div className="journal-data-points">
        {Array.from({ length: 18 }, (_, index) => <i key={index} style={{
          left: `${(index * 37 + 9) % 100}%`, top: `${(index * 53 + 13) % 100}%`,
          "--point-delay": `${-index * 2}s`,
        } as CSSProperties} />)}
      </div>
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
      <div className="journal-ghost-note ghost-note-three">
        <div className="ghost-note-heading"><span className="ghost-dot" /><span>ideas.json</span><span>{"[ ]"}</span></div>
        <div className="ghost-note-body"><b>{"{ draft }"}</b><i /><i /><i /></div>
        <div className="ghost-note-footer"><span>learn / share</span><span>01</span></div>
      </div>
      <JournalIllumination />
    </div>
  );
}
