# Journal background and panel light

`web/components/journal-background.tsx` owns the decorative field on both homepages. Keep the software/writing identity: six soft 0/1 streams, twelve drifting code fragments, three editorial note outlines, two faint typographic watermarks and eighteen tiny data points. The independent hero notebook remains unchanged. This richer composition extends the existing direction rather than replacing it.

## Base scene

The field is deterministic server-rendered markup animated with CSS. Binary windows use two identical twelve-row chunks and translate by half the track height for seamless 38–54-second loops. Rows are 24px tall; each 288px chunk must stay taller than the maximum 260px window. Code fragments, note outlines and data points move slowly with staggered negative delays. The faint lime/teal wash remains behind the content. Mobile shows three streams, fewer fragments and two smaller notes.

Keep low contrast, explicit LTR for code, clipped viewport bounds, pointer-events off, user-select off and aria-hidden decoration. Only transform and opacity animate in the base field. There is no Canvas, WebGL or runtime animation library. The homepages hide the older ambient layer; article pages retain their existing treatment. Reduced motion stops animations; print hides decoration.

## One shared light

`journal-illumination.tsx` is the only client controller for this effect. A small `01` signal follows a smooth 48-second figure-eight path in physical viewport coordinates. Its radial halo and all panel reflections use the same source position, independent of page text direction. The fixed field's actual bounding rectangle converts local drawing coordinates to viewport coordinates, including left-side RTL scrollbars. Narrow screens resize the halo around its center without scaling its translation coordinates.

The notebook, post cards, author/RSS panels and empty state own a noninteractive `.journal-reflection` span in React markup. `.journal-lit-panel` establishes its local positioning. The controller must never inject nodes, wrap content or modify React child order. The overlay supplies a faint local fill and a masked one-pixel rim; distant panels stay unlit. Reflection opacity uses squared distance falloff and is lower on mobile. Do not illuminate all cards uniformly.

The controller caches parent rectangles and measures only after invalidation by scroll, resize, image load, a main-area ResizeObserver or scoped child-list MutationObserver. Filter/search rerenders are re-registered on the next drawing update, including empty states. Attribute changes from lighting do not trigger the observer. Offscreen panels receive no gradient updates. One requestAnimationFrame loop caps drawing writes to 24 Hz on desktop and 18 Hz on mobile. Hidden tabs and reduced motion cancel the loop and clear the light. Cleanup disconnects observers/listeners and clears reflections.

## Boundaries and checks

Do not restore circuit paths, meteors, a black-hole disk, fast falling digits or neon flashes. The owner authorized gentle panel reflections for this design; older instructions banning every card reflection are superseded by this implementation. Keep moderation, content, fonts, URLs and the separate portfolio repository intact.

Inspect both languages at desktop and 360px. Check binary loops, source/reflection alignment, bright nearby versus dark distant panels, scrolling and search/filter rerenders without duplicate overlays, clickable cards, no horizontal overflow, and reduced motion. Confirm article pages do not mount the homepage controller.
