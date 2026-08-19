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

## Invariants

- Logical state is never reconstructed from the DOM.
- A target order contains every mounted child exactly once.
- Boundary-side evaluation is explicit and scale-independent.
- Component services are the only writers of authored DOM state.
- Modules may observe move deltas, but cannot provide an alternative layout
  history to Play or Seek.
