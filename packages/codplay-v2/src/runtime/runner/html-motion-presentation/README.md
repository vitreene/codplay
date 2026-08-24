# HTML motion presentation internals

> Status: Fixe
> CodPlay version: V2 foundation

This folder specializes the geometry and DOM-tree helpers used by
`HtmlMotionPresentationHost`:

- `geometry.ts` owns pose localization and affine comparisons;
- `tree.ts` owns overlay ancestry, stable clone paths, ordering and cleanup;
- `types.ts` owns overlay resource contracts.

The host remains the sole orchestrator of the existing HTML presentation
circuit.
