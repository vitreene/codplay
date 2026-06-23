# Plan — hook de cycle de vie "avant replay de seek" + intégration avatar3d

Statut : analyse, en attente de décision. Ne pas implémenter avant mise à jour des specs concernées.

**Principe directeur (rappel)** : toute méthode ajoutée au cœur `codplay` doit être générique — les composants sont toujours des détails d'implémentation. `RenderAdapter`, `RenderSync`, `BaseComponent`, `ComponentServiceBase`, `ThirdPartyBinding` vivent dans `packages/codplay/` et ne connaissent aucune bibliothèque précise. `createAvatarEngineBinding`, `AvatarEngineBaseComponent`, `createRiveBinding`, `RiveBaseComponent` vivent dans `packages/authoring/components/*` — ce sont des *implémentations* du contrat générique, jamais l'inverse. Le hook décrit ci-dessous est nommé et spécifié au niveau générique ; avatar3d et rive ne font que l'implémenter, comme ils implémentent déjà `tick`/`seek`/`pause`/`resume`/`rateChange`/`stop`.

**Nom retenu pour le hook** : `prepareSeek?()` (et non `seekStart?()`) — voir section 3 pour la justification. S'aligne sur le vocabulaire déjà établi par `AvatarEngine.prepareSeek()`/`commitSeek()` (package avatar, pas le cœur), ce qui rend l'implémentation avatar3d triviale sans traduction de vocabulaire.

## 1. Diagnostic — où en est chaque composant par rapport à la spec

| | `rive` / `rive-coach` (`packages/authoring/components/rive/`) | `avatar-rive` (legacy) | `avatar3d` |
|---|---|---|---|
| `ThirdPartyBinding` (composants+adapter+preload en un objet) | ✅ `create-rive-binding.ts` | ❌ factory ad-hoc `{ componentClass, renderAdapter }` | ❌ idem |
| Chargement ressource via preload | ✅ `preloadRiveResource()` + `getRiveEntry()` synchrone dans `init()` | ❌ — | ❌ `engine.loadModel()` async dans la factory, appelé depuis le `setup()` de la démo |
| `BaseComponent` / cycle `render()`→`init()` | ✅ `RiveBaseComponent extends BaseComponent` | ❌ classe composant ad-hoc | ❌ idem |
| `ComponentServiceBase` (services internes avec `apply/reset/advance/destroy`) | ✅ `StateMachineService`, `VisemeLipSyncService`, `EmotionService` | ❌ | ❌ — toute la logique (blink/headDrift/breathe/gaze/gesture) vit dans le facade monolithique `AvatarEngine` |
| Hub `RenderAdapter` (un par bibliothèque, ferme sur `instances`) | ✅ `create-rive-binding.ts:24-32` | ✅ partiel (un seul composant, pas de Set d'instances) | ✅ partiel idem |
| Hook "reset avant replay de seek" | ❌ absent — `_seek()` ([rive-base-component.ts:73-77](../../packages/authoring/components/rive/src/rive-base-component.ts#L73-L77)) ne tourne qu'**après** le replay, comme le `seek()` canonique | ❌ `seekStart()` déclaré ([avatar-rive-component.ts:141](../../packages/authoring/components/avatar-rive/src/avatar-rive-component.ts#L141)) mais **jamais appelé** par le player | ❌ idem ([avatar3d-render-adapter.ts:53](../../packages/authoring/components/avatar3d/src/avatar3d-render-adapter.ts#L53)) |
| `CreatePlayerOptions.bindings` réellement consommé par le player | ❌ — le type existe ([third-party-binding.ts](../../packages/codplay/src/player/third-party-binding.ts)) mais `create-player.ts` n'a que `components?`/`renderAdapters?` ; la démo `rive-coach-demo.ts:17-20` désassemble le binding à la main | — | — |

**Conclusion du diagnostic** : `rive`/`rive-coach` est la référence la plus proche de la spec normative (`v1-third-party-runtime-spec.md`), mais même elle n'a pas le hook "avant replay" — la spec promet ce comportement (`ComponentServiceBase.reset()` doc : *"Appelé automatiquement par le composant sur stop() et avant seek replay"*, [v1-third-party-runtime-spec.md:589](v1-third-party-runtime-spec.md#L589)) sans jamais le câbler. C'est un manque transverse, pas un défaut spécifique à avatar3d. `avatar3d` et `avatar-rive` (le legacy) cumulent ce manque avec une non-conformité plus large à la spec.

## 2. Le vrai problème structurel commun

Il n'existe **aucun point unique** dans le cycle de vie canonique où un composant/adapter peut remettre son état interne à une baseline propre **avant** que `replayDueTimelineEventsForSeek` ne rejoue les events de la track. Deux symptômes :

- `avatar3d`/`avatar-rive` ont chacun réinventé une extension locale `seekStart()` non standard (nom qui ne sera pas celui retenu pour le hook canonique — voir section 3), jamais appelée par le player (code mort).
- Même `rive-coach`, conforme à la spec, n'a pas de mécanisme pour ça — si un service interne (ex. futur service de geste avec état continu) avait besoin d'un reset pré-replay, il n'aurait nulle part où l'accrocher.

Le mécanisme `ComponentServiceBase.reset()` existe déjà et est le bon niveau d'abstraction (reset du composant, pas de l'adapter). Ce qui manque, c'est **le déclencheur** : un hook canonique au niveau `RenderAdapter`, appelé une fois par le player avant le replay, qui descend vers `_resetServices()`.

## 3. Modèle uniforme proposé (pas de chemin séparé par bibliothèque)

Un seul hook optionnel, au même rang que `pause?`/`resume?`/`rateChange?`/`stop?`, nommé **`prepareSeek?()`** :

```ts
// render-adapter-types.ts — RenderAdapter canonique
export interface RenderAdapter {
  tick(info: RenderTickInfo): void
  prepareSeek?(): void   // NOUVEAU — appelé une fois avant le replay des events de seek
  seek(info: RenderSeekInfo): void   // appelé une fois après le replay (inchangé)
  pause?(): void
  resume?(): void
  rateChange?(rate: number): void
  stop?(): void
}
```

**Choix du nom** : trois options évaluées —
- `seekStart?()` (repris du code mort existant) : asymétrique, puisque `seek()` lui-même n'est pas nommé `seekEnd()` — laisse deviner une paire qui n'existe pas.
- `resetForSeek?()` : décrit l'effet plutôt que le moment, mais moins lisible sur une timeline.
- **`prepareSeek?()` — retenu.** S'aligne sur le vocabulaire déjà établi et validé par l'usage dans `AvatarEngine.prepareSeek()`/`commitSeek()` ([avatar-engine.ts:67,73](../../packages/authoring/components/avatar-engine/src/avatar-engine.ts#L67)) — vocabulaire qui vit au niveau du package avatar, pas du cœur, mais que le hook générique peut reprendre sans perdre sa généricité (le sens — "préparer l'état interne avant une reconstruction de seek" — reste abstrait, applicable à toute bibliothèque). L'implémentation avatar3d devient une délégation directe sans traduction : `prepareSeek: () => instances.forEach(c => c._prepareSeek())` → `engine.prepareSeek()`.

Câblage :

1. **`RenderSync.prepareSeek()`** — boucle sur tous les adapters enregistrés (anime.js interne, tween runner, et tout `renderAdapters`/futur `bindings[].renderAdapter`), appelle `adapter.prepareSeek?.()` en try/catch comme les autres hooks.
2. **`PlayerFacade.seek()`** ([create-player.ts](../../packages/codplay/src/player/create-player.ts)) — insérer `this.renderSync.prepareSeek()` juste avant `trackManager.resetActiveTracks()` (ligne ~1924), après `applyMountedRuntimePlan`/`loadMountedRuntimePersos`/`syncHorizonFromRuntimePlan`.
3. **Hub d'une bibliothèque** (`createRiveBinding`, futur `createAvatarEngineBinding` — packages authoring, pas le cœur) implémente : `prepareSeek: () => instances.forEach(c => c._prepareSeek())`.
4. **Composant base** (`RiveBaseComponent`, futur `AvatarEngineBaseComponent` — packages authoring) implémente `_prepareSeek()` → `this._resetServices()`. Réutilise le mécanisme déjà spécifié par `ComponentServiceBase.reset()` (cœur, générique), enfin déclenché.
5. **Media** n'implémente pas le hook (no-op par omission) — son seek est déjà idempotent (`currentTime` direct), donc rien à câbler. Ça confirme que c'est un hook *optionnel ignoré quand inutile*, pas un chemin parallèle : même contrat pour tous, chaque adapter l'utilise ou pas selon son besoin réel.

Ce point (3) répond directement à la question initiale : oui, "le composant peut déclarer des hooks internes" — c'est exactement `ComponentServiceBase.reset()` (cœur) — il manquait seulement le fil qui le relie au cycle de seek du player, et ce fil doit être unique et générique (`RenderAdapter.prepareSeek?`), pas dupliqué ni renommé par bibliothèque.

**Specs mises à jour** (fait, avant tout code) : `v1-render-adapter-spec.md` créée — contrat `RenderAdapter` complet, générique, avec `prepareSeek?()` documenté précisément (ordre d'appel, garanties, relation à `ComponentServiceBase.reset()`). `v1-rate-spec.md` §3 et `v1-third-party-runtime-spec.md` référencent cette nouvelle spec au lieu de dupliquer le contrat ; les exemples de code de `v1-third-party-runtime-spec.md` (hub `renderAdapter`, `RiveBaseComponent`, `_resetServices`) sont corrigés pour câbler `_prepareSeek()` au lieu de laisser la promesse de `ComponentServiceBase.reset()` sans déclencheur. Reste à faire : le code réel (`render-adapter-types.ts`, `render-sync.ts`, `create-player.ts`, `rive-base-component.ts`, `create-rive-binding.ts`, `avatar3d-render-adapter.ts`) n'est pas encore modifié — seules les specs le sont.

## 4. Portée de la correction immédiate (Phase A — petite, ferme le bug littéral)

Strictement le point 3 ci-dessus, appliqué à :
- `render-adapter-types.ts`, `render-sync.ts`, `create-player.ts` (canonique — seul périmètre touchant le cœur `codplay`)
- `rive-base-component.ts` → `_prepareSeek()` + hub `create-rive-binding.ts` (package authoring)
- `avatar3d-render-adapter.ts` → remplacer l'extension locale `seekStart()` par l'implémentation du hook canonique `prepareSeek()` → `engine.prepareSeek()` (package authoring)
- `avatar-rive-component.ts` (legacy) → idem, ou abandon si la Phase B le retire au profit de `rive-coach`

Risque faible, pas de migration architecturale, ferme le bug "blink/headDrift/breathe pas atteints pendant le seek" et le code mort des deux `seekStart()` locaux existants.

## 5. `setup()` — pas un détail de démo, un contournement de trois manques du cœur `codplay`

Point initialement sous-traité dans ce plan : `setup()` (hook async par démo, [run-codplay-scene-demo.ts:19](../../packages/demos/src/codplay/run-codplay-scene-demo.ts#L19)) n'est pas seulement "la mauvaise forme de retour" (la spec le note déjà : *"`setup()` retourne `ThirdPartyBinding`... pas un objet ad-hoc `{ components, renderAdapters }`"*, [v1-third-party-runtime-spec.md:797](v1-third-party-runtime-spec.md#L797)). C'est la trace visible de **trois mécanismes du cœur `codplay` qui n'existent pas encore**, et qui empêchent toute démo de faire autrement :

1. **`ResourceManifestEntry.type` est une union fermée** ([builder/types.ts:79](../../packages/codplay/src/builder/types.ts#L79)) : `'video' | 'audio' | 'image' | 'font' | 'css'`. Aucune place pour `'rive'`, `'avatar3d-glb'`, etc.
2. **`createPreloadModule()` n'a aucun point d'extension** ([create-preload-module.ts:9-17](../../packages/codplay/src/preload/create-preload-module.ts#L9-L17)) — `loadByType` est un `switch` fermé sur les 5 types ci-dessus. `ThirdPartyBinding.preload` (le champ censé porter une stratégie tierce) n'est donc consommé par rien dans le runtime réel.
3. **`CreatePlayerOptions`/`Player`/`CodPlay` n'acceptent pas `bindings`** — seulement `components?`/`renderAdapters?` à plat ([create-player.ts:54,57](../../packages/codplay/src/player/create-player.ts#L54)).

Pourtant `Player.init()` fait déjà tourner un vrai pipeline de preload automatique, piloté par le manifest, avant le montage des composants ([player.ts:198-204](../../packages/codplay/src/player/player.ts#L198-L204)) — c'est le bon point d'ancrage, il fonctionne, il est juste fermé aux bibliothèques tierces.

**Preuve que ce n'est pas seulement un problème avatar3d** : `rive-coach-demo.ts`, sous-titrée *"architecture spec v1-third-party-runtime-spec"*, ne suit pas non plus la spec sur ce point — elle appelle `await preloadRiveResource(RIV_SRC)` à la main, hors du pipeline manifest/preload réel, puis désassemble le `ThirdPartyBinding` en `{ components, renderAdapters }` ad-hoc ([rive-coach-demo.ts:14-21](../../packages/demos/src/codplay/rive-coach-demo.ts#L14-L21)). La "référence" elle-même contourne sa propre spec, parce que le cœur ne lui laisse pas d'autre choix.

**Conséquence pour le séquencement** : la vraie fondation de ce qui était appelé "Phase B" n'est pas la migration d'avatar3d — c'est de compléter le cœur `codplay` :
- ouvrir `ResourceManifestEntry.type` (ou le rendre extensible) ;
- donner à `createPreloadModule()` un registre de stratégies (`registerStrategy(type, load)`), alimenté par `bindings[].preload` ;
- faire consommer `bindings` par `CreatePlayerOptions`/`Player`/`CodPlay` (expansion interne décrite dans la spec, [v1-third-party-runtime-spec.md:105-110](v1-third-party-runtime-spec.md#L105-L110), jamais implémentée).

Une fois ces trois points câblés, `setup()` cesse d'exister comme pattern pour ce besoin : la démo déclare `bindings: [createAvatarEngineBinding(...)]` au constructeur `CodPlay`, `studio.load()` attend le preload automatiquement (GLB, .riv, etc. inclus), sans hook async séparé ni merge manuel. Ce n'est qu'à partir de là que la décomposition d'`AvatarEngine` en services (section 6) a un cadre propre où s'insérer.

**Point à ne pas perdre de vue** : câbler `bindings` ne remplace pas le chemin existant, il en crée un second, parallèle — voir la section dédiée *"Deux chemins de registration — à ne pas confondre"* ajoutée dans `v1-third-party-runtime-spec.md`. Aujourd'hui : un seul chemin réellement exécuté (`options.components`/`options.renderAdapters`, [create-player.ts:472,484](../../packages/codplay/src/player/create-player.ts#L472)), `bindings` n'étant qu'une convention de type non consommée — les démos décompressent le binding à la main dans ce même chemin. Une fois `bindings` câblé, **deux portes d'entrée coexisteront** pour le même registry de composants (`options.components` direct vs `options.bindings[].components` expansé) et pour le même `RenderSync` (`options.renderAdapters` vs `options.bindings[].renderAdapter`). Ne pas câbler `bindings` en pensant que ça unifie quoi que ce soit — l'unification des deux chemins est une question ouverte séparée, à trancher plus tard, pas un sous-produit automatique de ce câblage.

## 6. Portée structurelle de l'avatar3d à proprement parler (nécessite décision, pas de scope figé ici)

Une fois le socle de la section 5 posé, migrer `avatar3d` vers le pattern `ThirdPartyBinding` complet (alignement sur `rive`) :

- **Chargement GLB** → stratégie preload `avatar3d-glb` enregistrée via `bindings[].preload`, `init()` lit le cache de façon synchrone — supprime l'`await engine.loadModel()` actuellement dans `createAvatar3D()` appelée depuis le `setup()` de la démo.
- **Décomposition `AvatarEngine`** en services `ComponentServiceBase` (blink, head-drift, breathe, gaze, gesture) au lieu du facade monolithique actuel — ce qui donnerait nativement `reset()`/`advance()` par capacité, cohérent avec le point 1 et 2 déjà tranchés cette session (fn dans perso.actions, pas dans l'event ; action vide = exception).
- **Three.js `scene`/`camera`/`renderer`** : ouvert — ce ne sont pas des ressources "preloadables" comme un GLB, ce sont des objets d'infrastructure partagés construits une fois par la démo. Deux pistes, à trancher avant d'écrire la spec :
  - (a) rester un paramètre explicite passé à la factory de binding (`createAvatarEngineBinding({ camera, renderer, scene })`), mais appelé en dehors du chargement de ressource — découplé du GLB et du `componentClass`/`renderAdapter`.
  - (b) les enregistrer comme `ServiceInstance` dans le service registry CodPlay (`ThirdPartyBinding.services`) — mais ce canal cible aujourd'hui le DOM (`apply(node, value)`), pas un contexte de rendu 3D partagé ; potentiellement un détournement du contrat existant.
- **`avatar-rive` (legacy)** : à clarifier — retiré au profit de `rive` + `rive-coach`, ou maintenu en parallèle ?

Cette section touche l'architecture des trois packages avatar et le contrat public `codplay`. Elle ne doit pas démarrer avant une discussion dédiée sur les points ouverts ci-dessus, et dépend du socle de la section 5.

## 7. Modèle validé — découpage preload / init pour avatar3d

Décision actée : **avatar3d est un composant autonome**, sur le modèle strict de Rive — il possède son propre canvas, son propre `WebGLRenderer`, sa propre `Scene` et sa propre `Camera`, construits dans `init()`. Pas de viewport 3D partagé entre plusieurs personas pour ce composant. Un futur composant "rendu 3D générique" pourrait vouloir partager un espace — hors champ ici, à concevoir séparément le jour où ce besoin existe réellement.

### Le piège dans le code actuel

`loadModel()` ([model-loader.ts:67-124](../../packages/authoring/components/avatar-engine/src/model-loader.ts#L67-L124)) fusionne deux étapes qui doivent être séparées :

- **Fetch + parse GLTF brut** (`GLTFLoader.load(url)` → `gltf.scene`) — pur, indépendant de `morphPrefix`/`retarget`/de l'instance. Cacheable par URL.
- **Traversal + strip `morphPrefix` + `retarget()` + `engine.registerBlendMorph(...)`** — mute directement le `MorphEngine` de **cette instance précise**. `MorphEntry.slots` ([morph-engine.ts:47](../../packages/authoring/components/avatar-engine/src/morph-engine.ts#L47)) pointe vers les `morphTargetInfluences` du graphe de scène réel : deux avatars ne peuvent pas partager le même `Group` Three.js, chacun a besoin de son propre clone pour bouger indépendamment.

### Découpage retenu

| Étape | Contenu | Portée |
|---|---|---|
| **Preload (par URL)** | `fetch(url)` → `ArrayBuffer` brut (octets `.glb`), stocké dans le cache preload (`getModelEntry`/`setEntry`, comme `RivePreloadEntry`). **Ne parse pas** — voir la correction ci-dessous. | partagé entre toutes les instances référençant la même URL |
| **`init()` (par instance)** | `GLTFLoader.parse(buffer)` → `gltf.scene` frais → traversal → strip `morphPrefix` → `retarget()` → `engine.registerBlendMorph(...)`, tous lus depuis `perso.initial` ; construction de `WebGLRenderer`/`Scene`/`Camera` propres à l'instance à partir du canvas créé en `render()` ; `scene.add(modelScene)` ; enregistrement dans le hub (closure `instances`, comme `create-rive-binding.ts`) | par instance |

> **Correction 2026-06-23 (post-implémentation) — parse par instance, pas parse + clone.**
> Le plan initial prévoyait *preload = `GLTFLoader.load(url)` → `gltf.scene` mis en cache*, puis *`init()` = `SkeletonUtils.clone(cachedScene)`*. Cette approche est **défectueuse** : `SkeletonUtils.clone()` crée un objet `Skeleton` distinct par `SkinnedMesh` (10 pour le modèle ReadyPlayerMe testé), alors qu'un parse GLTF natif n'en produit qu'**un seul, partagé**. Or `retarget()` applique son offset `origin` une fois **par skeleton trouvé** ([retargeter.ts](../../packages/authoring/components/avatar-engine/src/retargeter.ts)) — donc `origin.y: -0.1` devenait `-1.0` (×10), décalant le modèle vers le bas et cadrant le visage au lieu du buste. C'est l'écart exact constaté vs l'ancien flux (`GLTFLoader.load(url)` frais par instance, 1 skeleton). **Le cache stocke donc les octets bruts ; chaque instance re-parse via `GLTFLoader.parse(buffer)`** — scène fraîche, indépendante, topologie mono-skeleton d'origine, vierge à chaque init (pas de mutation de cache partagé sur rewind). Le fetch reste mutualisé (téléchargement une fois), seul le parse est par instance — exactement le comportement antérieur.

Point technique à vérifier avant implémentation, pas bloquant pour la conception : si les GLB utilisés sont compressés Draco, `DRACOLoader` charge un décodeur WASM en singleton de session (niveau 1 de la spec preload) — à confirmer sur les assets réels avant d'écrire la stratégie de preload.

### Conséquence sur `AvatarEngine.loadModel()`

La méthode change de contrat : elle ne fait plus le fetch (ça devient la stratégie preload), elle reçoit les **octets `.glb` déjà en cache** et fait parse (frais) + traversal + retarget + registration — c'est la partie qui reste réellement "par instance". Elle redevient **asynchrone** (`GLTFLoader.parse` est callback-based), donc `init()` du composant lance le chargement en async ; `_tick`/`_seek` no-op tant que `this.engine` n'est pas prêt, le canvas/renderer/caméra étant déjà construits de façon synchrone.

### Ce que ça implique pour `perso.initial`

`camera`/`scene`/`renderer` ne sont plus des objets Three.js externes passés en config — ils sont construits par le composant lui-même dans `init()`. Les seuls paramètres qui doivent transiter par `perso.initial` sont déclaratifs (ex. position/fov caméra, couleur de fond de scène, `src`, `morphPrefix`, `retarget`, `mood`, `visemeWeight`) — type `Avatar3DInitial` à définir et exporter, sur le modèle de `RiveInitial`. Le détail exact des champs caméra/scène n'est pas figé ici — à faire au moment d'écrire le composant, une fois le reste du modèle validé.

## Prochaine étape proposée

Valider la Phase A (hook canonique `prepareSeek?`, section 3-4) comme correction isolée et la documenter dans `v1-render-adapter-spec.md` (nouvelle, générique) avant tout code. Les sections 5 à 7 restent un sujet séparé et plus lourd — câblage `bindings`/preload extensible dans le cœur `codplay` (section 5), puis migration d'avatar3d sur le modèle validé en section 7 — à ouvrir explicitement quand on voudra retravailler cette intégration dans son ensemble.

## 8. Statut d'implémentation (mis à jour au fil de l'exécution)

**Phase A (hook `prepareSeek?`) — fait.** `render-adapter-types.ts`, `render-sync.ts`, `create-player.ts` (cœur) ; `rive-base-component.ts`/`create-rive-binding.ts` et `avatar3d-render-adapter.ts` (authoring) câblés. Bug associé corrigé : `AvatarEngine.commitSeek()` ne resynchronisait pas les fonctions idle (`headDrift`/`blink`/`breathe`) à la position cible du seek — signature étendue en `commitSeek(timelineMs)`, `createBlinkScheduleFn()` réécrite en fonction pure. Couvert par les nouvelles suites `packages/authoring/components/avatar3d/tests/` et `packages/authoring/components/avatar-engine/tests/` (vitest ajouté à ces deux packages — aucun package `authoring/components/*` n'avait de test runner avant).

**Section 5 (socle `bindings`/preload extensible dans le cœur) — fait.**
- `ResourceManifestEntry.type` ouvert (`'video' | 'audio' | 'image' | 'font' | 'css' | (string & {})`, [builder/types.ts:79](../../packages/codplay/src/builder/types.ts#L79)).
- `createPreloadModule()` expose `registerStrategy(type, load)` ; `loadByType` retombe sur le registre pour tout type non natif, sinon rejette explicitement (`No preload strategy registered for resource type "..."`) — [create-preload-module.ts](../../packages/codplay/src/preload/create-preload-module.ts).
- `CreatePlayerOptions.bindings?: ThirdPartyBinding[]` consommé : `PlayerFacade` (constructeur) enregistre `binding.components` dans le même registre que `options.components`, et `binding.renderAdapter` dans le même `RenderSync` que `options.renderAdapters` ; `Player` (constructeur) enregistre `binding.preload[].{type,load}` via `this.preload.registerStrategy` avant tout `init()` — [create-player.ts:472-497](../../packages/codplay/src/player/create-player.ts#L472), [player.ts:140-146](../../packages/codplay/src/player/player.ts#L140).
- Testé dans `tests/v1/third-party-binding-registration.spec.ts` (4 tests : registration composant, renderAdapter, dispatch preload réussi, échec explicite si type non enregistré).
- Les deux chemins de registration (`options.components`/`renderAdapters` directs vs `options.bindings[]`) coexistent toujours sans être unifiés, comme prévu section 5 — `bindings` est un second chemin d'entrée vers les mêmes registres, pas un remplacement.

**Sections 6-7 (migration avatar3d vers `ThirdPartyBinding` complet) — fait.**
- `model-preload.ts` (nouveau, `@codplay/avatar-engine`) : fetch+parse brut du GLB, caché par URL (`preloadAvatar3DModel`/`getModelEntry`), sur le modèle exact de `rive-preload.ts`.
- `model-loader.ts` : `loadModel(url, engine, opts)` async → `buildModelInstance(cachedScene, engine, opts)` synchrone — ne fait plus le fetch, clone la scène en cache via `SkeletonUtils.clone` (bones/morphs indépendants par instance) puis traverse/strip/retarget/registerBlendMorph.
- `AvatarEngine.loadModel` : signature `(url, opts) => Promise<...>` → `(cachedScene, opts) => {...}` synchrone.
- `avatar3d-types.ts` (nouveau) : `Avatar3DInitial` — `src`, `morphPrefix`, `retarget`, `mood`, `visemeWeight`, `width`/`height`, `camera.{fov,position,lookAt}`, `move` (générique, lu par l'orchestrateur).
- `avatar3d-base-component.ts` (nouveau) : `Avatar3DBaseComponent extends BaseComponent` — `render()` construit le canvas, `init()` lit `getModelEntry(initial.src)`, construit `WebGLRenderer`/`Scene`/`PerspectiveCamera`/lights (fixes, non déclaratifs — non demandé), `createAvatarEngine`, `engine.loadModel(entry.scene, ...)`, `GazeService`. `_tick`/`_prepareSeek`/`_seek`/`_stop` remplacent `avatar3d-render-adapter.ts` (supprimé — exactement le rôle que jouait ce fichier, maintenant porté par le composant lui-même comme chez `rive`).
- `create-avatar3d-binding.ts` (nouveau, remplace `create-avatar3d.ts`) : `createAvatar3DBinding(): ThirdPartyBinding` — hub avec `instances: Set`, `components: { avatar3d }`, `renderAdapter` (fanout `_tick`/`_prepareSeek`/`_seek`/`_stop`), `preload: [{ type: 'avatar3d-glb', load: preloadAvatar3DModel }]`. Pas de `rateChange` — avatar3d utilise `info.timelineDeltaMs` (déjà rate-scalé par `RenderSync`), comme l'ancien render adapter.
- `avatar3d-component.ts` : ne garde plus que les fns idle (`createHeadDriftFn`/`createBlinkScheduleFn`/`createBreathTriggerFn`) + `buildActionHandlers`/`ActionHandler` exportés, réutilisés par `avatar3d-base-component.ts`.
- Démo (`avatar-poc-1-demo.ts`, `avatar-poc-scene.ts`) : `setup()` supprimé entièrement ; `bindings: [createAvatar3DBinding()]` + `extraResources: [{ url: '/avatars/avatarsdk.glb', type: 'avatar3d-glb', ... }]` ; config caméra/retarget/morphPrefix déplacée dans `perso.initial` de la persona `avatar3d`. `PlayerSceneDemoConfig`/`run-codplay-scene-demo.ts` acceptent désormais `bindings` en plus de `components`/`renderAdapters`.
- La décomposition d'`AvatarEngine` en services `ComponentServiceBase` (mentionnée section 6) n'a **pas** été faite — `AvatarEngine` reste un facade interne. Ce n'était pas un prérequis : le composant expose les hooks `_tick`/`_prepareSeek`/`_seek`/`_stop` attendus par le hub, exactement comme `RiveBaseComponent`, sans avoir besoin de `ComponentServiceBase` en interne. Resterait pertinent si/quand une capacité interne a besoin d'un cycle `apply/reset/advance/destroy` indépendant — pas le cas aujourd'hui.
- `avatar-rive` (legacy) : déjà supprimé en amont de cette session de migration (décision actée plus haut).

**Limite connue, non résolue ici** : le manifest de preload (`extraResources`) doit redéclarer l'URL du GLB séparément de `perso.initial.src` — le builder ne sait pas dériver une entrée de ressource tierce à partir d'un champ `initial` arbitraire. Même limite déjà présente pour `rive` (qui la contourne en appelant `preloadRiveResource` à la main hors pipeline). Pas corrigé ici — corriger ça demanderait une convention générique (ex. déclarer quel champ `initial` est l'URL de ressource par type de composant), hors périmètre de cette migration.

**Corrections post-vérification navigateur (2026-06-23, session ultérieure).** La migration a été vérifiée visuellement sur `avatar-poc-1` ; deux régressions introduites par le refacto ont été corrigées :

1. **Cadrage (visage au lieu du buste)** — voir l'encadré « Correction 2026-06-23 » dans la section 7. `SkeletonUtils.clone` démultipliait le skeleton (1 → 10), faisant appliquer `retarget`'s `origin` 10×. Corrigé : cache des octets bruts + `GLTFLoader.parse` par instance (1 skeleton, comme l'ancien `GLTFLoader.load`). `loadModel`/`buildModelInstance` redeviennent async, `init()` charge en async (canvas/renderer sync, `_tick`/`_seek` no-op tant que `engine` absent).

2. **Aucune animation (avatar figé)** — `Avatar3DBaseComponent extends BaseComponent` hérite de `static renderMutationResolver = htmlRenderMutationResolver`. Ce résolveur **droppe** toute mutation dont l'action ne porte ni clé HTML (style/attr/className) ni clé de sa liste blanche non-HTML fixe (`move`/`content`/`src`/`broadcast`/… — voir `html-render-mutation-resolver.ts:hasNonHtmlMutation`). Les actions avatar3d portent des clés custom (`viseme`/`gesture`/`blink`/`headDrift`/`breathe`/`enabled`/`mood`/`name`) → toutes silencieusement supprimées avant d'atteindre `update()`. L'ancien composant standalone (qui ne dérivait **pas** de `BaseComponent`) bénéficiait du `passThroughRenderMutationResolver` par défaut de l'orchestrateur. Corrigé : `Avatar3DBaseComponent` override `static renderMutationResolver = passThroughRenderMutationResolver`.
   - **Piège général à retenir** : tout composant tiers qui `extends BaseComponent` et pilote son rendu par des **clés d'action custom** (hors DOM) doit override `renderMutationResolver` en passthrough, sinon ses updates sont filtrés. Vaut potentiellement pour `rive` (non vérifié ici).

Vérifié en navigateur : avatar visible, cadrage buste, visèmes + blink + head-drift + gestes animés. Vérifié hors navigateur : typecheck (`avatar3d`/`avatar-engine` propres), tests unitaires (`avatar3d` 8/8, `avatar-engine` 5/5, suite `codplay` : mêmes 13 échecs pré-existants). Reste à confirmer : comportement du seek/rewind sur l'avatar.
