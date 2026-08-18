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

`LayoutProjection.project()` may receive the previous solved scene and the
`MoveStateDelta` values for the current frame. `LayoutProjection.advance()` may
then advance a projection capability such as `MoveFlipLayoutProjection` without
creating a second clock.

`MemoryRenderSink` receives the player-produced temporary snapshots. Those
snapshots contain resolved perso state and, when available, compact placement
data (`kind`, `mounted`, and `targetId`) for readouts that must not rebuild the
player pipeline themselves.
