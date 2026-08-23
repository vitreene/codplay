# HTML Runner V2

> Status: En cours
> CodPlay version: V2 foundation
> Review: capture géométrique sans DOM dupliqué en validation; renderer de production hors périmètre

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

Play and Seek invoke this exact operation. The runner retains only immutable
geometry boundaries and, during an open live capture, the presentation-only
FIRST snapshot needed by its current `endEmit` handoff. It never retains a
historical DOM tree or a second replay circuit. Seek selects the replayable
boundaries again; the live release pose is not replayed.

The motion schedule is compiled from the visible player's shared journal at
initialization, after a completed live capture, and after a resize. The frame
loop captures only the current natural geometry of the active item closure and
resolves the already-built graph; it does not rediscover actions or rebuild the
schedule on every frame.

## Position capture for motion

The runner never creates a second HTML tree, player, engine or materializer for
FLIP. When a transition `move` exists, an explicit position-capture phase reads
the persistent author nodes of the visible root and stores immutable geometry
snapshots. The phase first removes the runner-owned local transforms, size slots,
masks from the previous presentation. Existing overlay resources are retained
outside normal layout and reused; they are not a measurement tree. The phase
then uses the same materializations for `before` and `after`, without playing
media, reloading sources or destroying components. This reset is synchronous:
no browser frame is rendered between the natural-geometry read and the new
motion commit.

The reset also removes source masks left by the previous overlay frame. During
the commit, existing ghosts are moved into the parent-first order required by
the resolved frame; `appendChild` here reorders an existing node and does not
create one. Independent descendant masks are tracked per frame and cleared
before the next set is applied, so a reused ancestor ghost cannot retain a
stale hidden child.

The overlay does not emit neutral `translate`, `rotate` or `scale` declarations.
Those longhands are neutralized with `none` only when the author source has a
non-default value that would compose with the presentation matrix. This rule
does not modify the `transition` declaration.

This invariant concerns geometry capture. A `reparent` presentation may still
own a transient overlay representation because the author node must remain in
its logical materializer parent. The overlay is not a measurement tree and is
not a second component materialization. Reusing an unchanged representation
between frames is the normal path. The runner supplies a logical revision; the
host synchronizes an existing template in place when its structure is stable and
only creates a replacement after a structural invalidation.

For each compiled movement boundary at `t` it captures:

- FIRST: `resolveSceneBeforeBoundary(t)`, excluding the event;
- LAST: `resolveSceneAt(t)`, including the event.

LAST is therefore the immediate consequence of the event, never the global scene
at the end of the animation duration. The snapshots supply geometry only;
`SolvedGraph` supplies identity, order, target and parentage. The capture is
limited to the moved items, affected siblings and the ancestor/descendant
closure required to compose their poses.

If the compiled scene has no transition `move`, the runner does not initialize a
motion system, capture positions or create an overlay. A runtime move must be
captured before its structural commit through the same pre-commit boundary.

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

- `init()` initializes the visible component host, captures motion boundaries only
  when transitions exist, then builds the immutable motion graph.
- `play()` and `seek(t)` present the graph at absolute logical time.
- `resize()` prepares natural geometry, invalidates captured geometry, rebuilds
  the graph, then recommits the current frame without recreating stable overlay
  nodes.
- `destroy()` removes local transient slots, overlay representations, components
  and owned clock resources.

## Capture HTML classique

Le runner branche `HtmlPointerCaptureSourceAdapter` après l'initialisation du
player visible. Pour chaque `perso.emit.pointerdown.capture`, l'adaptateur :

1. émet l'événement de début avec `RuntimePlayer.emit()` ;
2. ouvre la capture avec `beginCompiledCapture()` une fois la promesse de
   l'événement de début terminée ;
3. transmet les `pointermove` à `trackCapture()` ;
4. ferme sur l'événement déclaré dans `endOn` (par défaut `pointerup`) avec
   `endCapture()`.

Le suivi et la fin sont écoutés sur la cible d'événements globale, en phase de
capture, afin de rester actifs lorsque le pointeur quitte le perso. L'adaptateur
ne demande pas de pointer capture natif au navigateur : le routage global est le
seul circuit de suivi. Le `pointerId` d'ouverture est conservé. Seuls les
événements déclarés dans `endOn` ferment la session ; `pointercancel` et
`lostpointercapture` n'ont aucun effet particulier s'ils ne sont pas déclarés.
La destruction du runner annule les sessions encore ouvertes. Le runner peut
recevoir cette cible explicitement avec `captureEventTarget`; dans un navigateur,
la fenêtre du document de la racine HTML est utilisée par défaut.

Le runner n'embarque pas la sémantique `list` ou DnD. Une démo peut brancher
`HtmlListDndPreview` via les hooks de capture ci-dessus : cette classe reste une
couche HTML de preview (hit-test et ghost) et ne modifie ni le journal ni l'ordre
logique. L'hôte peut lui fournir l'ordre des enfants résolu par `list` via
`resolveListItemNodes`; à défaut, la preview utilise les racines DOM directes
marquées par le materializer. Le perso saisi est toujours exclu de cet ordre
transitoire. Le commit passe par `RuntimePlayer`, l'action `move` et la capacité
`list`. Pendant la preview, le perso saisi conserve son point de prise en pose
fixe ; le ghost est le seul élément ajouté au flux. Les voisins sont animés par
un FLIP HTML transitoire à chaque changement de slot. Au `pointerup`, le runner
photographie la pose visible avant le commit du `move` pour fournir le FIRST de
la remise live `endEmit` ; cette photographie n'est ni un état logique ni une
entrée du journal. Si la capture déclare aussi `endCapture`, celui-ci porte la
trajectoire rejouable source logique → cible à la frontière `end - durée`.
Cette trajectoire est capturée sur les nodes visibles au point pré-commit. Le
snapshot de fin live est effacé avant un seek : la remise au relâchement n'est
donc pas rejouée.

La preview HTML réserve l'attribut `data-codplay-transient` aux nodes qu'elle
possède temporairement. Le node auteur flottant et le ghost le portent pendant
le geste. `HtmlComponentMaterializer` exclut ces nodes de la reconciliation
structurelle et compare d'abord l'ordre des seuls nodes auteurs avant d'appeler
`appendChild` ou `insertBefore`. Ainsi, chaque frame de lecture peut repasser
par le materializer sans réattacher le node flottant ni déplacer le ghost. La
preview retire ensuite le marqueur à la fermeture ; la frame suivante remonte
alors l'ordre logique normal.

Avec `enableInteractionLock: true`, le runner verrouille la racine HTML tant que
le player n'est pas en `playing`, puis retrouve son état initial à la destruction.
La telco doit donc être montée en dehors de cette racine.

## Contexte du materializer

`HtmlPlayerRunner` reçoit le `RuntimeCapabilityCatalog` déjà composé lors de
l'initialisation de CodPlay. Les composants, leurs services, leurs modules et
leurs validateurs sont déclarés dans ce catalogue unique. Le runner crée une
seule instance du `RuntimeMaterializer` HTML pour le substrat visible, mais
aucun materializer n'enregistre de service ou de module.

Les ressources déclarées par la scène peuvent être fournies au runner avec
`resources`. Elles sont enregistrées dans l'engine unique du player visible :

```ts
const runner = new HtmlPlayerRunner({
  // ...compiledScene, root, rootTargets et catalog
  resources: compiledScene.requirements.resources,
})
```

### Preload externe et diffusion autonome

Le preload n'est pas une étape implicite de `init()`. L'hôte choisit le ou les
manifestes et appelle directement la capacité partagée :

```ts
const preload = createRuntimePreload({ cache: sharedPreloadCache })

await preload.load({
  manifest: [currentScene.resources, nextScene.resources],
  options: { mode: 'broadcast' },
})
```

Sighty et l'éditeur utilisent ce même appel pour leurs manifestes. Ils ne
créent pas de loader parallèle. Après un preload direct, l'hôte transmet les
URLs rendues disponibles à l'engine avant `player.init()` :

```ts
engine.registerResources(currentScene.resources.entries.map((entry) => entry.url))
player.init()
```

La diffusion autonome dispose de la façade `run()` du runner. Elle enchaîne
explicitement `preload.load()`, `init()` puis `play()` et accepte elle aussi un
manifeste ou un tableau de manifestes :

```ts
const result = await runner.run({
  preload,
  manifest: currentScene.resources,
})
```

`RuntimePlayer.init()` et `HtmlPlayerRunner.init()` restent synchrones et ne
déclenchent jamais le preload. Si l'engine est piloté par un hôte externe,
`run()` met le player en lecture mais laisse à cet hôte l'avancement de ses
frames.

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
- No second DOM, player, engine or materializer is created for motion capture.
- Geometry snapshots contain data only and never retain DOM references.
- Every item owns its temporal segments independently.
- Parent movement is composed recursively at resolution time.
- An overlapping local reflow retargets its existing segment at the already
  resolved visual pose and keeps its interpolation phase; it does not restart
  easing at zero.
- One source or one independent representation is visible per item.
- HTML pose composition uses affine origins and matrices; `rect.left/top` remain
  derived AABB values only.
