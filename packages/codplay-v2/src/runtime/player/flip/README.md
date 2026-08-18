# Move / FLIP projection

Status: En cours  
CodPlay version: V2 foundation

This folder owns the integration boundary between solved `MoveStateDelta` values
and the standalone HTML FLIP runtime.

`MoveFlipLayoutProjection` wraps an existing `LayoutProjection`:

```text
RuntimePlayer
  -> MoveStateDelta + SolvedScene
  -> MoveFlipLayoutProjection
      -> FLIP capture FIRST
      -> base layout projection mutation
      -> FLIP capture LAST
  -> HtmlFlipRuntime advancement on later frames
```

The wrapper does not decide list order or resolve mount targets. A
`MoveFlipCaptureBuilder` converts the solved move deltas and host handles into a
`FlipCaptureRequest`. It is the host integration point for ancestor chains,
`flipMode`, and prepared path values.

Seek uses the base projection directly and cancels active FLIP ownership. FLIP is
therefore a frame projection of a move transition, not a second logical state
engine or clock.
