# Motion Graph V2

> Status: Fixe
> CodPlay version: V2 foundation
> Review: graphe de mouvement et résolution Play/Seek validés le 2026-08-20; materializer de production hors périmètre

## Contract

The motion module transforms immutable structural layout boundaries into one
immutable temporal graph indexed by item.

```text
Compiled movement intents
  + LayoutSnapshot(before event)
  + LayoutSnapshot(after event)
  -> MotionGraph
  -> resolvePresentationFrame(graph, currentLayout, t)
```

It has no DOM handles, no transport state and no mutable animation ownership.

## Data model

- `LayoutSnapshot`: complete measured item map with target, logical parent,
  parent-relative pose and root-relative pose.
- `MotionBoundary`: exact before/after layouts caused by one event time and its
  direct movement intents.
- `ItemMotionTrack`: chronological segments owned by one item.
- `MotionAttachment`: parent ID, target ID, local pose and root fallback for one
  endpoint.
- `PresentationFrame`: complete item pose and requested representation at an
  absolute time.

## Planning

At each boundary the planner compares complete local attachments. It creates a
segment for every item whose parent, target or local layout pose changed. A child
whose local attachment is unchanged does not duplicate its ancestor's segment;
it follows through recursive composition. The `before` snapshot is the source
layout supplied for that boundary; no capture-specific marker or second motion
algorithm is used.

The runner may compile two schedules from the same journal: the current
presentation schedule excludes `persist-only` facts, while a reconstruction
schedule includes them. Both schedules are converted to the same
`MotionBoundary` and resolved by the same graph. Consequently, a live
`endEmit` uses the current visible FIRST layout, whereas a seek uses the
persisted logical source-to-target boundary without retaining a live-capture
branch in the graph.

The HTML runner invalidates this schedule with the monotonic revision of its
shared `RuntimeTrackJournal` and the current `includePersistOnly` flag. It
therefore compiles the schedule at initialization or after a journal change,
not on every presentation frame. A standalone `HtmlMotionSystem` may omit the
revision callback; that compatibility path keeps the signature comparison but
is not the runner's production path.

Direct intent timing applies to its item. Other reflow items use the longest
direct duration at that boundary. A target or parent change forces presentation
mode `reparent`; otherwise the optional author hint selects `local` or
`reparent`.

When a boundary overlaps an existing segment, the destination is retargeted at
the exact boundary while the existing segment keeps its phase, authored path and
end time. Its virtual source is solved in the same geometry used by path
interpolation, so the pose remains continuous for both linear and curved
trajectories. No active segment is restarted from easing progress zero,
cancelled globally or replaced by a logical endpoint.

## Resolution

Resolution is pure and recursive:

1. select the latest segment active for the item at `t`;
2. resolve source and destination parents at `t`;
3. compose stored local attachments with those parent poses;
4. interpolate the two resolved poses with ACE easing/path;
5. recursively resolve unchanged descendants from their current parent pose.

The same graph and current natural layout always produce the same frame. Calling
the resolver for earlier times has no effect on later calls.

## Presentation inference

- same target: `local` by default;
- different target or logical parent: `reparent`;
- explicit `flipMode: 'overlay-world'`: `reparent` even when target is unchanged;
- explicit `local` cannot downgrade an actual target/parent change.
