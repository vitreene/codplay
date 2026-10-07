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

To store projects and uploaded media locally, start the Elcé API in another
terminal:

```sh
npm run dev:api --workspace=@codplay/elce
```

The editor keeps only its currently open document in IndexedDB as a temporary
cache. The API stores projects in `packages/elce/.elce-data/elce.sqlite` and
media files under `packages/elce/.elce-data/media/`. After an image upload, its
original filename remains in SQLite; the physical file uses an internal
storage name. The `Synchronisé` status in the editor confirms that the server
accepted the document and its media.

To exercise the anchored Flux path in the application itself, open the editor,
drop an image or video file into the Section WYSIWYG surface, then select
`Prévisualiser`. The editor command path creates the media reference, bdc and
anchor; the preview mounts the resulting scene through Sighty and CodPlay.
