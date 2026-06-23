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

## Principe directeur : le moteur regle son propre rate

CodPlay ne recalcule jamais lui-meme l'avancement d'un moteur tiers (anime.js, Three.js/avatar-engine, Rive, lottie-web, media HTML). Pour chaque source d'avancement temporel, **c'est le moteur qui possede et applique son propre multiplicateur de vitesse**, exactement comme un lecteur video natif ou `engine.speed` chez anime.js :

| Moteur | Mecanisme natif de rate |
|---|---|
| anime.js | `engine.speed = rate` |
| lottie-web | `animation.setSpeed(rate)` |
| `<audio>`/`<video>` natif | `mediaElement.playbackRate = rate` |
| `@codplay/avatar-engine` (Three.js) | `engine.setRate(rate)` — stocke `rate` et scale `deltaMs` en interne dans `animate()` |
| Rive (`@rive-app/canvas`) | pas de multiplicateur natif — le seul levier est l'argument `sec` passe a `advance()`. Le rate est stocke localement par l'adapter et applique a `sec` a chaque tick |

Consequence : CodPlay transmet le `deltaMs` **brut** (horloge murale, non scale) a `tick()`. Ne jamais combiner un `deltaMs` deja scale (ex. `timelineDeltaMs`) avec le mecanisme natif du moteur — cela appliquerait le rate deux fois.

## Sources d'avancement temporel

Il existe quatre sources independantes qui doivent toutes scaler avec `rate` :

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

### 3. Renderers externes (`RenderAdapter`)

Chaque renderer externe couple a CodPlay (anime.js, avatar3d/Three.js, avatar-rive, et tout futur adapter Lottie/PixiJS) est un `RenderAdapter` orchestre par `RenderSync`. Le contrat canonique complet (incluant `prepareSeek?()`, le hook appele avant le replay des events de seek) est documente dans `v1-render-adapter-spec.md` — cette section se limite aux regles propres au rate (`tick`, `rateChange`).

```ts
import type { RenderAdapter, RenderTickInfo, RenderSeekInfo } from 'codplay'
```

Regle de choix dans `tick()` :
- si l'adapter pilote un moteur avec son propre multiplicateur natif (cf. tableau ci-dessus) → utiliser `deltaMs` brut, et implementer `rateChange(rate)` pour configurer le moteur.
- si l'adapter n'a aucun moteur propre (rendu stateless, ex. `renderer.render(scene, camera)` pur) → `timelineDeltaMs` est deja le bon delta scale, `rateChange` n'est pas necessaire.

**Ne jamais melanger les deux** : un adapter qui implemente `rateChange` pour configurer un moteur natif doit ignorer `timelineDeltaMs` dans `tick()`, sinon le rate s'applique deux fois.

`rateChange` est optionnel dans le contrat (`?`) — un adapter sans notion de vitesse propre peut l'omettre. Mais tout adapter livre dans ce monorepo qui pilote un moteur stateful (avatar3d, avatar-rive, futur Lottie) **doit** l'implementer ; c'est l'oubli de cette implementation qui a cause le bug initial (rate sans effet sur l'avatar et sur l'audio).

Reference d'implementation (le pattern a suivre pour tout nouvel adapter) :

```ts
// adapter interne anime.js, cree par PlayerFacade
const animeRenderAdapter: RenderAdapter = {
  tick({ nowMs }) { animationAdapter.renderFrame?.(nowMs) },
  seek() {},
  pause() { animationAdapter.pause?.() },
  resume() { animationAdapter.resume?.() },
  rateChange(rate) { animationAdapter.setRate?.(rate) },
  stop() { animationAdapter.stop() },
}
```

Importer le type canonique plutot que le redupliquer localement : trois adapters (`avatar3d-render-adapter.ts`, `create-avatar3d.ts`, `avatar-rive-component.ts`) avaient chacun leur propre copie partielle du type `RenderAdapter`, sans `rateChange` — c'est exactement ce qui a permis au bug de passer inapercu. Le hook `prepareSeek?()` (avant, local et non cable, nomme `seekStart()` dans ces memes adapters) fait desormais partie du contrat canonique — voir `v1-render-adapter-spec.md`. Aucune extension locale par intersection de type n'est plus necessaire pour ce besoin.

### 4. Media (`MediaSyncModule`)

Les elements `<audio>`/`<video>` ne sont pas modelises comme des `RenderAdapter` (ils ne sont pas pilotes frame par frame par CodPlay — `syncTimeline()` les laisse jouer nativement et corrige la derive). Le rate y est applique via le mecanisme natif du navigateur :

```ts
mediaElement.playbackRate = rate
```

propage par `MediaComponent.setRate(rate)` → `MediaSyncModule.setRate(rate)` → tous les composants media tracks, et applique aussi aux nouveaux medias montes apres un changement de rate. `setRate` est optionnel sur `MediaSyncRuntimeComponent` (`setRate?:`) pour ne pas casser les composants de test qui n'en ont pas besoin.

**Effet de bord assume** : `playbackRate` natif modifie aussi la hauteur (pitch) du son — comportement standard du navigateur, pas de time-stretching a hauteur constante. Choix retenu pour sa simplicite et sa fiabilite (cf. decision produit).

## Contrat de propagation

`setRate` doit traverser la chaine complete suivante a chaque appel :

```
telco.setRate(rate)
  → player.setRate(rate)              [Player public facade]
    → PlayerFacade.setRate(rate)      [re-ancrage timeline]
    → renderSync.rateChange(rate)     [tous les RenderAdapter, anime.js inclus]
    → mediaSync.setRate(rate)         [tous les MediaSyncRuntimeComponent]
    → scheduleRuntime.setRate(rate)   [PlayerScheduleFacade principal]
    → strapLoopSchedulers.setRate(rate) [schedulers de boucles actives]
```

`renderSync.rateChange(rate)` boucle sur tous les adapters enregistres (`options.renderAdapters`) et appelle `adapter.rateChange?.(rate)` sur chacun — un adapter qui n'implemente pas le hook est silencieusement ignore (et donc insensible au rate, ce qui doit etre un choix delibere, pas un oubli).

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

## Hook AnimationAdapter (anime.js)

`AnimationAdapter.setRate` reste le point d'integration cote demo pour anime.js, mais n'est plus appele directement par `PlayerFacade.setRate`. Il est encapsule par l'`animeRenderAdapter` interne (cf. section 3) que `RenderSync.rateChange` declenche comme tout autre `RenderAdapter` :

```ts
type AnimationAdapter = {
  // ...
  setRate?: (rate: number) => void
}
```

L'integration connecte ce hook a son moteur d'animation. Exemple avec anime.js v4 :

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

Si un master media est actif, `timelineMs` suit `component.getCurrentTimeMs()` de ce master (`resolveTimelineMsFromActiveMaster`). Depuis que `MediaSyncModule.setRate` applique `playbackRate` nativement sur l'element media, le master avance lui-meme a la cadence scalee — `timelineMs` herite donc correctement du `rate`, sans calcul supplementaire cote player. Avant ce fix, le master ignorait `rate` et la timeline principale restait bloquee a vitesse normale meme si tout le reste (helpers, anime.js) etait scale — c'etait l'un des deux bypass corriges (l'autre etant l'avatar3d).

## Ce que rate ne modifie pas

- les valeurs d'eventimes dans le `SceneDoc` et le `CompiledScene`
- la logique de seek et de reconstruction (seek travaille toujours en ms absolus)
- les durees d'animation telles qu'authoriees dans les actions (`duration`, `delayMs`)
- les seuils d'horizon et de seek policy

## Usages prevus

- debug : ralentir une sequence pour observer precisement les transitions et l'enchainement des evenements
- test : accelerer une sequence longue pour valider la completion
- UX : variation de rythme controlee par l'auteur via un strap (appel a `player.setRate`)
