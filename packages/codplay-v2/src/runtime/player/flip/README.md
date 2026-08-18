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
      -> HtmlPresentationTransaction: read FIRST
      -> base layout projection mutation
      -> HtmlPresentationTransaction: read LAST
      -> HtmlMeasurementTree / FlipCaptureCache
      -> one FLIP pose commit
  -> HtmlFlipRuntime advancement on later frames
```

The wrapper does not decide list order or resolve mount targets. A
`MoveFlipCaptureBuilder` converts the solved move deltas and host handles into a
capture description. It is the host integration point for ancestor chains,
`flipMode`, prepared path values, and the stable `transitionOccurrenceId` carried
by the player journal.

Seek uses the base projection directly, then asks `seekCached()` for the active
occurrences; a missing compiled capture is realized by the same runner transaction
used by a frame. FLIP is therefore a presentation capability, not a second logical
state engine or clock.
