# Player

> Status: En cours
> CodPlay version: V2 foundation

This folder owns one runtime instance of a compiled scene.

- materialization, resolution, and solve
- lifecycle and mounting root
- playback, injection, authoring, and observation channels

The player reconstructs `materialize -> resolve -> solve` during seek without
replaying straps or effects. A seek returns a structured result with `ok`, `timeMs`,
and diagnostics. Solved placement exposes generic `mount`, `unmount`, and `move`
deltas to capabilities such as list.

The player receives an engine and a `CompiledScene`; it does not create its
own clock or compile authoring data.

When a component host is attached, initialization materializes the first scene
before initializing player-scoped modules. This lets markup modules publish
their outlet targets before capabilities such as list snapshot initial child
orders, including lists nested below HTML outlets.

`LayoutProjection.project()` receives the solved scene and the optional previous
scene/deltas for one commit. Play and Seek both use this same commit. The legacy
There is no second `advance()` presentation hook: every target time enters this
same commit boundary.

`SolvedScene.graph` is the canonical immutable parentage/order snapshot. It owns
target membership, parent-first traversal and a structural revision; renderers
and modules must validate overrides against it instead of merging independent
child maps.

`MemoryRenderSink` receives the player-produced temporary snapshots. Those
snapshots contain resolved perso state and, when available, compact placement
data (`kind`, `mounted`, and `targetId`) for readouts that must not rebuild the
player pipeline themselves.
