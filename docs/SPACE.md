# Journal background

`web/components/journal-background.tsx` renders the decorative background on both journal homepages. The current direction is deliberately quiet: tiny drifting stars with faint book, page, pen, quotation, bookmark and RSS outlines. The independent notebook illustration remains unchanged.

## Rendering and motion

The background is static server-rendered markup: three groups of fourteen stars, plus six small inline SVG motifs. All positions are deterministic and independent of page language. CSS animates only transform and opacity: star groups drift about twenty pixels over 64–92 seconds; motifs float twelve pixels over 32–47 seconds. There is no background JavaScript, Canvas, WebGL, random spawning, timer, observer or layout measurement.

Stars are one or two pixels, with low opacity. Motifs use thin strokes and 11% opacity on desktop, reduced to 7.5% on mobile, where two motifs are hidden. Decoration must remain behind the content, noninteractive, clipped to the viewport and hidden from assistive technology. It must not create horizontal overflow or interfere with search, links, selection or reading.

The homepage hides the older ambient layer so the dot grid and animated green wash do not stack with the new scene. Article pages retain their existing ambient treatment. System reduced motion makes the new background static; print hides it entirely.

## Retired effects

The owner requested removal of the former background. Do not restore circuit traces, light packets, meteors, card reflections or a central black-hole disk/ring. The old client controller and its reflection CSS were deleted; do not reintroduce a runtime animation library or inject overlays into cards.

## Checks

Inspect Persian and English homepages at desktop and 360px widths. Confirm stars and writing motifs are subtle, CSS animations are active in normal motion, reduced motion stops them, and the old sky/meteor/reflection DOM is absent. Keep content, the notebook, fonts, navigation, article layouts, canonical URLs and the separate portfolio source intact.
