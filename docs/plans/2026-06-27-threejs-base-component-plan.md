# Plan - composant `threejs` de base pilote par CodPlay et animejs

## Statut

Plan formalise avant implementation.

## Contexte

Le repo dispose deja des briques generiques necessaires a un composant Three.js tiers:

- `ThirdPartyBinding` est consomme par le player pour enregistrer un composant, un `RenderAdapter`
  et d'eventuelles strategies de preload.
- `animejs` est deja pilote par la boucle du player (`engine.useDefaultMainLoop = false`), donc
  un composant Three.js peut s'appuyer sur le meme moteur temporel sans lancer de RAF concurrent.
- les actions auteur et les payloads d'events sont fusionnes avant `component.update()`, y compris
  pour des cles custom.

References de code:

- `packages/codplay/src/player/create-player.ts`
- `packages/codplay/src/player/player.ts`
- `packages/codplay/src/core/events/dispatch.ts`
- `packages/authoring/components/avatar3d/src/avatar3d-base-component.ts`
- `packages/authoring/components/rive/src/rive-base-component.ts`

## Objectif

Ajouter un composant `threejs` generique, decouple d'`avatar3d`, qui:

- cree et pilote un renderer Three.js depuis le ticker CodPlay
- peut construire une scene Three.js procedurale depuis le `perso.initial`
- peut lancer des animations `animejs` sur des refs Three.js decrites dans `perso.actions`
- expose une demo qui reproduit l'exemple `animejs` Three.js a base d'`InstancedMesh`

## Perimetre

Dans le scope:

- nouveau package `packages/authoring/components/threejs`
- un composant de base enregistre sous le type auteur `threejs`
- un binding `createThreejsBinding()`
- une demo procedurale sans asset externe
- un contrat seek-safe pour les animations creees par le composant

Hors scope pour cette V1:

- integration a `avatar3d`
- support declaratif complet de GLTF, textures et materials externes
- mini-DSL 3D JSON complete (scene graph auteur exhaustif)

## Probleme de contrat identifie

Un composant qui cree lui-meme des animations `animejs` doit connaitre l'instant de depart de
chaque animation pour rendre `seek()` deterministe. Or `RuntimeComponentUpdateInput` ne transmet
aujourd'hui que `eventId`, `eventSeq` et `action`, pas le temps timeline de l'event source.

Sans cet instant:

- `prepareSeek()` peut nettoyer l'etat
- le replay peut bien recreer les animations
- mais `seek(info)` ne peut pas remettre chaque animation a la bonne progression locale si plusieurs
  animations ont commence a des instants differents

## Decision de conception

Ajouter un champ generique `eventMs` a `RuntimeComponentUpdateInput` et le propager depuis
`TimelineEvent.ms` jusqu'au composant.

Ce changement est generique, non Three.js-specifique, et reste utile pour tout composant tiers qui
possede des animations internes seekables.

## Strategie V1 retenue

### 1. Scene Three.js procedurale, pas DSL complete

La scene 3D sera construite depuis une callback TS portee par `perso.initial`, plutot que via une
spec declarative complete. Les scenes du projet sont deja ecrites en TypeScript et le repo accepte
deja des fonctions dans les persos (ex. `avatar3d`).

Cette decision evite d'inventer une fausse spec 3D trop large pour un premier chantier, tout en
gardant un composant de base reutilisable.

### 2. Animation decrite dans le perso

Les animations seront decrites dans `perso.actions` via une cle custom du type `animations`, avec
des descripteurs qui ciblent des refs internes Three.js.

Comme les persos sont auteurs en TS, les params animejs pourront contenir:

- valeurs litterales
- keyframes
- fonctions
- `stagger(...)`
- valeurs derivees de proxies d'instances (`getInstances()`)

### 3. Pas de preload custom en V1

La demo de reference est purement procedurale. Aucun GLB ni texture externe n'est necessaire.
Le composant de base ne declarera donc pas de strategie de preload dans cette iteration.

## API auteur cible

### Type de perso

```ts
{
  id: 'three-cubes',
  type: 'threejs',
  initial: {
    move: { parentId: 'stage' },
    width: 720,
    height: 720,
    build: createAnimeGridScene,
  },
  actions: {
    'scene:start': {
      animations: createAnimeGridAnimations(),
    },
  },
}
```

### Contrat `initial.build`

`build(context)` construit la scene procedurale et retourne les refs animees:

```ts
type ThreejsBuildResult = {
  scene: Scene
  camera: Camera
  refs?: Record<string, unknown>
}
```

Le contexte fourni doit permettre au builder de creer ses objets sans toucher au cycle de vie du
renderer possede par le composant.

### Contrat `action.animations`

`animations` est un tableau de descripteurs:

```ts
type ThreejsAnimationDescriptor = {
  ref: string
  startAtMs?: number
  params: Record<string, unknown>
}
```

- `ref` cible une entree du registre interne (`mesh`, `pointLight`, `instances`, etc.)
- `startAtMs` vaut par defaut `eventMs`
- `params` est passe a `animate(target, params)` apres resolution de la ref

## Architecture cible

### Package

- `packages/authoring/components/threejs/package.json`
- `packages/authoring/components/threejs/src/index.ts`
- `packages/authoring/components/threejs/src/create-threejs-binding.ts`
- `packages/authoring/components/threejs/src/threejs-base-component.ts`
- `packages/authoring/components/threejs/src/threejs-types.ts`
- `packages/authoring/components/threejs/tests/threejs-component.spec.ts`

### Composant de base

Responsabilites:

- `render()` cree uniquement le `canvas`
- `init()` cree `WebGLRenderer`, appelle `initial.build`, memorise `scene`, `camera` et `refs`
- `update()` traduit `action.animations` en animations `animejs` sur refs Three.js
- `_tick()` rend une frame depuis l'etat deja avance par `animejs`
- `_prepareSeek()` annule les animations actives et remet la scene a sa baseline
- `_seek(info)` recree et seek les animations actives a la bonne progression locale
- `_stop()` annule les animations et libere les ressources WebGL/Three.js

### Binding

`createThreejsBinding()` suit le pattern canonique:

- closure avec `Set<ThreejsBaseComponent>`
- composant concret enregistre les instances dans `_init()`
- `renderAdapter` hub pour `tick`, `prepareSeek`, `seek`, `stop`

## Demo cible

La demo reproduit l'exemple animejs Three.js:

- renderer alpha + preserveDrawingBuffer
- scene + camera
- ambient light + point light + directional light
- grille d'`InstancedMesh`
- animation du mesh parent
- pulsation de la lumiere
- animation des instances via `getInstances(mesh)`

Fichiers demo prevus:

- `packages/demos/src/scenes/threejs-anime-grid-scene.ts`
- `packages/demos/src/codplay/threejs-anime-grid-demo.ts`
- mise a jour de `packages/demos/src/main.ts`
- mise a jour de `packages/demos/src/shared/demo-registry.ts`

## Verification cible

Tests automatiques:

- propagation de `eventMs` jusque `RuntimeComponentUpdateInput`
- resolution de refs et rejet propre des refs inconnues
- recreation seek-safe des animations internes avec `startAtMs`

Verification manuelle:

- la demo se lance depuis le shell demos
- play / pause / rewind / seek n'empilent pas plusieurs animations concurrentes
- un seek a un instant intermediaire donne le meme etat visuel qu'une lecture continue au meme
  instant

## Criteres d'acceptation

- un nouveau type auteur `threejs` existe via `bindings`
- la demo reproduit visuellement l'exemple animejs de reference
- aucun RAF propre n'est lance par le composant
- `seek()` est deterministe pour les animations gerees par le composant
- aucun preload custom n'est necessaire pour la demo procedurale V1
