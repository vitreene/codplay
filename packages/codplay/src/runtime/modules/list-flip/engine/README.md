# Runtime FLIP Engine

Status: Fixe
CodPlay version: V1 reference

This folder contains the generic FLIP runtime engine.

Main modules:

- `create-flip-engine.ts`
- `matrix-2d.ts`
- `types.ts`

Integration note:

- for animejs DOM usage, `run({ applyInvertTransformToTarget: false })` is recommended to avoid transform write conflicts.
