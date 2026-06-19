# Plan : montage automatique et rewind conforme

**Date** : 2026-06-19  
**Statut** : proposition

## Trous identifiés

**Trou 1 — mountTarget ignoré**  
`player.ts:154` contient `void input.mountTarget`. Le player reçoit le conteneur DOM cible mais le jette immédiatement. La responsabilité du montage est entièrement reportée sur l'auteur via `rootNodeIds` et `mountDemoRootNodes`.

**Trou 2 — destroy+init comme rewind**  
`resetDemoRuntime` dans `run-codplay-scene-demo.ts` enchaîne `player.destroy()` puis `player.init()` pour simuler un retour à l'état initial. La spec est explicite : `init` n'a vocation à être exécuté qu'une seule fois par lecture normale ; `destroy` est réservé aux cas techniques hôte.

## Ce que la spec dit

- `mountTarget` est fourni au Player et reste hors Scene (`v1-player-api.md` §Règles).
- Les opérations de placement des stories et des persos sont des opérations techniques runtime, hors facade publique minimale (`v1-player-api.md` ligne 76).
- `rootStories` est une structure d'autorisation scene-level, pas un déclencheur de montage implicite (`v1-scene-spec.md` §3).
- Le bootstrap peut préparer les placements autorisés par `rootStories` (`v1-scene-spec.md` §7).
- `seek` n'entraîne pas de nouvel appel à `init` (`v1-player-api.md` §Règles).

## Diagnostic technique

Après `player.init()`, la séquence dans `create-player.ts` est :  
1. `activateAllSceneStories()` — toutes les stories sont activées (pas seulement `rootStories`)  
2. `scene.init?.(scene, options)` — les scènes qui appellent `options.mount(storyId)` y enregistrent la story ; les autres ne font rien  
3. `loadMountedRuntimePersos()` → `renderer.load()` — les nœuds DOM de tous les persos sont créés et stockés dans `nodeByPersoId`  
4. `mountTarget` n'est plus utilisé nulle part (`void input.mountTarget` ligne 154)

**`compiledScene.rootNodeIds` existe déjà** (builder `create-builder.ts`, `deriveRootNodeIds()`). Ce champ contient exactement les IDs de persos visuellement racines : les `entries` des `rootStories` qui n'ont pas de `initial.move` (pas de parentId vers un autre perso). Exemple avatar-rive : `['avatar-stage']` seulement, `audio`/`avatar`/`caption` étant exclus car ils ont `move: { parentId: 'avatar-stage' }`.

**Vérification** : les `rootNodeIds` saisis manuellement dans les démos correspondent mot pour mot à `compiledScene.rootNodeIds`. La redondance est complète — les démos recalculent à la main ce que le compilateur a déjà produit.

## Étape 1 — Player : montage automatique dans mountTarget

**Fichiers touchés** : `packages/codplay/src/player/player.ts`

Dans `Player.init()` :
- Retenir `mountTarget` comme champ privé de l'instance
- Retenir `compiledScene` (déjà accessible via `this.currentScene` mais `rootNodeIds` vit sur `CompiledScene`, pas sur `scene`)
- Après le bootstrap, appeler une méthode interne `mountRootNodes()` :
  - Itérer sur `compiledScene.rootNodeIds`
  - Récupérer chaque nœud DOM via `registry.getNodeById(id)`
  - Placer dans `mountTarget` via `replaceChildren`

Sur runtimeRevision change (rebuild interne) : appeler `mountRootNodes()` à nouveau.

Sur `destroy()` : vider `mountTarget` (`replaceChildren()` sans arguments) et effacer la référence.

**L'API publique ne change pas.** `mountTarget` était déjà dans la signature de `init()`.

## Étape 2 — Demo : supprimer les fuites

**Fichiers touchés** : `PlayerSceneDemoConfig`, `run-codplay-scene-demo.ts`, toutes les démos CodPlay

Dans `PlayerSceneDemoConfig` (`demo-scene-types.ts`) :
- Supprimer `rootNodeIds: string[]`
- Supprimer `onAfterMount` (le setup post-init se fait directement après `await player.init()` — la registry est disponible immédiatement)

Dans `run-codplay-scene-demo.ts` :
- Supprimer `mountDemoRootNodes` et ses trois callsites
- Supprimer le tracking de `runtimeRevision` dans `onChange` (le player gère le remontage)
- Supprimer `onAfterMount` des deux callsites
- Supprimer `mountedRuntimeRevision`

Dans chaque démo : supprimer `rootNodeIds` (suppression mécanique ligne par ligne).

`syncInteractionLock` reste — c'est une préoccupation d'interface légitime côté auteur.

## Étape 3 — Rewind : seek(0) au lieu de destroy+init

**Pré-condition** : vérifier visuellement que `player.seek({ timelineMs: 0 })` produit un état identique à `destroy+init` sur les démos carousel, quiz-question, quiz-series, drag, dnd-list.

Si seek(0) est correct :
- Supprimer `resetDemoRuntime` de `run-codplay-scene-demo.ts`
- Supprimer `studio.telco.configure({ onRewind: ... })`
- Le default `telco.rewind()` = `seek(0)` s'applique sans configuration

Si seek(0) présente un delta visuel (gap seek) : documenter le delta, corriger le seek, puis reprendre l'étape 3.

## Ordre d'implémentation

1. Étape 1 — player auto-mount + `npm run test:gates` + vérification visuelle sur 2 démos
2. Étape 2 — cleanup démo, vérification sur toutes les démos
3. Étape 3 — rewind, après confirmation seek(0)

## Ce qui ne change pas

- Signature publique de `player.init()` et `player.destroy()`
- `SceneDef` et les scènes existantes — aucune modification
- `options.mount` dans `PlayerSceneLifecycleOptions` — reste disponible pour les scènes qui montent des stories dynamiquement
- `createDemoRemote` — non affecté
- Démos `player/` (player-scene-demo) — non affectées par ce plan
