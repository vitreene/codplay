# HTML Runner V2

> Status: Fixe
> CodPlay version: V2 foundation
> Review: runner HTML et présentation locale/reparent validés le 2026-08-20; renderer de production hors périmètre

## Role

`HtmlPlayerRunner` binds a compiled scene, a `RuntimePlayer`, one
`RuntimeCapabilityCatalog` composed during CodPlay initialization and one HTML
root. Its presentation pipeline is unique:

```text
SolvedScene(t)
  -> authored component sync
  -> HTML layout materialization
  -> resolvePresentationFrame(t)
  -> atomic HTML motion presentation
```

Play and Seek invoke this exact operation. The runner contains no historical DOM
replay, capture cache, alias, handoff or demo-specific mutation.

## Isolated layout sampling

The runner owns a second, offscreen HTML substrate used only to measure natural
layout. It uses a companion `RuntimePlayer` with the same `StructuralTimeline`,
capability catalog and the same HTML `RuntimeMaterializer` contract as the visible host, while
sharing the visible player's `RuntimeTrackJournal`. Its width and height are
copied exactly from the visible root; this matters for authored percentage-based
positions, which must produce the same LAST geometry in both substrates.

For each compiled movement boundary at `t` it measures:

- FIRST: `resolveSceneBeforeBoundary(t)`, excluding the event;
- LAST: `resolveSceneAt(t)`, including the event.

LAST is therefore the immediate consequence of the event, never the global scene
at the end of the animation duration. The isolated DOM supplies geometry only;
it never supplies identity, order or parentage.

## Local and reparent presentation

Both modes consume the same resolved item pose.

### Local

Local presentation applies reserved size and transform slots to the real source
node in its current parent. It is inferred when target identity is unchanged and
is the default for an intra-list reorder.

All active local sizes are written first, then matrices are solved parent-first.
This prevents one item from calculating against a partially updated sibling
layout.

### Reparent

Reparent presentation masks the source and creates an item-indexed representation
inside the root overlay. It is forced whenever target or logical parent changes,
including a transfer from one list to another. Authoring `flipMode:
'overlay-world'` can also request it explicitly.

Overlay poses are localized against the measured overlay layer itself, including
root borders and transforms. An independently moving descendant is hidden in an
ancestor clone. If a local segment is nested under an active overlay ancestor,
the host promotes only its representation to overlay so it remains visible; its
trajectory and timing do not change.

## Lifecycle

- `init()` initializes visible and measurement component hosts, then builds the
  immutable motion graph.
- `play()` and `seek(t)` present the graph at absolute logical time.
- `resize()` invalidates measured endpoints and rebuilds the graph before the
  current frame is recommitted.
- `destroy()` removes local transient slots, overlay representations, measurement
  DOM, components and owned clock resources.

## Contexte du materializer

`HtmlPlayerRunner` reçoit le `RuntimeCapabilityCatalog` déjà composé lors de
l'initialisation de CodPlay. Les composants, leurs services, leurs modules et
leurs validateurs sont déclarés dans ce catalogue unique. Le runner crée les
instances du `RuntimeMaterializer` HTML nécessaires aux substrats visible et
isolé, mais aucun materializer n'enregistre de service ou de module.

Le facteur passé à `resize()`
s'applique uniquement aux longueurs numériques sans unité à la frontière HTML.
Par exemple, `x: 40` devient `40px` avec un facteur `1` et `80px` avec un facteur
`2`. Les unités auteur et les chaînes brutes `style.transform` sont conservées.

Le runner réapplique la frame résolue courante lorsque le facteur change ; il ne
reconstruit pas la scène compilée et ne rejoue pas la timeline.

### Exemple au resize

L'hôte possède la formule du zoom. CodPlay reçoit uniquement le facteur obtenu :

```ts
const designWidth = 1440

const runner = new HtmlPlayerRunner({
  // ...compiledScene, root, rootTargets et catalog
})

function applyViewportZoom(): void {
  runner.resize(window.innerWidth / designWidth)
}

window.addEventListener('resize', applyViewportZoom)
applyViewportZoom()
```

Dans cet exemple, une valeur auteur comme `x: 40` est écrite en `40px` avec un
facteur `1` et en `20px` lorsque la fenêtre produit un facteur `0.5`. Une valeur
qui porte déjà une unité, comme `x: '40px'`, ainsi qu'une chaîne brute
`style.transform`, ne sont pas redimensionnées. Le listener de resize appartient
à l'hôte et doit être retiré par celui-ci lors de la destruction du runner.

## Invariants

- The visible DOM is never used to reconstruct logical state.
- The measurement DOM never receives transient motion styles.
- The visible and measurement players share live event history; the measurement
  player never executes listen rules or straps.
- Every item owns its temporal segments independently.
- Parent movement is composed recursively at resolution time.
- An overlapping local reflow retargets its existing segment at the already
  resolved visual pose and keeps its interpolation phase; it does not restart
  easing at zero.
- One source or one independent representation is visible per item.
- HTML pose composition uses affine origins and matrices; `rect.left/top` remain
  derived AABB values only.
