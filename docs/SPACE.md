# Journal background

`web/components/journal-background.tsx` owns the decorative layer on both journal homepages. The visual language combines software and writing: gently flowing 0/1 streams, small code fragments such as `<article>` and `write()`, and two thin outlines of editorial notes. The independent hero notebook remains unchanged.

## Rendering and motion

The layer is deterministic server-rendered markup with CSS-only motion. Four masked binary windows each contain two identical twelve-row chunks; the track translates by half its height for a seamless 38–50-second loop. Each row is 24px tall, so a chunk stays taller than the maximum 260px window. Negative delays make the scene active on first paint. Do not change row height, duplicate count or maximum window height independently.

Six code fragments drift 28px over 24–39 seconds. Two note outlines float 24px over 28–34 seconds, with a small angle change. A faint lime/teal radial wash shifts slowly behind them. Only transform and opacity are animated; masks are static. There is no background JavaScript, Canvas, WebGL, timer, observer or layout measurement.

Binary windows are 16% opaque on desktop and 12% on mobile. Code and notes use 10–14% opacity. Mobile hides two binary windows and two fragments and reduces note size/opacity. Keep the scene legible but subordinate to the article titles; do not add neon flashes, fast falling digits or bright overlays. The entire layer is clipped, noninteractive, unselectable, explicitly LTR and hidden from assistive technology. It must not create horizontal scrolling in either page language.

The homepages hide the older ambient layer to avoid stacking backgrounds. Article pages retain their existing treatment. Reduced motion stops all background animations. Print hides the decoration.

## Retired effects

The former stars-only background was replaced by the binary/editorial design. Do not restore circuit paths, light packets, meteors, card reflections or a central black-hole disk/ring. Do not inject overlays into cards or add a runtime animation library.

## Checks

Inspect Persian and English at desktop and 360px widths. Confirm binary digits flow seamlessly, code and notes move gently, the normal content stays readable/clickable, reduced motion stops animation and the old star/sky/meteor/reflection DOM is absent. Keep the notebook, fonts, navigation, article layout, public URLs, moderation behavior and portfolio repository intact.
