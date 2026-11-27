# Homepage black-hole sky

`web/components/black-hole.tsx` owns a decorative fixed Canvas 2D layer on the **two homepages only**. Article backgrounds and the notebook illustration remain independent. No image/video download, WebGL dependency, animation library, remote service or user input is needed.

The visual model draws distant stars, a central shadow, a projected accretion disk, bent far-side disk arcs, an asymmetric bright approaching side, inward matter tracers and a periodically stretched capture stream. Differential angular motion follows an integrated `omega(r) ∝ r^-3/2` law along a prescribed dissipative radial path.

This is an artistic approximation informed by black-hole anatomy, **not** a general-relativistic ray tracer or an accurate simulation of a particular mass/spin/viewpoint. The background-star displacement and lensed disk arcs are deliberately bounded visual approximations; Doppler brightness, emission spectrum, time scale, radius and drag are not calculated from a Kerr metric. A black hole does not suck every distant star into it: stable background stars remain separate from the infalling stream.

Scientific references:

- [NASA: Anatomy of a black hole](https://science.nasa.gov/universe/black-holes/anatomy/)
- [NASA Goddard: Accretion disk visualization](https://svs.gsfc.nasa.gov/13326/)

Keep pixel density capped at 1.25 on narrow screens and 1.5 elsewhere, matter tracers bounded to 110/210, stars to 75/150 and drawing to 24/30 frames per second. Hidden tabs stop requesting frames; returning resumes from the prior scene time without a jump. Reduced motion draws a static frame. Resize resets bounded arrays and the backing resolution. Cleanup removes listeners and cancels frames; print hides the sky. Never place an opaque root over the decorative canvas or let it intercept pointer events.
