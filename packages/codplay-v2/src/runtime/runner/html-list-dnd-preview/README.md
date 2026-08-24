# HTML list DnD preview internals

> Status: Fixe
> CodPlay version: V2 foundation

This folder specializes the transient HTML preview used by
`HtmlListDndPreview`:

- `geometry.ts` owns pointer decoding, hit-testing and insertion slots;
- `effects.ts` owns ghosts and floating-node styles;
- `types.ts` owns preview and target contracts.

The controller remains HTML-only and never changes logical placement or the
runtime journal.
