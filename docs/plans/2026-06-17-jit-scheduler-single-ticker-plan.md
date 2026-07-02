# Plan — Migration JIT schedulers vers ticker unique CodPlay

**Date :** 2026-06-17  
**Contexte :** Les `PlayerScheduleFacade` (JIT schedulers pour `context.live.*`) possèdent chacun un `TimeTicker` RAF indépendant. Cela viole le principe d'une source de temps unique et crée une race condition sur `sequence:end` : les boucles idle émettent des événements synchronement dans leur propre callback RAF alors que la finalisation de `sequence:end` s'exécute en microtask dans la chaîne du ticker principal.

---

## Principe

`PlayerScheduleFacade` devient un **scheduler passif** : il n'a plus de ticker propre. Le ticker CodPlay (`create-player.ts`) est la seule source de ticks — il appelle `scheduler.tick(deltaMs)` à chaque frame, dans le même callback RAF synchrone, avant de queuer le travail async.

Cela élimine la race condition par construction : détection de `sequence:end` et tick des JIT schedulers se produisent dans le même contexte synchrone.

---

## Périmètre

### À migrer (violation core)
- `packages/codplay/src/player/player-schedule.ts` — supprimer `TimeTicker` propriété
- `packages/codplay/src/player/create-player.ts` — gate synchrone + tick JIT
- `packages/codplay/src/player/player.ts` — connecter schedulers au tick CodPlay

### Non concerné (acceptable)
- `create-flip-engine.ts` — one-shot RAF pour mesure DOM post-paint (par design)
- `creator-facade.ts` / `broadcast-player.ts` — telco progress, injectable, UI seulement
- `avatar-poc-demo.ts` — vieille démo standalone pré-CodPlay
- `editor/` — application séparée

---

## Étapes

### Étape 1 — `PlayerScheduleFacade` : supprimer le ticker propriétaire

**Fichier :** `packages/codplay/src/player/player-schedule.ts`

Changements :
- Supprimer `import { TimeTicker, type TickerOptions } from '../core/time/ticker'`
- Supprimer `private readonly ticker: TimeTicker`
- Supprimer `tickerOptions?: TickerOptions` du constructeur
- Supprimer `this.ticker = new TimeTicker(options.tickerOptions)` du constructeur
- Supprimer les méthodes `resume()` et `pause()` (elles ne font que démarrer/stopper le ticker)
- Remplacer par `tick(deltaMs: number): void` — avance `virtualNowMs` et appelle `processDueJobs()`
- Modifier `destroy()` : supprimer `this.ticker.stop()` / `this.ticker.destroy()`; garder `this.jobs.clear()`
- Modifier `stop()` : idem

Interface résultante :
```ts
class PlayerScheduleFacade {
  tick(deltaMs: number): void        // appelé par le ticker CodPlay à chaque frame
  loop(...): HelperHandle
  wait(...): HelperHandle
  delay(...): HelperHandle
  repeat(...): HelperHandle
  stagger(...): HelperHandle[]
  notifyEvent(eventName: string): void
  stop(): void
  destroy(): void
}
```

### Étape 2 — `create-player.ts` : gate synchrone + dispatch JIT tick

**Fichier :** `packages/codplay/src/player/create-player.ts`

Changements :

a) **Stocker `sequenceEndTriggerMs`** — à extraire lors de la compilation de la timeline.  
   Parcourir les events du plan pour trouver `sequence:end` et stocker son `ms`.

b) **Exposer un point de souscription pour les JIT tick subscribers** :
```ts
private readonly jitTickSubscribers = new Set<(deltaMs: number) => void>()

subscribeJitTick(fn: (deltaMs: number) => void): () => void {
  this.jitTickSubscribers.add(fn)
  return () => { this.jitTickSubscribers.delete(fn) }
}
```

c) **Modifier `startPlaybackLoop`** pour passer `deltaMs` à `runPlaybackTick` :
```ts
this.ticker.start((tickPayload) => {
  this.runPlaybackTick(tickPayload.nowMs, tickPayload.deltaMs)
})
```

d) **Modifier `runPlaybackTick`** — ajouter `frameDeltaMs` param, gate synchrone, dispatch JIT :
```ts
private runPlaybackTick(frameNowMs?: number, frameDeltaMs = 0): void {
  if (this.status !== PLAYER_STATUS.playing) return

  const timelineMs = this.resolveCurrentTimelineMs()

  // Gate synchrone : poser le flag avant tout travail async ou JIT
  if (
    this.sequenceEndTriggerMs !== null &&
    timelineMs >= this.sequenceEndTriggerMs &&
    !this.sequenceEnded
  ) {
    this.sequenceEnded = true
  }

  // Tick JIT schedulers dans le même contexte synchrone
  // Si sequenceEnded = true, leur emitEvent guard les arrête immédiatement
  const jitDeltaMs = frameDeltaMs * this._rate
  for (const subscriber of this.jitTickSubscribers) {
    subscriber(jitDeltaMs)
  }

  this.timelineMs = timelineMs
  // ... suite inchangée (async path ou sync path)
}
```

e) **`finalizeSequenceEnd`** : vider `jitTickSubscribers` (nettoyage définitif).

### Étape 3 — `player.ts` : connecter les JIT schedulers au tick CodPlay

**Fichier :** `packages/codplay/src/player/player.ts`

Dans `createJitScheduler()` :
- Supprimer `scheduler.resume()` / `scheduler.pause()` calls
- Après `this.strapLoopSchedulers.add(scheduler)`, souscrire au tick CodPlay :
```ts
const unsubscribe = this.player.subscribeJitTick((deltaMs) => {
  scheduler.tick(deltaMs)
})
```
- Dans `onIdle` : appeler `unsubscribe()` avant `this.strapLoopSchedulers.delete(scheduler)`

Modifier `destroyStrapLoopSchedulers()` pour appeler les `unsubscribe` callbacks accumulés.

Modifier `pauseStrapLoopSchedulers()` / `resumeStrapLoopSchedulers()` — ces méthodes n'ont plus à démarrer/stopper des tickers ; elles peuvent simplement être supprimées ou réduites à `notifyEvent`.

### Étape 4 — Guard dans `emitEvent` (déjà en place)

Le guard `if (this.player.getState().sequenceEnded) return` dans `createJitScheduler`'s `emitEvent` est maintenant EFFICACE : `sequenceEnded` est posé synchronement avant le tick JIT, donc le guard le voit à `true` et bloque l'émission.

### Étape 5 — Mise à jour des tests

- Tests de `PlayerScheduleFacade` qui passent `tickerOptions` → à adapter (`tick(deltaMs)` à appeler manuellement dans les tests)
- Tests des JIT schedulers (`lot1/ticker.spec.ts` n'est pas impacté — teste `TimeTicker` directement)
- Lancer `npm run test:gates` pour valider lot7, lot8, lot18

---

## Ordre chronologique minimal

1. `player-schedule.ts` : retirer le ticker, ajouter `tick()`
2. `create-player.ts` : ajouter `jitTickSubscribers`, gate synchrone dans `runPlaybackTick`, `subscribeJitTick`
3. `player.ts` : connecter via `subscribeJitTick`, supprimer `resume()`/`pause()` sur schedulers
4. Tests : adapter les instanciations de `PlayerScheduleFacade` sans ticker
5. `npm run test:gates` + `npm run test`

---

## Invariant post-migration

> À tout moment en mode `play`, un seul callback RAF est actif dans le système : celui du `TimeTicker` de `create-player.ts`. Tous les schedulers JIT reçoivent leur tick depuis ce callback unique, dans le même contexte synchrone, dans l'ordre : gate `sequence:end` → tick JIT → événements timeline.
