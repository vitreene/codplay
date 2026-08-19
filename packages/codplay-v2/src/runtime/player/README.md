# Player

> Status: A relire
> CodPlay version: V2 foundation

## Role

`RuntimePlayer` evaluates one immutable `CompiledScene` at an absolute logical
time. Its canonical pipeline is:

```text
CompiledScene + time
  -> materialize
  -> resolve
  -> solve
  -> SolvedScene + SolvedGraph
```

The player owns lifecycle, component synchronization and structural projection.
It does not measure browser geometry and does not own an animation clock.

## Structural timeline

`StructuralTimeline` builds complete immutable child-order snapshots from
compiled event boundaries. It replaces mutable list replay and historical module
state. Every `SolvedScene` receives the order selected by that same timeline,
whether its caller is Play, Seek or the isolated HTML layout sampler.

The timeline exposes both sides of an event boundary:

- `resolveAt(t)` includes events at `t`;
- `resolveBefore(t)` excludes events at `t`.

`materializeSceneBeforeBoundary()` implements the left-side evaluation directly;
no numerical epsilon is used. An event at `0 ms` therefore has a real initial
state and a distinct post-event state.

## Presentation circuit

Play and Seek both commit through `LayoutProjection.project(scene)`. A projection
receives one complete solved scene and performs one authored DOM synchronization
before any optional motion presentation. There is no `advance`-specific visual
path, historical replay path or module-owned child-order map.

`SolvedGraph` is the only source for:

- logical parent by item;
- opaque target by item;
- complete child order by target;
- mounted roots and structural revision.

The optional `flipMode` remains placement metadata for projection consumers; it
never changes target resolution or structural ordering.

## Runtime events

`RuntimePlayer.emit()` is the live entry point. It appends the source event to
the player's declared `RuntimeTrackJournal`, selects story rules before scene
fallback, executes transforms and awaited straps, persists strap outputs on
their dedicated tracks, and reinjects only declared `emit` records with a
bounded cascade depth.

The visible runner and its isolated measurement host share this journal. Play
may update the presentation immediately, while a later Seek reads the same
source, emitted events, strap events and state updates without calling any
strap or transform again.

## Temporal actions

`ActionSequence` is expanded during `materialize` into direct actions owned by
the perso that declared the key. The expansion is pure: it never appends
continuation events or creates a second replay path. A later occurrence replaces
the pending steps of the same key; already-applied static steps remain facts,
while a replaced `TweenAction` is no longer evaluated at the target.

`TweenAction` is resolved from the player's compiled function collection with
`progress = ease(clamp(elapsed / duration))`. Its returned payload uses the same
state application as a static action. `tween:stop` is intercepted as a logical
boundary and does not become a perso patch.

## Invariants

- Logical state is never reconstructed from the DOM.
- A target order contains every mounted child exactly once.
- Boundary-side evaluation is explicit and scale-independent.
- Component services are the only writers of authored DOM state.
- Modules may observe move deltas, but cannot provide an alternative layout
  history to Play or Seek.
- `RuntimeTrackJournal` is the only live event history; no dispatch path creates
  an undeclared track.
- `seek()` is materialization-only for events, transforms and straps.
- `ActionSequence` and `TweenAction` are derived and evaluated by the same
  `materialize -> resolve -> solve` path for Play and Seek.
