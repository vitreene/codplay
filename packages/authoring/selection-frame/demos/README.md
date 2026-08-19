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
- fixed parent dimensions to isolate FLIP from content-driven reflow;
- cross-container overlay transfers of Q and K;
- Q/K list components with content outlets and all six children exchanged through declarative moves;
- Q/K children are displayed as distinct horizontal color-coded pills;
- nested content transfers in alternating order;
- overlapping transitions with different durations;
- runner-owned cold seek, overlay lifecycle, resize invalidation and teardown.

The stress entry point remains a separate Vite page, but its scene, parentage,
capture, overlay and transport lifecycle are owned by the V2 runner. The first
content exchange starts at `1200ms` so it overlaps the Q/K transfer without
sharing the same capture-construction boundary; the remaining exchanges follow
every `500ms` through `3700ms`. Each content transition lasts `1000ms`, so the
fixture deliberately keeps two opposite-direction item transitions active at
the same time.

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
