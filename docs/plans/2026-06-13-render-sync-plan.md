# Plan — RenderSync : synchronisation des renderers externes à CodPlay

Date : 2026-06-13  
Statut : proposition validée — à implémenter

---

## Principe directeur

CodPlay est le maître du temps. Son ticker envoie un **objet riche** à ses dépendances. Chaque adapter est responsable de la traduction vers l'API de la librairie. CodPlay ne connaît pas les détails internes des libs.

---

## Problème actuel

Le hook `renderFrame?: (nowMs: number) => void` dans `CreatePlayerOptions` est insuffisant :

- reçoit seulement `nowMs` — pas de delta, pas de rate, pas de position timeline
- callback unique — impossible d'enregistrer plusieurs renderers
- même signal pour tick et seek — le seek force un grand-delta comme proxy (fragile)
- rate, pause, resume ne sont pas propagés aux renderers externes
- delta calculé manuellement dans le démo (`nowMs - prevFrameMs`)

---

## Audit des APIs d'external ticker

### anime.js (actuel)
- `engine.useDefaultMainLoop = false` — désactive le RAF interne ✓
- `engine.update()` — appelé manuellement chaque tick ✓
- `engine.speed = rate` — rate ✓
- Tick : via `animationAdapter.renderFrame(nowMs)` dans le default adapter ✓

### lottie-web 5.x
- `lottie.freeze()` — stoppe le RAF interne du manager (`_isFrozen = true`) ✓
- `animation.goToAndStop(ms, false)` — positionne et rend en un appel
  - `false` = valeur en ms (pas en frames)
  - calcule : `currentRawFrame = ms * frameMult = ms * frameRate / 1000`
  - appelle `renderFrame()` en interne
- `animation.setSpeed(rate)` — modifie `frameModifier` (affecte `advanceTime`, pas `goToAndStop`)
- Pattern : charger avec `autoplay: false`, `lottie.freeze()`, puis `goToAndStop` chaque tick

### TalkingHead (avatarOnly)
- `head.start()` — positionne `isRunning = true` sans démarrer de RAF
- `head.animate(deltaMs)` — avance l'état de `deltaMs` ms
- Les morph targets ont un easing interne (`mt.fixed`, `mt.value`, `mt.acc`, `mt.maxv`)
- Pour snap (seek) : écrire directement dans `mt.value`, `mt.applied`, `mt.ms[i][mt.is[i]]`

### Three.js WebGLRenderer
- `renderer.render(scene, camera)` — stateless, appeler à chaque frame
- Pas de ticker interne à désactiver

### Rive (`@rive-app/canvas`)
- `rive = new Rive({ autoplay: false })` — désactive le ticker interne
- `artboard.advance(deltaMs)` — avance l'état
- `renderer.render()` — rend le frame
- `stateMachine.advance(deltaMs)` — avance la machine d'état

### PixiJS
- `app.ticker.stop()` — stoppe le RAF interne
- `app.ticker.update(nowMs, deltaMs)` — drive manuel ✓
- `app.ticker.speed = rate` — rate ✓

**Conclusion** : toutes les libs majeures peuvent être pilotées depuis un ticker externe. Le pattern est uniforme : désactiver le RAF interne à l'init, puis recevoir des signaux de tick et de seek.

---

## Interface `RenderAdapter`

```ts
/**
 * Informations transmises à chaque frame de lecture.
 *
 * nowMs            : timestamp monotone (performance.now()), horloge murale
 * deltaMs          : delta horloge murale depuis le dernier tick (0 au premier tick)
 * timelineMs       : position courante dans la timeline scène
 * timelineDeltaMs  : delta en temps scène = deltaMs × rate
 * rate             : vitesse de lecture courante
 */
export type RenderTickInfo = {
  nowMs: number
  deltaMs: number
  timelineMs: number
  timelineDeltaMs: number
  rate: number
}

/**
 * Informations transmises après un seek.
 * L'état a été reconstruit par relecture des tracks.
 * Les renderers doivent se positionner instantanément — pas d'easing.
 */
export type RenderSeekInfo = {
  nowMs: number
  timelineMs: number
}

/**
 * Point de couplage entre le ticker CodPlay et un renderer externe.
 * CodPlay envoie des signaux riches ; chaque adapter traduit vers son API.
 */
export interface RenderAdapter {
  /** Appelé chaque frame pendant la lecture. Avancer l'état, puis rendre. */
  tick(info: RenderTickInfo): void
  /** Appelé une fois après reconstruction seek. Snap instantané, pas d'easing. */
  seek(info: RenderSeekInfo): void
  /** Appelé quand la lecture se met en pause. */
  pause?(): void
  /** Appelé quand la lecture reprend après une pause. */
  resume?(): void
  /** Appelé quand le rate change. */
  rateChange?(rate: number): void
  /** Appelé à destroy. Libérer les ressources. */
  stop?(): void
}
```

### Règles comportementales

1. `tick` reçoit `deltaMs` (horloge murale) ET `timelineDeltaMs` (temps scène). L'adapter choisit ce qui est pertinent pour sa lib.
2. `seek` ne rejoue pas l'historique — il positionne à l'état final. Pas d'easing acceptable.
3. `deltaMs = 0` au premier tick après play ou resume — les libs doivent l'accepter.
4. Erreurs dans un adapter : tracées via le système de warnings auteur du player, non propagées aux autres adapters.
5. Les adapters sont appelés dans l'ordre d'enregistrement — Three.js après TH pour rendre après le snap.

---

## Module `RenderSync`

Nouveau module : `src/player/render-sync.ts`

```ts
export class RenderSync {
  private readonly adapters: RenderAdapter[]
  private lastNowMs: number | null = null

  constructor(adapters: RenderAdapter[]) {
    this.adapters = [...adapters]
  }

  tick(nowMs: number, timelineMs: number, rate: number): void {
    const deltaMs = this.lastNowMs !== null ? nowMs - this.lastNowMs : 0
    this.lastNowMs = nowMs
    const info: RenderTickInfo = {
      nowMs,
      deltaMs,
      timelineMs,
      timelineDeltaMs: deltaMs * rate,
      rate,
    }
    for (const adapter of this.adapters) {
      try { adapter.tick(info) } catch (e) { /* trace warning */ }
    }
  }

  seek(nowMs: number, timelineMs: number): void {
    this.lastNowMs = nowMs
    const info: RenderSeekInfo = { nowMs, timelineMs }
    for (const adapter of this.adapters) {
      try { adapter.seek(info) } catch (e) { /* trace warning */ }
    }
  }

  pause(): void {
    for (const adapter of this.adapters) { try { adapter.pause?.() } catch {} }
  }

  resume(): void {
    this.lastNowMs = null  // premier tick post-resume : delta = 0
    for (const adapter of this.adapters) { try { adapter.resume?.() } catch {} }
  }

  rateChange(rate: number): void {
    for (const adapter of this.adapters) { try { adapter.rateChange?.(rate) } catch {} }
  }

  stop(): void {
    for (const adapter of this.adapters) { try { adapter.stop?.() } catch {} }
    this.lastNowMs = null
  }
}
```

---

## Intégration dans le player

### `CreatePlayerOptions`

```ts
// Supprimé
renderFrame?: (nowMs: number) => void

// Ajouté
renderAdapters?: RenderAdapter[]
```

### Points de dispatch

| Signal player | Appel actuel | Nouvel appel |
|--------------|--------------|--------------|
| Tick playback | `renderer.renderFrame(nowMs)` | `renderSync.tick(nowMs, timelineMs, rate)` |
| Seek complet | `renderer.renderFrame(nowMs)` | `renderSync.seek(nowMs, timelineMs)` |
| Pause | `renderer.pause()` | `renderer.pause()` + `renderSync.pause()` |
| Resume | `renderer.resume()` | `renderer.resume()` + `renderSync.resume()` |
| setRate | `renderer.setRate(rate)` | `renderer.setRate(rate)` + `renderSync.rateChange(rate)` |
| Stop/destroy | — | `renderSync.stop()` |

### Relation avec `AnimationAdapter`

`AnimationAdapter` (anime.js, transitions CSS) reste inchangé — il gère les animations event-driven. Son `renderFrame` est encapsulé dans un adapter interne créé par le player :

```ts
// Adapter interne — pont vers AnimationAdapter.renderFrame
const animeRenderAdapter: RenderAdapter = {
  tick({ nowMs }) { animationAdapter.renderFrame?.(nowMs) },
  seek() { /* seek CSS géré séparément par syncAnimationsToTimeline */ },
  pause() { animationAdapter.pause?.() },
  resume() { animationAdapter.resume?.() },
  rateChange(rate) { animationAdapter.setRate?.(rate) },
  stop() { animationAdapter.stop() },
}
```

Ce `animeRenderAdapter` est toujours inséré en **premier** dans `RenderSync` — avant les adapters utilisateur.

---

## Exemples d'adapters

### TalkingHead + Three.js (`@codplay/avatar3d`)

```ts
export function createTalkingHeadRenderAdapter(deps: {
  head: AvatarHeadApi & { animate(deltaMs: number): void }
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.Camera
}): RenderAdapter {
  return {
    tick({ deltaMs }) {
      deps.head.animate(deltaMs)
      deps.renderer.render(deps.scene, deps.camera)
    },
    seek() {
      snapVisemeMorphs(deps.head)
      deps.renderer.render(deps.scene, deps.camera)
    },
    rateChange(rate) {
      // optionnel : (deps.head as any).animSlowdownRate = 1 / rate
    },
  }
}

// Snap direct des morphes visème — pas d'easing, pas de animate()
function snapVisemeMorphs(head: unknown): void {
  const th = head as { mtAvatar?: Record<string, THMorphTarget> }
  if (!th.mtAvatar) return
  for (const [key, mt] of Object.entries(th.mtAvatar)) {
    if (!key.startsWith('viseme_') || mt.fixed === null) continue
    const clamped = Math.max(mt.min, Math.min(mt.max, mt.fixed))
    mt.value = mt.fixed
    mt.applied = clamped
    mt.v = 0
    mt.needsUpdate = false
    for (let i = 0; i < mt.ms.length; i++) mt.ms[i][mt.is[i]] = clamped
  }
}
```

### Lottie (lottie-web 5.x)

```ts
import lottie, { type AnimationItem } from 'lottie-web'

export function createLottieRenderAdapter(deps: {
  animation: AnimationItem
  /** Offset de la position timeline CodPlay dans la timeline Lottie (ms) */
  offsetMs?: number
}): RenderAdapter {
  // Désactive le RAF interne de lottie
  lottie.freeze()

  return {
    tick({ timelineMs }) {
      deps.animation.goToAndStop(
        Math.max(0, timelineMs - (deps.offsetMs ?? 0)),
        false  // false = valeur en ms
      )
    },
    seek({ timelineMs }) {
      deps.animation.goToAndStop(
        Math.max(0, timelineMs - (deps.offsetMs ?? 0)),
        false
      )
    },
    pause() { /* animation est frozen via lottie.freeze() — déjà arrêtée */ },
    resume() { /* tick reprend via CodPlay — rien à faire */ },
    rateChange(rate) { deps.animation.setSpeed(rate) },
    stop() { deps.animation.destroy() },
  }
}
```

Note : `lottie.freeze()` est global. En pratique, charger avec `autoplay: false` et ne pas appeler `lottie.unfreeze()`.

---

## Phases d'implémentation

### Phase 1 — Types et module RenderSync
- Créer `src/player/render-adapter-types.ts` : `RenderAdapter`, `RenderTickInfo`, `RenderSeekInfo`
- Créer `src/player/render-sync.ts` : classe `RenderSync`
- Tests unitaires de `RenderSync` (tick, seek, pause, resume, stop, deltaMs computation)

### Phase 2 — Intégration player
- Modifier `CreatePlayerOptions` : supprimer `renderFrame`, ajouter `renderAdapters`
- Instancier `RenderSync` dans `PlayerFacade` avec `animeRenderAdapter` en tête + adapters utilisateur
- Remplacer tous les `renderer.renderFrame(...)` par `renderSync.tick(...)`
- Remplacer le `renderer.renderFrame(...)` post-seek par `renderSync.seek(...)`
- Propager pause/resume/rateChange/stop vers `renderSync`
- `AnimationAdapter.pause/resume/setRate` ne sont plus appelés directement par le player — ils passent par `animeRenderAdapter`
- Mettre à jour les tests lot13 et lot16

### Phase 3 — Adapter avatar3d
- Créer `createTalkingHeadRenderAdapter` dans `@codplay/avatar3d/src/`
- Supprimer `prevFrameMs` et le `renderFrame` hack dans `avatar-poc-1-demo.ts`
- Migrer le démo vers `renderAdapters: [createTalkingHeadRenderAdapter(...)]`
- Déplacer `snapVisemeMorphs` dans l'adapter (remplace le fix temporaire dans `create-player.ts`)

### Phase 4 — Exemples et doc
- Adapter Lottie dans `src/examples/lottie-adapter-example.ts`
- `README` dans `src/player/` pour le pattern adapter

---

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `src/player/render-adapter-types.ts` | nouveau |
| `src/player/render-sync.ts` | nouveau |
| `src/player/create-player.ts` | `renderAdapters`, dispatcher, supprimer `renderFrame` |
| `src/animation/create-default-adapter.ts` | plus de `renderFrame` option |
| `packages/authoring/avatar3d/src/` | `createTalkingHeadRenderAdapter` |
| `packages/demos/src/codplay/avatar-poc-1-demo.ts` | migrer vers `renderAdapters` |
| `packages/demos/src/codplay/run-codplay-scene-demo.ts` | passer `renderAdapters` |
| `tests/lot13/create-player.spec.ts` | mettre à jour |
| `tests/lot16/player-timeline-playback.spec.ts` | mettre à jour |
