"use client";
import { useEffect, useRef } from "react";

// A bounded visual model: Kepler-like differential rotation, dissipative inflow,
// a captured central shadow and projected/lensed disk arcs. Not a GR ray tracer.
export function BlackHole() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0, height = 0, clock = 0, frame = 0, last = 0;
    let stars: { x: number; y: number; size: number; phase: number }[] = [];
    let matter: { phase: number; angle: number; band: number; size: number }[] = [];
    function resize() {
      width = innerWidth; height = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, width < 700 ? 1.25 : 1.5);
      canvas!.width = Math.round(width * dpr); canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr,0,0,dpr,0,0);
      stars = Array.from({ length: width < 700 ? 75 : 150 }, () => ({ x: Math.random()*width, y: Math.random()*height, size: .45+Math.random()*.9, phase: Math.random()*6.28 }));
      matter = Array.from({ length: width < 700 ? 110 : 210 }, (_,i) => ({ phase: i / (width < 700 ? 110 : 210), angle: Math.random()*6.28, band: Math.random(), size: .5+Math.random()*.8 }));
      draw();
    }
    function draw() {
      const c = ctx!;
      c.clearRect(0,0,width,height);
      const mobile = width < 700;
      const x = width * (mobile ? .67 : .73), y = height * (mobile ? .76 : .47);
      const radius = Math.min(width * (mobile ? .20 : .115), 180);
      const shadow = radius * .32;
      // Distant stars remain distant. Only matter already in the capture stream spirals in.
      for (const star of stars) {
        const dx = star.x-x, dy = star.y-y, distance = Math.hypot(dx,dy);
        if (distance < shadow * 1.15) continue;
        const bend = Math.min(.18, radius*radius*.035/(distance*distance));
        c.fillStyle = `rgba(198,222,217,${.2 + .16*(1+Math.sin(clock*.4+star.phase))})`;
        c.beginPath(); c.arc(star.x+dx*bend,star.y+dy*bend,star.size,0,Math.PI*2); c.fill();
      }
      c.save(); c.translate(x,y); c.rotate(-.13);
      const halo = c.createRadialGradient(0,0,shadow*.9,0,0,radius*3.1);
      halo.addColorStop(0,"#d8a96c1c"); halo.addColorStop(.22,"#b4b96b12"); halo.addColorStop(.6,"#4c9f9710"); halo.addColorStop(1,"#4c9f9700");
      c.fillStyle=halo; c.fillRect(-radius*3.2,-radius*3.2,radius*6.4,radius*6.4);
      // Bent light from the far disk appears above and below the central shadow.
      c.globalCompositeOperation="screen";
      for(let i=0;i<24;i++) {
        const r = shadow*(1.08+i*.035);
        c.beginPath(); c.ellipse(0,-shadow*.03,r,r*.94,0,Math.PI,Math.PI*2);
        c.strokeStyle=`rgba(234,215,158,${.025+(23-i)*.004})`; c.lineWidth=1.7; c.stroke();
        c.beginPath(); c.ellipse(0,shadow*.04,r,r*.72,0,0,Math.PI);
        c.strokeStyle="rgba(138,192,164,.024)"; c.stroke();
      }
      function point(p: typeof matter[number], ago: number) {
        const age = (p.phase + clock*(.018+p.band*.005) - ago + 100) % 1;
        const outer = radius*(1.7+p.band*.8) / shadow;
        const radial = outer - (outer - .95) * age;
        const r = radial * shadow;
        // Integral of omega(r) ∝ r^-3/2 along a slowly decaying radius.
        const angle = p.angle + 125 / (outer-.95) * (1/Math.sqrt(radial)-1/Math.sqrt(outer));
        return { x: Math.cos(angle)*r, y: Math.sin(angle)*r*.28, r, angle, age };
      }
      // Paint the rear disk before the shadow, then the near disk in front.
      for(const front of [false,true]) {
        if(front) {
          c.globalCompositeOperation="source-over";
          const darkness = c.createRadialGradient(0,0,shadow*.9,0,0,shadow*1.08);
          darkness.addColorStop(0,"#030605"); darkness.addColorStop(.86,"#030605"); darkness.addColorStop(1,"#03060500");
          c.fillStyle=darkness; c.beginPath(); c.arc(0,0,shadow*1.08,0,Math.PI*2); c.fill();
          c.strokeStyle="#dbe7b350"; c.lineWidth=.9; c.beginPath(); c.ellipse(0,0,shadow*1.06,shadow*1.02,0,0,Math.PI*2); c.stroke();
          c.globalCompositeOperation="screen";
        }
        // A continuous emitting disk under the tracers prevents a wireframe appearance.
        for(let band=0;band<48;band++) {
          const r=shadow*(1.18+band*.085);
          const intensity=Math.pow(1-band/48,1.65)*.19;
          const shine=c.createLinearGradient(-r,0,r,0);
          shine.addColorStop(0,`rgba(235,226,185,${intensity*1.8})`);
          shine.addColorStop(.45,`rgba(214,202,145,${intensity})`);
          shine.addColorStop(1,`rgba(127,189,165,${intensity*.35})`);
          c.strokeStyle=shine;c.lineWidth=2.1;
          c.beginPath();c.ellipse(0,0,r,r*.28,0,front?0:Math.PI,front?Math.PI:Math.PI*2);c.stroke();
        }
        for(const p of matter) {
          const head=point(p,0);
          if ((head.y>0)!==front || head.r<shadow*1.04) continue;
          // The approaching side is brighter; emission heats as material moves inward.
          const hot=Math.max(0,1-(head.r-shadow)/(radius*1.8));
          const brightness=(.09+hot*.46)*(head.x<0?1:.43)*Math.min(1,(1-head.age)*20);
          c.strokeStyle=hot>.62?`rgba(239,225,179,${brightness})`:`rgba(150,202,171,${brightness})`;
          c.lineWidth=p.size; c.beginPath();
          for(let k=9;k>=0;k--) { const q=point(p,k*.0018); k===9?c.moveTo(q.x,q.y):c.lineTo(q.x,q.y); }
          c.stroke();
        }
      }
      // A periodic, stretched capture stream, rather than whole stars vanishing everywhere.
      const cycle = (clock%22)/22;
      const phase = cycle*cycle;
      const theta=-2.1+phase*3.8;
      const r=radius*(3.3-phase*3.0);
      if(r>shadow*1.12) {
        const sx=Math.cos(theta)*r, sy=Math.sin(theta)*r*.55;
        const fade=Math.sin(Math.PI*cycle)*.7;
        c.strokeStyle=`rgba(214,231,194,${fade})`; c.lineWidth=1.4; c.beginPath();
        for(let j=0;j<20;j++) {const t=j/19, a=theta-t*(.05+phase*.3), rr=r+t*radius*(.1+phase*.5); const px=Math.cos(a)*rr, py=Math.sin(a)*rr*.55; j?c.lineTo(px,py):c.moveTo(px,py);}
        c.stroke();
        c.fillStyle=`rgba(242,242,215,${fade})`; c.beginPath();c.arc(sx,sy,1.8,0,Math.PI*2);c.fill();
      }
      c.restore();
    }
    function tick(now: number) {
      frame=0;
      if(document.hidden || motion.matches) return;
      if(now-last >= (width<700?1000/24:1000/30)) { clock+=Math.min((now-last)/1000,.08); last=now; draw(); }
      frame=requestAnimationFrame(tick);
    }
    function sync() { cancelAnimationFrame(frame); frame=0; if(!document.hidden&&!motion.matches) {last=performance.now();frame=requestAnimationFrame(tick);} else draw(); }
    resize();sync();
    addEventListener("resize",resize);document.addEventListener("visibilitychange",sync);motion.addEventListener("change",sync);
    return () => {cancelAnimationFrame(frame);removeEventListener("resize",resize);document.removeEventListener("visibilitychange",sync);motion.removeEventListener("change",sync);};
  }, []);
  return <canvas ref={ref} className="black-hole-sky" aria-hidden="true" />;
}
