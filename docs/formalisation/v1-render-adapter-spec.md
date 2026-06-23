# RenderAdapter V1 — contrat canonique de couplage au ticker CodPlay

## Statut

Spec normative V1. Définit le contrat `RenderAdapter`, générique et indépendant de toute bibliothèque. S'applique à l'adapter interne anime.js, au tween runner, et à tout `RenderAdapter` fourni par un `ThirdPartyBinding` (Rive, Three.js/avatar-engine, Lottie, PixiJS, et tout moteur futur).

Cette spec ne décrit aucune bibliothèque précise. Une bibliothèque tierce *implémente* ce contrat — elle ne l'étend pas et n'y ajoute pas de variante locale (cf. `v1-third-party-runtime-spec.md`, règle "pas d'API de preload propriétaire" : même principe ici, appliqué au cycle de vie de rendu).

## Objectif

Donner un seul point de référence pour la surface `RenderAdapter`, jusqu'ici dispersée entre `v1-rate-spec.md` (règles de rate) et des extensions locales non câblées (`seekStart()` dans `avatar3d`, `avatar-rive`). Fermer l'écart entre la promesse de `ComponentServiceBase.reset()` (`v1-third-party-runtime-spec.md`) et son déclencheur réel.

---

## Contrat canonique

```ts
// exporté par 'codplay'
export type RenderTickInfo = {
  nowMs: number
  deltaMs: number          // delta horloge murale, brut
  timelineMs: number
  timelineDeltaMs: number  // deltaMs × rate — pour un adapter SANS moteur propre
  rate: number
}

export type RenderSeekInfo = {
  nowMs: number
  timelineMs: number
}

export interface RenderAdapter {
  tick(info: RenderTickInfo): void
  prepareSeek?(): void
  seek(info: RenderSeekInfo): void
  pause?(): void
  resume?(): void
  rateChange?(rate: number): void
  stop?(): void
}
```

`tick` et `seek` sont obligatoires. `prepareSeek`, `pause`, `resume`, `rateChange`, `stop` sont optionnels (`?`) — un adapter les implémente seulement s'il a un état interne qui en a besoin. Un hook omis est ignoré silencieusement par `RenderSync` ; ce n'est jamais une erreur.

## Orchestration par `RenderSync`

Un seul `RenderSync` reçoit la liste ordonnée des adapters enregistrés (adapters internes CodPlay + adapters issus de `options.renderAdapters` / futur `bindings[].renderAdapter`). Il appelle chaque hook en boucle, dans l'ordre d'enregistrement, et isole les erreurs d'un adapter (try/catch) pour ne jamais bloquer les autres.

## Cycle de vie — ordre d'appel garanti

```
play / resume   → tick(info) à chaque frame
pause           → pause?()        [CodPlay arrête tick(), suffisant pour figer le rendu]
resume          → resume?()
setRate(rate)   → rateChange?(rate)
seek(targetMs)  → prepareSeek?()                         [1 — une fois, avant le replay]
                  [replay des events de seek par le player]
                  seek(info)                              [2 — une fois, après le replay]
stop / destroy  → stop?()
```

`prepareSeek?()` et `seek(info)` sont les deux bornes d'un seek : tout ce qui se passe entre les deux (le replay des events de track) est piloté par le player, pas par l'adapter — l'adapter n'a connaissance ni du replay ni des events individuels.

### `prepareSeek?()`

Appelé une fois, par `PlayerFacade.seek()`, **avant** que `trackManager.resetActiveTracks()` ne s'exécute et avant que le replay des events de seek ne commence. Sert à remettre l'état interne de l'adapter (et des composants qu'il pilote) à une baseline propre, pour que le replay qui suit ne mélange pas un état résiduel de l'instant précédent avec l'état reconstruit.

**Ce que `prepareSeek?()` doit faire** : réinitialiser tout état continu non porté par les events de track — minuteurs internes, schedulers epoch-based, poses/bones swappés en cours d'easing, services internes (`ComponentServiceBase.reset()`). Ne doit produire aucun effet visible persistant : c'est un nettoyage, pas un rendu.

**Ce que `prepareSeek?()` ne doit pas faire** : dessiner une frame, lire la timeline cible (`RenderSeekInfo` n'est pas passé à `prepareSeek?()` — il n'y a pas de position cible à ce stade, seulement un état à nettoyer), supposer un ordre relatif aux autres adapters (chaque adapter ne connaît que son propre état).

**Pourquoi un hook séparé et pas un paramètre sur `seek()`** : `seek(info)` s'exécute *après* le replay, sur l'état déjà reconstruit — il matérialise un résultat. `prepareSeek?()` s'exécute *avant*, sur un état qui n'a pas encore été touché par le replay — il prépare un terrain. Fusionner les deux forcerait l'adapter à distinguer "avant/après" via un paramètre alors que le player connaît déjà ce moment-là sans ambiguïté.

**Choix du nom** : `prepareSeek` reprend le vocabulaire déjà établi par `AvatarEngine.prepareSeek()` / `commitSeek()` (package `@codplay/avatar-engine`, pas le cœur) — un adapter qui délègue à un moteur nommé ainsi n'a aucune traduction à faire. Le nom décrit une action générique ("préparer l'état interne avant une reconstruction de seek"), pas un comportement propre à une bibliothèque. Alternatives écartées : `seekStart?()` (asymétrique — `seek()` n'est pas nommé `seekEnd()`, laisse deviner une paire qui n'existe pas) ; `resetForSeek?()` (décrit l'effet mais perd la lisibilité temporelle "avant/après" du nom retenu).

### `seek(info)`

Inchangé. Appelé une fois après le replay des events de seek, avec la position cible atteinte. Doit matérialiser l'état reconstruit sans interpolation — snap instantané, pas d'easing.

---

## Relation à `ComponentServiceBase` (cf. `v1-third-party-runtime-spec.md`)

`ComponentServiceBase.reset()` documente : *"Remet le service à son état neutre/initial. Appelé automatiquement par le composant sur `stop()` et avant seek replay."* Le déclencheur de la seconde moitié de cette phrase est `prepareSeek?()` :

```
RenderSync.prepareSeek()
  → adapter.prepareSeek?.()              [hub d'une bibliothèque, packages/authoring/components/*]
    → instance._prepareSeek() (interne au composant base)
      → instance._resetServices()
        → service.reset() pour chaque ComponentServiceBase enregistré via _addService()
```

Aucune partie de cette chaîne, sous `RenderSync.prepareSeek()`, n'appartient au cœur `codplay` — le hook canonique est le seul échelon générique ; tout le reste (hub, composant base, services) est un détail d'implémentation du package authoring concerné.

Un adapter sans services internes stateful (ex. l'adapter interne anime.js, ou `MediaComponent`/`<video>` dont le seek est idempotent via `currentTime`) n'implémente simplement pas `prepareSeek?()` — rien à câbler, rien à documenter de plus.

---

## Règle de choix dans `tick()` (rappel — détail complet dans `v1-rate-spec.md`)

- moteur avec multiplicateur natif → `deltaMs` brut + implémenter `rateChange(rate)`.
- moteur sans multiplicateur natif → `timelineDeltaMs` déjà scalé, `rateChange` non nécessaire.
- ne jamais combiner les deux dans le même adapter (double application du rate).

---

## Règles V1

- `RenderAdapter` est le seul contrat de couplage au ticker CodPlay ; aucune bibliothèque tierce ne le redéclare localement (importer le type canonique, jamais le redupliquer — une copie partielle qui oublie un hook optionnel est indétectable par TypeScript et a déjà causé un bug, cf. `v1-rate-spec.md`).
- `prepareSeek?()`, `pause?()`, `resume?()`, `rateChange?()`, `stop?()` sont optionnels ; un hook omis est silencieusement ignoré, jamais une erreur.
- `prepareSeek?()` est appelé une fois, avant le replay des events de seek ; `seek(info)` est appelé une fois, après. Aucun event de track n'est visible par l'adapter entre les deux — seul le player orchestre le replay.
- `prepareSeek?()` ne reçoit aucune information de position cible — son rôle est de nettoyer un état, pas de viser une position.
- toute bibliothèque tierce avec un état interne continu (schedulers, poses en cours d'easing, services avec `advance()`) doit implémenter `prepareSeek?()` ; une bibliothèque dont le seek est nativement idempotent (assignation directe comme `currentTime`) peut l'omettre.
- `prepareSeek?()` descend vers `ComponentServiceBase.reset()` quand le composant suit le pattern de services internes (`v1-third-party-runtime-spec.md`) ; ce n'est pas une obligation pour un adapter qui ne suit pas ce pattern (ex. l'adapter interne anime.js).
- aucun nom de bibliothèque, de composant ou de package authoring n'apparaît dans cette spec — elle décrit exclusivement le contrat générique.

---

## Références

- `v1-rate-spec.md` — propagation du rate, règles `deltaMs` vs `timelineDeltaMs` dans `tick()`.
- `v1-third-party-runtime-spec.md` — `ThirdPartyBinding`, cycle de vie du composant, `ComponentServiceBase`.
- `v1-seek-spec.md` — reconstruction de l'état par replay de tracks (le "replay" entre `prepareSeek?()` et `seek()` est piloté par cette spec, pas par `RenderAdapter`).
