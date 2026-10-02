# Elcé

Elcé is the métier application that authors Elcé documents and projects their
pages through CodPlay and Sighty. The first workspace opens with one chapter,
one Flux page and one Section. The outline can add a chapter or page with an
optional name, move a page between a chapter, the scenario root and the
catalogue by dragging it, and distinguish moving it from permanent deletion.
Selecting a Flux page opens its single WYSIWYG Section editor; the
player composition remains a separate reading surface and opens from the
`Prévisualiser` action in a document-level modal.

Run the application from the repository root:

```sh
npm run dev --workspace=@codplay/elce
```

The development server uses port `5175`.

The workspace also exposes `typecheck`, `test`, `build`, and `preview` scripts.
