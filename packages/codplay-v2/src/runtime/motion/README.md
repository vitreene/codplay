# Motion Graph V2

> Status: En cours
> CodPlay version: V2 foundation
> Review: frontières move/action, résolution Play/Seek et absence de lecture géométrique par frame validées le 2026-08-23

## Contract

The motion module transforms immutable structural layout boundaries into one
immutable temporal graph indexed by item.

```text
Compiled movement/action intents
  + LayoutSnapshot(before boundary/action)
  + LayoutSnapshot(after boundary/action)
  -> MotionGraph
  -> resolvePresentationFrame(graph, currentLayout, t)
```

It has no DOM handles, no transport state and no mutable animation ownership.

## Data model

- `LayoutSnapshot`: selected measured item map with target, logical parent,
  parent-relative pose and root-relative pose. The parent-relative pose is the
  only local reference used by presentation; no offset from an intermediate DOM
  wrapper is exported into the motion contract. The runner adds only the
  ancestor and target-child closure required by the boundary.
- `MotionBoundary`: exact before/after layouts caused by one event boundary and
  its direct movement intents. For an action-owned pose transition, `before` is
  captured at the action start and `after` at `start + delay + duration`.
- `ItemMotionTrack`: chronological segments owned by one item.
- `MotionAttachment`: parent ID, target ID, local pose and root fallback for one
  endpoint.
- `MotionGraph.presentationItemIds`: the items that own a trajectory requiring
  presentation, prepared once from the boundary scopes. Their parent context
  remains in the captured snapshots; the frame resolver does not enumerate
  unrelated items from the current layout.
- `PresentationFrame`: current pose and requested representation only for the
  trajectory owners that need presentation at an absolute time.

For a structural `move`, the captured target closure includes every item whose
target is the source or destination target at that boundary. This includes a
future direct mover when it is a current list participant: its natural layout
must remain available so the graph can present the list reflow. An item captured
only as an ancestor dependency is handled differently: if it owns another
motion track, its dependency snapshot must not overwrite that track's natural
timeline. This distinction keeps list reflows animated without retargeting an
unrelated parent.

## Planning

At each boundary the planner closes the dependency scope over the direct movers,
the source/target reflow items and every ancestor up to the root. It compares the
selected local attachments, but only direct movers and reflow items may own a
segment. Ancestors remain in the scope so the resolver can inspect their own
segment, if they have one, before falling back to their natural pose. A child
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

The HTML runner compiles the schedule when the visible journal is initialized,
after a completed live capture, and after a resize. The schedule contains both
`move.transition` declarations and materializer-specific action transitions that
produce a geometric pose. `HtmlMotionSystem` receives only the resulting
immutable `MotionBoundary[]`; it does not inspect the journal, discover actions
or maintain a compatibility sampler. Natural geometry is captured at the
corresponding FIRST/LAST boundaries (or after an explicit structural
invalidation), then retained as data in the presentation state. During a frame,
the motion system resolves the same graph without asking the DOM for a new
layout or creating a measurement tree.

Direct intent timing applies to its item, including its optional delay. Other
reflow items use the longest effective timing at that boundary. A target or
parent change forces presentation mode `reparent`; otherwise the optional author
hint selects `local` or `reparent`.

When a boundary overlaps an existing segment, the destination is retargeted at
the exact boundary while the existing segment keeps its phase, authored path and
end time. Its virtual source is solved in the same geometry used by path
interpolation, so the pose remains continuous for both linear and curved
trajectories. No active segment is restarted from easing progress zero,
cancelled globally or replaced by a logical endpoint.

## Resolution

Resolution is pure and item-scoped:

1. select only the trajectory owners in the prepared `presentationItemIds`;
2. select the latest segment active for the item at `t`;
3. evaluate the item's current pose, using captured parent context privately
   when an independently moving parent affects its world position;
4. interpolate the stored source/destination attachments with ACE easing/path;
5. emit only the item's presentation entry.

The parent influence cannot be discarded: independently moving ancestors change
the exact world pose of a child. What is removed from the frame path is the
generic traversal of the whole layout and the construction of presentation
entries for unchanged ancestors and descendants. The graph closes the
dependency scope during preparation; the frame computes only trajectory-owner
poses, with no DOM read and no measurement tree. Parent arithmetic remains an
internal dependency of the requested item's exact pose; it is not a second
presentation trajectory or a second output entry.

An ancestor's presence in this walk does not by itself create a FLIP segment.
If that ancestor has its own declared structural transition, its segment is
composed normally. If it has no structural segment, its natural materializer
pose remains the provider for the descendant. This is the boundary between
motion ownership and hierarchical pose composition.

The same graph and current natural layout always produce the same frame. Calling
the resolver for earlier times has no effect on later calls.

An action-owned HTML pose transition remains in the graph for descendant
composition, but its source service owns the author-node pose. The HTML host
therefore presents that item as `source` and does not apply a second local
matrix; descendants still resolve against the graph's pose.

The HTML runner clears its previous local presentation before capturing the
current natural layout. Stable overlay resources remain outside normal layout
and are reused; they are released only when inactive or destroyed. A resize
therefore recaptures against the resized author nodes rather than against a
previous animation transform, without recreating stable overlay DOM.

## Presentation inference

- same target: `local` by default;
- different target or logical parent: `reparent`;
- explicit `flipMode: 'overlay-world'`: `reparent` even when target is unchanged;
- explicit `local` cannot downgrade an actual target/parent change.
