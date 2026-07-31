# Player

> Status: En cours
> CodPlay version: V2 foundation

This folder owns one runtime instance of a compiled scene.

- materialization, resolution, and solve
- lifecycle and mounting root
- playback, injection, authoring, and observation channels

The player receives an engine and a `CompiledScene`; it does not create its
own clock or compile authoring data.
