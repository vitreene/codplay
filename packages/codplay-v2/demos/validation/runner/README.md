# HTML runner validation demo

Status: En cours  
CodPlay version: V2 foundation

## Scenario

This browser vertical compiles declarative `SceneDoc` values and presents them
through `HtmlPlayerRunner`. The scenario selector exposes two complementary
captures:

- `List / local FLIP`: A moves from `source-outlet` into the target list at
  `800 ms` with mode `first` and a `1400 ms` local FLIP transition. The order
  changes from `[B, C]` to `[A, B, C]`; the list capability owns the order and
  touched set, so the capture includes A, B and C.
- `Nested overlays / layout cut`: P moves into the target list while Q changes
  outlet inside P. P and Q use `overlay-world`, while B and C remain local
  siblings. The host declares `overlay-target-layout` as the historical layout
  cut, making the ancestor regime visible in the same runner vertical.

The target outlets keep their centered auto-height behavior so the container
size transition can be observed symmetrically. The status line reports the
logical list order, inspected DOM nodes, modes, touched set, overlay ghost count,
hidden clone count and projection epoch.

The runner owns materialization, logical parentage, FIRST/LAST capture, local pose
projection and transport lifecycle. The demo does not implement a second render
loop or a demo-owned capture algorithm.

## Manual checks

1. Run `npm run demo:runner` from `packages/codplay-v2`.
2. In `List / local FLIP`, at `0 ms`, verify the list order is `[B, C]` and A
   is in the source outlet.
3. Reset and Play; observe A entering the list at `800 ms` and the order becoming
   `[A, B, C]`. A must be the first visual item as well as the first DOM child.
4. Use `FIRST`, `REORDER` and `LAST`; compare the displayed list order and pose.
5. Select `Nested overlays / layout cut` and inspect `FIRST`: P is in the
   source outlet, Q is in P's first outlet, and the overlay layer has no ghosts.
6. Inspect `REORDER`: the list order is `[P, B, C]`, P and Q report
   `overlay-world`, the overlay layer contains two ghosts, and one hidden clone
   is reported. The parent ghost contains the hidden Q clone while Q owns its
   independent ghost.
7. Inspect `LAST`: the source nodes are visible, the overlay layer is empty, and
   Q remains nested in P's last outlet in the live DOM.
8. Seek directly to `REORDER` from reset in both scenarios; this exercises the
   compiled cold resolver.
9. Resize the viewport and verify the epoch increments without duplicating nodes.
10. Refresh or leave the page and verify no runner-owned nodes remain attached.

The demo remains declarative: it contains no capture, mutation, overlay or FLIP
projection algorithm. It only selects scenes and renders diagnostics from the
runner-owned DOM state.

In this document, a cold seek means a seek performed before Play has created a
cached capture. The runner temporarily presents the logical state before and
after the compiled move, measures both states, restores the current scene, and
then projects the numeric capture at the requested time.
