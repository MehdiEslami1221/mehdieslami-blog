# Flat homepage sky

Updated 28 November 2026. `web/components/black-hole.tsx` is now a **server-rendered, face-on 2D SVG** on the two journal homepages. It replaces the previous Canvas renderer after reports of heavy rendering.

The scene contains 24 static stars, a few circular/spiral strokes, a dark central disk and three small infall markers. `globals.css` animates only limited rotation, scaling and opacity. There is no 3D projection, ray tracing, Canvas, WebGL, device-pixel buffer, resize listener, animation-frame callback or per-frame React/JavaScript computation. The existing notebook illustration remains independent.

The rings are a stylized graphic of orbital flow, not a quantitative physical simulation. Do not describe them as full general relativity or an observed wormhole. Keep the flat circular view; do not reintroduce inclined disk layers, lensing calculations, particle trails or per-frame gradients without a measured performance need and an explicit visual change.

The decorative layer cannot intercept clicks and is faint enough to preserve reading contrast. Narrow screens use a smaller/lower-opacity SVG. `prefers-reduced-motion` removes all scene movement; print hides it. Motion is CSS/browser-managed rather than kept alive by a JavaScript timer. Preserve the charcoal/lime identity, header, notebook, content and article layouts.

Build the static site and check both homepages at 360px and desktop widths. Verify emitted HTML contains the SVG and no sky Canvas. Keep the reader bundle free of dashboard code and administrator credentials.
