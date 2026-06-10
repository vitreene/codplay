# Rate spec V1 - vitesse de lecture

## Statut

Spec normative V1 pour le multiplicateur de vitesse de lecture `rate`.

## Objectif

Permettre d'accelrer ou de ralentir uniformement la lecture d'une sequence sans modifier les valeurs d'eventimes ni les durees d'animation authoriees. Toutes les sources d'avancement temporel doivent scaler avec `rate` de facon coherente.

## Definition

`rate` est un multiplicateur positif non nul applique a l'avancement temporel du player.

- `rate = 1` : vitesse normale (defaut)
- `rate = 2` : deux fois plus rapide
- `rate = 0.5` : deux fois plus lent
- `rate = 0.25` : quatre fois plus lent

Les valeurs d'eventimes ne sont pas modifiees. Ce sont les sources d'avancement du temps qui scalent.

## Sources d'avancement temporel

Il existe trois sources independantes qui doivent toutes scaler avec `rate` :

### 1. Timeline player

La position `timelineMs` est calculee par la formule d'ancrage :

```
timelineMs = rateAnchorMs + (wallClockNowMs - wallAnchorMs) × rate
```

- `wallAnchorMs` : horloge murale au moment ou le rate courant a ete etabli (play ou setRate)
- `rateAnchorMs` : position timeline a ce meme moment
- les deux ancres sont recalculees a chaque appel a `play()`, `resume()`, `rewind()`, et `setRate()`

Consequence : modifier `rate` en cours de lecture ne saute pas la position timeline. Le re-ancrage se fait sur la position courante avant le changement.

### 2. Helpers `context.live.*` (PlayerScheduleFacade)

Les helpers live (`wait`, `delay`, `repeat`, `loop`) utilisent une horloge virtuelle `virtualNowMs` incrementee a chaque tick :

```
virtualNowMs += deltaMs × rate
```

Un helper `live.wait(500, ...)` se declenche apres 500 ms de timeline, soit `500 / rate` ms reelles.

### 3. Moteur d'animation (AnimationAdapter)

Le moteur d'animation (anime.js v4 en reference) expose `engine.speed`. Celui-ci est un multiplicateur global applique a tous les tweens actifs :

```
tickDelta = (wallClockNowMs - animation._startTime) × animation._speed × engine.speed
```

`setRate(rate)` doit propager `rate` vers `engine.speed` via le hook `AnimationAdapter.setRate`.

## Contrat de propagation

`setRate` doit traverser la chaine complete suivante a chaque appel :

```
telco.setRate(rate)
  → player.setRate(rate)          [Player public facade]
    → PlayerFacade.setRate(rate)  [re-ancrage timeline]
    → renderer.setRate(rate)      [RendererFacade]
      → animationAdapter.setRate?.(rate)  [hook optionnel]
    → scheduleRuntime.setRate(rate)       [PlayerScheduleFacade principal]
    → strapLoopSchedulers.setRate(rate)   [schedulers de boucles actives]
```

Le hook `animationAdapter.setRate` est optionnel (`?`). Une integration qui n'utilise pas de moteur d'animation externe peut l'omettre.

## API PlayerApi

```ts
type PlayerApi = {
  // ...
  getRate: () => number
  setRate: (rate: number) => void
  // ...
}
```

- `getRate()` retourne le rate courant.
- `setRate(rate)` applique le nouveau rate et propage a toutes les dependances.
- les valeurs admises sont les reels strictement positifs. Une valeur <= 0 est non definie.

## API TelcoApi

```ts
type TelcoApi = {
  // ...
  readonly rate: number
  setRate: (rate: number) => void
  // ...
}
```

- `rate` est un getter qui delegue a `player.getRate()`.
- `setRate` delegue a `player.setRate()` sans serialisation de commande (synchrone, pas de `commandInFlight`).

## Hook AnimationAdapter

```ts
type AnimationAdapter = {
  // ...
  setRate?: (rate: number) => void
}
```

Le hook est appele par `renderer.setRate(rate)`. L'integration est responsable de connecter ce hook a son moteur d'animation. Exemple avec anime.js v4 :

```ts
createAnimationAdapter(animeImplementation, {
  setRate: (rate) => { engine.speed = rate }
})
```

## Interactions avec les autres commandes

### seek

`seek` positionne le player a une position timeline absolue en millisecondes. `rate` n'affecte pas l'interpretation de la cible de seek. Apres un seek reussi, le player reste en `paused` ; si `play()` est appele ensuite, le re-ancrage se fait avec le `rate` courant.

### pause / resume

- `pause` : fige `timelineMs` sur la position courante, annule les ancres (`playbackStartMs = null`).
- `resume` / `play` depuis `paused` : re-ancre `wallAnchorMs` et `rateAnchorMs` avec le `rate` courant. Le rate precedent est preserve.

### rewind

Apres retour a `timelineMs = 0`, si le player etait en `playing`, les ancres sont recalculees avec le `rate` courant avant de relancer la boucle de lecture.

### master clock

Si un master est actif, `timelineMs` suit le temps de ce master. Dans ce cas, `rate` n'a pas d'effet sur la timeline principale (le master dicte sa propre cadence). Les helpers live et le moteur d'animation restent scales par `rate`.

## Ce que rate ne modifie pas

- les valeurs d'eventimes dans le `SceneDoc` et le `CompiledScene`
- la logique de seek et de reconstruction (seek travaille toujours en ms absolus)
- les durees d'animation telles qu'authoriees dans les actions (`duration`, `delayMs`)
- les seuils d'horizon et de seek policy

## Usages prevus

- debug : ralentir une sequence pour observer precisement les transitions et l'enchainement des evenements
- test : accelerer une sequence longue pour valider la completion
- UX : variation de rythme controlee par l'auteur via un strap (appel a `player.setRate`)
