# HTML runner validation demo

Status: En cours  
CodPlay version: V2 foundation

## Scenario

This browser vertical compiles one `SceneDoc` and presents it through
`HtmlPlayerRunner`. One item moves from `source-outlet` into the target container
at `800 ms` with mode `first` and a `1400 ms` local FLIP transition. Items B and C
are already in the target list, so the order changes from `[B, C]` to `[A, B, C]`.
The list capability owns the order and touched set; the FLIP capture includes all
three items. The target outlet keeps its centered auto-height behavior so the
container's size transition can be observed symmetrically.

The runner owns materialization, logical parentage, FIRST/LAST capture, local pose
projection and transport lifecycle. The demo does not implement a second render
loop or a demo-owned capture algorithm.

## Manual checks

1. Run `npm run demo:runner` from `packages/codplay-v2`.
2. At `0 ms`, verify the list order is `[B, C]` and A is in the source outlet.
3. Reset and Play; observe A entering the list at `800 ms` and the order becoming `[A, B, C]`.
4. Use `FIRST`, `REORDER` and `LAST`; compare the displayed list order and pose.
5. Seek directly to `REORDER` from reset; this exercises the compiled cold resolver.
6. Resize the viewport and verify the epoch increments without duplicating nodes.
7. Refresh or leave the page and verify no runner-owned nodes remain attached.

The demo remains declarative: it contains no capture, mutation, overlay or FLIP
projection algorithm. `overlay-world` and live moves are not part of this
validation vertical yet.

In this document, a cold seek means a seek performed before Play has created a
cached capture. The runner temporarily presents the logical state before and
after the compiled move, measures both states, restores the current scene, and
then projects the numeric capture at the requested time.
