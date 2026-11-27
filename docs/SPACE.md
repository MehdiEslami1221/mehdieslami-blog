# Journal background

`web/components/space-background.tsx` owns the decorative background on the two journal homepages. It follows the portfolio's dark circuit/star identity: a full-viewport field, chamfered circuit traces, five slow signal packets, small code labels and occasional shooting stars. The notebook illustration remains independent. The retired black-hole disk/ring component must not be restored as the homepage background.

## Rendering budget

The base scene is a deterministic SVG: 52 small stars, 21 circuit nodes and 20 paths. Only the star group's opacity and five dashed signal paths have continuous CSS motion. There is no Canvas, WebGL, 3D projection, particle field or frame-by-frame gradient generation.

JavaScript schedules one 2.7-second meteor at a time, first after 4.5 seconds, with a 16–24-second gap thereafter. Only the active meteor uses requestAnimationFrame, capped to 24 drawing updates per second on narrow screens and 30 elsewhere. Between meteors there is no JavaScript frame loop. A single positioned HTML element supplies the tail/head. Its geometry uses physical screen coordinates in both text directions.

## Panel reflections

Homepage post cards, the notebook, author panel and RSS aside receive a noninteractive local `.space-reflection` overlay. A scoped child-list observer registers cards after search/filter rerenders and removes disconnected entries. Each panel has one overlay. Never put an overlay on a form control, cover it with a hit target, or move the card's content into an extra wrapper.

Panel bounds are measured at most ten times per second **only during a meteor**. Nearby panels receive a local lime fill and masked rim; distant cards stay dark. The same head coordinates drive the visible meteor and reflection. Do not light every panel uniformly or read layout on every display frame.

Hidden tabs, resize and OS reduced motion cancel the scheduled meteor, active frame and reflected light. Returning restarts a bounded delay. Reduced motion retains a static SVG and print hides all decoration. Cleanup removes timers, frame callbacks, observers, classes and overlays. Keep the scene clipped to the viewport so it cannot create horizontal overflow at 360px.

## Checks

Build and inspect Persian and English homepages at desktop and 360px widths. Check that the old central ring/disk and Canvas are absent, cards remain readable, filters can replace cards without duplicate overlays, the meteor and nearby reflections agree, reduced motion stops movement, and article pages do not load this homepage controller. Preserve the original fonts, notebook, header, article layout, canonical URLs and portfolio source.
