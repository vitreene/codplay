# Guide reconstruction V1

## Objectif

Permettre de reconstruire le projet avec des fonctionnalites identiques a l'etat actuel implemente.

Perimetre couvert par ce guide:

- lots 01 a 08 implementes et verifies
- invariants runtime associes
- commandes de verification minimales

## Definition de "identique"

Une reconstruction est consideree identique si les points suivants sont vrais:

1. memes modules coeur et memes signatures publiques
2. memes regles de resolution/tri/events/actions/animation
3. memes tests lot verts avec les memes intentions DoD
4. meme resultat de build TypeScript

## Modules a reconstruire (source of truth)

### Lot 01 - temps

- `src/core/time/clock.ts`
  - `createClock(nowProvider?)`
  - `nowMs()` monotone
  - `reset(baseMs?)`
- `src/core/time/ticker.ts`
  - `createTicker(options)`
  - `start(onTick)` / `stop()` / `isRunning()`
  - payload tick: `{ prevMs, nowMs, deltaMs, marginMs }`

### Lot 02 - pipeline events

- `src/core/events/flatten.ts`
  - flatten parent/enfant avec `finalMs = parent + child`
- `src/core/events/sort.ts`
  - tri deterministe: `ms`, `track.order`, `index`, `source=user` apres autres a egalite
- `src/core/events/collect-window.ts`
  - fenetre: `(prevMs, nowMs + margin]`
- `src/core/events/dispatch.ts`
  - matching exact `event.name === actionKey`
  - ordre des cibles = ordre declaration listeners

### Lot 03 - bridge animation

- `src/animation/adapter.ts`
  - `createAnimationAdapter(animeImplementation)`
  - `run(batch)` retourne des handles stoppables
  - `stop(target?)` arret global ou cible
- `src/animation/derive-simple.ts`
  - derive les transitions depuis `action.style`
  - ne garde que les proprietes valides (`to` present)
- `src/animation/run-batch.ts`
  - no-op si batch vide
  - trace minimale event -> transition

### Lot 04 - runtime minimal

- `src/runtime/create-element.ts`
  - support minimal `text`, `img`, `list`
- `src/runtime/mount-elements.ts`
  - creation des runtime elements d'une story
- `src/runtime/apply-actions.ts`
  - patch minimal `className`, `style`, `attr`
  - declenchement de l'animation via `runAnimationBatch`

### Lot 05 - extensibilite agnostique

- aucun allowlist de proprietes animees
- toute propriete `style.*` valide peut devenir transition
- cible animation agnostique:
  - si `target.style` existe: patch HTML-like dans `target.style`
  - sinon: patch direct sur l'objet cible
- objectif: traiter un node HTML ou un objet third-party (ex: lottie/rive) de la meme facon

### Lot 06 - wait flow runtime

- `src/runtime/wait-flow.ts`
  - `createWaitFlowRuntime(options?)`
  - `startWait(startOptions)` / `resolveWait(resolveOptions)`
  - `getWait(waitId)` / `listWaits()`
- invariants wait-flow:
  - mode par defaut `parallel`
  - `suspendSource` refuse sans `fromStory`
  - `disableTracks='auto'` desactive `fromStoryTrackIds` seulement en `suspendSource`
  - `resolveWait` en `fromCursor` reprend a `frozenCursorMs`
  - `resolveWait` en `fromStart` reprend a `0`

### Lot 07 - plugin list complet

- `src/runtime/list-plugin/compute-list-diff.ts`
  - calcule `added`, `removed`, `moved`
- `src/runtime/list-plugin/run-list-plugin.ts`
  - derive transitions `enter/leave/move:flip`
  - construit `commitPlan` (`leaving`, `detachAfterAnimation`)
  - produit traces `list:*` minimales
  - applique fallback perf (drop `move` seulement)
- `src/runtime/list-plugin/create-list-plugin.ts`
  - instancie le plugin `list-plugin`
  - branche les configs list de l'item runtime
- `src/runtime/create-element.ts`
  - instancie automatiquement le plugin pour `type='list'`

### Lot 08 - moteur FLIP generique

- document de cadrage: `evolution/lots/lot-08-flip-engine-etude-spec.md`
- runtime FLIP:
  - `src/runtime/flip-engine/create-flip-engine.ts`
  - `src/runtime/flip-engine/matrix-2d.ts`
  - `src/runtime/flip-engine/types.ts`
  - sequence anti-flicker: `FIRST/read -> LAST/write -> LAST/read -> INVERT/write -> rAF -> PLAY`
- demo DOM: `flip-example.html` + `src/examples/flip-engine-dom-example.ts`

## Matrice tests (DoD executable)

- `tests/lot1/ticker.spec.ts` -> `L1-T1..L1-T5`
- `tests/lot2/events-pipeline.spec.ts` -> `L2-T1..L2-T5`
- `tests/lot3/animation-bridge.spec.ts` -> `L3-T1..L3-T5`
- `tests/lot4/minimal-e2e.spec.ts` -> `L4-T1`
- `tests/lot5/animation-properties-extensibility.spec.ts` -> `L5-T1..L5-T3`
- `tests/lot6/wait-flow-runtime.spec.ts` -> `L6-T1..L6-T6`
- `tests/lot7/list-plugin.spec.ts` -> `L7-T1..L7-T5`
- `tests/lot8/flip-engine.spec.ts` -> `L8-T1..L8-T10`

## Verification reconstruction

Commandes minimales:

- `npm run test:lot1`
- `npm run test:lot2`
- `npm run test:lot3`
- `npm run test:lot4`
- `npm run test:lot5`
- `npm run test:lot6`
- `npm run test:lot7`
- `npm run test:lot8`
- `npm test`
- `npm run build`

Validation manuelle DOM (lot 08):

- `npm run dev:flip`

Criteres pass:

- tous les tests lots verts
- suite globale verte
- build TypeScript/Vite vert

## Regle de maintenance des notes

Toute modification runtime qui change un comportement fonctionnel doit mettre a jour:

1. le fichier de lot impacte dans `evolution/lots/`
2. `evolution/lots/status.md`
3. ce guide (`evolution/17-guide-reconstruction-v1.md`) si le contrat de reconstruction change

Sans ces trois mises a jour, la reconstruction a l'identique n'est plus garantie.
