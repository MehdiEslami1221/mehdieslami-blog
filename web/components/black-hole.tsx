// Flat, server-rendered SVG. Only a few CSS transforms move; no canvas or JS loop.
export function BlackHole() {
  const stars = Array.from({ length: 24 }, (_,i) => ({ x: (i*137+23)%500, y:(i*83+41)%500 }));
  return <div className="black-hole-sky" aria-hidden="true">
    <svg viewBox="0 0 500 500" fill="none" focusable="false">
      <g fill="#b9d7c4" opacity=".55">{stars.map((s,i)=><circle key={i} cx={s.x} cy={s.y} r={i%5===0?1.4:.7}/>)}</g>
      <g className="sky-orbit">
        <circle cx="250" cy="250" r="166" stroke="#8dccb3" strokeDasharray="2 16" opacity=".28"/>
        <circle cx="250" cy="250" r="132" stroke="#8dccb3" strokeDasharray="90 50 10 80" opacity=".45"/>
        <path d="M415 250c0 91-74 165-165 165s-132-57-132-128 57-128 128-128 100 43 100 96-43 96-96 96-70-29-70-65 29-65 65-65" stroke="#bdf66a" strokeWidth="1.2" opacity=".6"/>
      </g>
      <g className="sky-counter-orbit"><circle cx="250" cy="250" r="100" stroke="#bdf66a" strokeDasharray="120 40 30 90" opacity=".55"/><circle cx="350" cy="250" r="2.5" fill="#dcf5b3"/></g>
      {[0,1,2].map(i=><g key={i} className={`sky-capture sky-capture-${i}`}><circle cx="413" cy="250" r="2" fill="#d5efb6"/><path d="M420 250h16" stroke="#95cbb7" strokeWidth="1"/></g>)}
      <circle cx="250" cy="250" r="51" fill="#080c09" stroke="#bdf66a" strokeWidth="1.1"/>
      <circle cx="250" cy="250" r="59" stroke="#95d3b1" opacity=".25"/>
    </svg>
  </div>;
}
