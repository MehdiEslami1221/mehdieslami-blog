"use client";
import { useEffect, useRef } from "react";

const nodes = [[50,120],[200,210],[360,100],[540,180],[700,70],[900,170],[1150,90],[1320,240],[1200,390],[1010,340],[850,460],[670,330],[490,450],[290,360],[90,480],[220,640],[430,730],[670,630],[890,760],[1130,670],[1340,800]];
const traces = nodes.slice(0,-1).map(([x,y],i) => {
  const [bx,by] = nodes[i+1];
  return `M${x} ${y}H${x+(bx-x)*.38}L${x+(bx-x)*.72} ${by}H${bx}`;
});
const selector = ".post-card, .notebook-art, .author-card, .aside-note";
export function SpaceBackground() {
  const meteor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const head = meteor.current;
    if (!head) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const panels = new Map<HTMLElement,{light:HTMLSpanElement;rect:DOMRect | null}>();
    let timer: ReturnType<typeof setTimeout> | undefined, frame = 0, stopped = false;
    function register() {
      for (const [panel,{light}] of panels) if (!panel.isConnected) { light.remove(); panels.delete(panel); }
      document.querySelectorAll<HTMLElement>(selector).forEach(panel => {
        let entry = panels.get(panel);
        if (!entry) { entry = {light:document.createElement("span"),rect:null}; panels.set(panel,entry); }
        if (entry.light.parentElement !== panel) {
          entry.light.className="space-reflection"; entry.light.setAttribute("aria-hidden","true");
          panel.classList.add("space-reactive"); panel.append(entry.light);
        }
      });
    }
    const observer = new MutationObserver(records => {
      if (records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof Element && !n.classList.contains("space-reflection")))) register();
    });
    register(); observer.observe(document.querySelector("#main") || document.body,{childList:true,subtree:true});
    function clear() { head!.style.opacity="0"; panels.forEach(({light})=>light.style.opacity="0"); }
    function suspend() { clearTimeout(timer); cancelAnimationFrame(frame); frame=0; clear(); }
    function launch() {
      if (stopped || document.hidden || motion.matches) return;
      const width=innerWidth,height=innerHeight, mobile=width<700;
      const direction=Math.random()<.5?1:-1;
      const x=width*(direction>0?.06:.94), y=height*(.07+Math.random()*.28);
      const dx=direction*width*.84, dy=height*.42, duration=2700;
      const angle=Math.atan2(dy,dx)*180/Math.PI;
      const start=performance.now(); let last=0, measured=-1000;
      head!.style.width=(mobile?100:170)+"px";
      function tick(now:number) {
        if (stopped || document.hidden || motion.matches) { suspend(); return; }
        const elapsed=now-start;
        if (elapsed>=duration) { clear(); timer=setTimeout(launch,16000+Math.random()*8000); return; }
        if(now-last >= (mobile?1000/24:1000/30)) {
          const progress=elapsed/duration, hx=x+dx*progress, hy=y+dy*progress;
          const alpha=Math.min(1,elapsed/350,(duration-elapsed)/550);
          head!.style.transform=`translate3d(${hx}px,${hy}px,0) rotate(${angle}deg)`;
          head!.style.opacity=String(alpha*.82);
          if(now-measured>=100){panels.forEach(entry=>entry.rect=entry.light.parentElement!.getBoundingClientRect());measured=now;}
          panels.forEach(({light,rect})=>{
            if(!rect||!rect.width||rect.bottom<0||rect.top>height){light.style.opacity="0";return;}
            const nearX=Math.max(rect.left,Math.min(rect.right,hx)),nearY=Math.max(rect.top,Math.min(rect.bottom,hy));
            const strength=Math.max(0,1-Math.hypot(hx-nearX,hy-nearY)/(mobile?190:280));
            light.style.setProperty("--space-x",(hx-rect.left)+"px");light.style.setProperty("--space-y",(hy-rect.top)+"px");
            light.style.opacity=String(strength*strength*alpha*.8);
          });
          last=now;
        }
        frame=requestAnimationFrame(tick);
      }
      frame=requestAnimationFrame(tick);
    }
    function resume(){suspend();if(!document.hidden&&!motion.matches)timer=setTimeout(launch,4500);}
    resume(); document.addEventListener("visibilitychange",resume);motion.addEventListener("change",resume);addEventListener("resize",resume);
    return ()=>{stopped=true;suspend();observer.disconnect();document.removeEventListener("visibilitychange",resume);motion.removeEventListener("change",resume);removeEventListener("resize",resume);panels.forEach(({light},panel)=>{light.remove();panel.classList.remove("space-reactive");});};
  },[]);
  return <div className="journal-sky" aria-hidden="true">
    <svg viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" focusable="false">
      <g className="sky-stars" fill="#c6e4ba">{Array.from({length:52},(_,i)=><circle key={i} cx={(i*173+37)%1400} cy={(i*113+29)%900} r={i%11===0?1.4:.65} opacity={i%3===0?.5:.25}/>)}</g>
      <g fill="none" stroke="#91bd80" strokeWidth=".7" opacity=".16">{traces.map((d,i)=><path key={i} d={d}/>)}</g>
      <g className="sky-packets" fill="none" stroke="#c4f397" strokeWidth="1.4" strokeDasharray="5 800" opacity=".55">{traces.filter((_,i)=>i%4===0).map((d,i)=><path key={i} d={d}/>)}</g>
      <g fill="#b6dd9c">{nodes.map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r={i%5===0?2:1} opacity=".35"/>)}</g>
      <g fill="#afcc9e" opacity=".23" fontFamily="monospace" fontSize="11"><text x="215" y="190">{"{ }"}</text><text x="1040" y="370">{"</>"}</text><text x="440" y="760">01</text><text x="870" y="145">API</text></g>
    </svg>
    <div ref={meteor} className="journal-meteor" />
  </div>;
}
