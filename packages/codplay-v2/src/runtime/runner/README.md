# HTML Runner V2

> Status: A relire
> CodPlay version: V2 foundation

## Role

`HtmlPlayerRunner` binds a compiled scene, a `RuntimePlayer`, component services
and one HTML root. Its presentation pipeline is unique:

```text
SolvedScene(t)
  -> authored component sync
  -> structural DOM projection
  -> resolvePresentationFrame(t)
  -> atomic HTML motion commit
```

Play and Seek invoke this exact operation. The runner contains no historical DOM
replay, capture cache, alias, handoff or demo-specific mutation.

## Isolated layout sampling

The runner owns a second, offscreen HTML substrate used only to measure natural
layout. It uses a companion `RuntimePlayer` with the same `StructuralTimeline`,
component catalog and `LayoutDomBackend` contracts as the visible host, while
sharing the visible player's `RuntimeTrackJournal`. Its width and height are
copied exactly from the visible root; this matters for authored percentage-based
positions, which must produce the same LAST geometry in both substrates.

For each compiled movement boundary at `t` it measures:

- FIRST: `resolveSceneBeforeBoundary(t)`, excluding the event;
- LAST: `resolveSceneAt(t)`, including the event.

LAST is therefore the immediate consequence of the event, never the global scene
at the end of the animation duration. The isolated DOM supplies geometry only;
it never supplies identity, order or parentage.

## Local and reparent presentation

Both modes consume the same resolved item pose.

### Local

Local projection applies reserved size and transform slots to the real source
node in its current parent. It is inferred when target identity is unchanged and
is the default for an intra-list reorder.

All active local sizes are written first, then matrices are solved parent-first.
This prevents one item from calculating against a partially updated sibling
layout.

### Reparent

Reparent projection masks the source and creates an item-indexed representation
inside the root overlay. It is forced whenever target or logical parent changes,
including a transfer from one list to another. Authoring `flipMode:
'overlay-world'` can also request it explicitly.

Overlay poses are localized against the measured overlay layer itself, including
root borders and transforms. An independently moving descendant is hidden in an
ancestor clone. If a local segment is nested under an active overlay ancestor,
the host promotes only its representation to overlay so it remains visible; its
trajectory and timing do not change.

## Lifecycle

- `init()` initializes visible and measurement component hosts, then builds the
  immutable motion graph.
- `play()` and `seek(t)` present the graph at absolute logical time.
- `resize()` invalidates measured endpoints and rebuilds the graph before the
  current frame is recommitted.
- `destroy()` removes local transient slots, overlay representations, measurement
  DOM, components and owned clock resources.

## Invariants

- The visible DOM is never used to reconstruct logical state.
- The measurement DOM never receives transient motion styles.
- The visible and measurement players share live event history; the measurement
  player never executes listen rules or straps.
- Every item owns its temporal segments independently.
- Parent movement is composed recursively at resolution time.
- An overlapping local reflow retargets its existing segment at the already
  resolved visual pose and keeps its interpolation phase; it does not restart
  easing at zero.
- One source or one independent representation is visible per item.
- HTML pose composition uses affine origins and matrices; `rect.left/top` remain
  derived AABB values only.
