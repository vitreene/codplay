# FLIP Demos

Status: En cours  
CodPlay version: V2 foundation

## Reference

`flip` is the preserved Player POC reference demo. It remains unchanged as the
first validated FLIP fixture and keeps its current timeline and debug controls.

## Stress Test

`flip-stress` is now a declarative `SceneDoc` consumed by
`HtmlPlayerRunner`. It exercises:

- four moving root containers;
- delayed visibility of C and D;
- fixed parent dimensions with responsive root anchoring to isolate FLIP from content-driven reflow;
- cross-container overlay transfers of Q and K;
- Q/K list components with content outlets and all twelve children exchanged through declarative moves;
- Q/K children are displayed as distinct color-coded pills in a 3×2 grid;
- Q/K transfers follow inward center-facing arcs, while every child transfer gets a distinct deterministic pseudo-random SVG path;
- nested content transfers in alternating order;
- overlapping transitions with different durations;
- runner-owned cold seek, overlay lifecycle, resize invalidation and teardown.

The stress root fills its containing zone in both dimensions. Its A–D anchors
and vertical motion use the root's responsive percentage coordinate system, and
the stage observes its own size so width changes recapture the motion endpoints
at the current logical time.

The stress entry point remains a separate Vite page, but its scene, parentage,
capture, overlay and transport lifecycle are owned by the V2 runner. The first
content exchange starts at `1200ms` so it overlaps the Q/K transfer without
sharing the same capture-construction boundary; the remaining exchanges follow
every `500ms` through `6700ms`. Each content transition lasts `1000ms`, so the
fixture deliberately keeps two opposite-direction item transitions active at
the same time. Path generation is seeded by the content ID, so Play and Seek
always receive the same geometry.

The demo must remain a validation surface: no capture construction, DOM
reparenting, overlay mutation or second playback clock belongs in its source.

Play and Seek are only two ways to reach one logical time. Both commit through
the runner's shared projection boundary; the demo does not contain a second
presentation algorithm for Play.

The stress fixture now uses an explicit hierarchical ownership contract. The
capture builder keeps ancestor chains as coordinate context only: an ancestor
is an animated entry only when it is the direct mover of its own capture. An
`overlay-world` group projects every touched item independently, so a
descendant capture cannot acquire, replace or cancel ownership of Q or K.
Parent ghosts hide descendants that have their own overlay, while the parent
trajectory continues independently. Safari checks at `1000ms`, `1700ms`,
`2200ms` and `2700ms` confirm that B's authored motion continues and that Q/K
ghosts remain active while two child content transitions overlap.

## Standard demo baseline

`flip-stress` is also the reference scaffold for the next CodPlay V2 standard
demos. It is not only a regression fixture. A standard demo should retain its
following boundaries:

- a declarative `SceneDoc` as the scenario source;
- `HtmlPlayerRunner` as the only owner of materialization and position capture,
  presentation and the clock-facing Play/Seek entry points;
- the shared demo shell with Play, Reset, absolute-time seek, named
  checkpoints and an observable status line;
- a responsive root that is measured at its real content-box dimensions;
- explicit checks at FIRST, the event boundary, a middle frame and LAST,
  followed by the same-time Play/Seek comparison and a resize check;
- local projection for a target-preserving reorder and overlay projection only
  for a reparent operation.

The four moving containers, twelve colored children, SVG paths and overlapping
transitions are stress parameters. A standard demo may remove or reduce them,
but must keep the declarative scene, the runner-owned lifecycle and the same
observable checkpoints. The older `flip` page remains a preserved Player POC
reference; it is not the template for new V2 demos.
