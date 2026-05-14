# Guide reconstruction V1

## Objectif

Permettre de reconstruire le projet avec des fonctionnalites identiques a l'etat actuel implemente.

Perimetre couvert par ce guide:

- lots 01 a 16 implementes et verifies
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
- demo DOM active: `src/demos/player-poc-demo.ts` (via `src/main.ts`)

### Lot 09 - trace/debug retention + export

- `src/runtime/trace-store.ts`
  - store in-memory avec retention FIFO
  - export JSON et NDJSON
  - filtres (`scope`, `eventName`, `status`, `sourceId`, `correlationId`, bornes temporelles)
- adaptateurs de trace:
  - `appendAnimationTraceEntries(...)`
  - `appendWaitTraceEntries(...)`
  - `appendListTraceEntries(...)`
  - `appendMediaTraceEntries(...)`

### Lot 10 - conflits same-tick runtime

- `src/runtime/html-render-mutation-resolver.ts`
  - resolution deterministe des conflits `style`, `attr`, `className` au meme tick
  - derniere mutation gagne sur la meme cible + meme cle/token
  - preservation des actions hors-conflit (`move`)
  - production de traces conflit `applied/rejected`
- `src/runtime/apply-actions.ts`
  - applique la resolution de conflits avant patch runtime
  - expose `conflictTrace` dans `ApplyActionsResult`

### Lot 11 - media sync avancee + master switching

- `src/runtime/media-sync.ts`
  - selection d'un media master unique selon tracks actifs
  - switch de master sans double playback (`pause` ancien puis `play` nouveau)
  - correction de derive master avec seuil (`media:sync:corrected`)
  - priorite du state player global sur playback media
- `src/runtime/trace-store.ts`
  - mapping traces media via `appendMediaTraceEntries(...)`

### Lot 12 - convertisseur legacy outillage

- `src/legacy-converter/convert-legacy-to-v1.ts`
  - conversion deterministe `persos + eventtimes` -> scene V1
  - dedupe `(ms,name)` + warnings de conversion
  - parent synthese manquant (`list`)
  - story/track/scenario minimaux en sortie

### Lot 13 - createPlayer API + state runtime

- `src/player/types.ts`
  - API player publique (`init/play/pause/seek/rewind/rebuild/...`)
  - format d'entree `SceneDoc`
- `src/player/create-player.ts`
  - cycle de vie player (`idle/ready/playing/...`)
  - commandes asynchrones et rejections explicites
  - subscriptions `onTrace` et `onStateChange`

### Lot 14 - telco locale composant

- `src/telco-local/types.ts`
  - contrat commande/resultat local telco
- `src/telco-local/create-local-telco.ts`
  - dispatch commandes vers `createPlayer`
  - requestId deterministic + stream resultats
- `src/telco-local/create-local-telco-panel.ts`
  - composant DOM de pilotage local (meme page)
- `src/main.ts`
  - demo locale player + telco

### Lot 15 - adaptation script animation Eddy (manuel)

- `src/integration/eddy-legacy-adapter.ts`
  - adaptation `persos[]/eventtimes` vers convertisseur legacy
  - mode preview pour `eventtimes` vide
- `src/integration/fixtures/eddy-snapshot-manual.ts`
  - fixture manuelle Eddy pour run local
- `src/integration/render-initial-scene.ts`
  - rendu initial de la scene convertie dans la page
- `src/main.ts`
  - integration run manuel fixture Eddy + style scope demande

### Lot 16 - player playback timeline minimal

- `src/player/create-player.ts`
  - planification playback des events timeline scene
  - execution pipeline `dispatch -> applyResolvedActions`
  - gestion `pause` (annulation events futurs)
  - reprise depuis curseur courant au `play`

## Matrice tests (DoD executable)

- `tests/lot1/ticker.spec.ts` -> `L1-T1..L1-T5`
- `tests/lot2/events-pipeline.spec.ts` -> `L2-T1..L2-T5`
- `tests/lot3/animation-bridge.spec.ts` -> `L3-T1..L3-T5`
- `tests/lot4/minimal-e2e.spec.ts` -> `L4-T1`
- `tests/lot5/animation-properties-extensibility.spec.ts` -> `L5-T1..L5-T3`
- `tests/lot6/wait-flow-runtime.spec.ts` -> `L6-T1..L6-T6`
- `tests/lot7/list-plugin.spec.ts` -> `L7-T1..L7-T5`
- `tests/lot8/flip-engine.spec.ts` -> `L8-T1..L8-T10`
- `tests/lot9/trace-store.spec.ts` -> `L9-T1..L9-T5`
- `tests/lot10/same-tick-conflicts.spec.ts` -> `L10-T1..L10-T6`
- `tests/lot11/media-sync.spec.ts` -> `L11-T1..L11-T6`
- `tests/lot12/legacy-converter.spec.ts` -> `L12-T1..L12-T6`
- `tests/lot13/create-player.spec.ts` -> `L13-T1..L13-T4`
- `tests/lot14/telco-local.spec.ts` -> `L14-T1..L14-T4`
- `tests/lot15/eddy-legacy-adapter.spec.ts` -> `L15-T1..L15-T4`
- `tests/lot16/player-timeline-playback.spec.ts` -> `L16-T1..L16-T2`

## Verification reconstruction

Commandes minimales:

- `npm run test:lot -- lot1`
- `npm run test:lot -- lot2`
- `npm run test:lot -- lot3`
- `npm run test:lot -- lot4`
- `npm run test:lot -- lot5`
- `npm run test:lot -- lot6`
- `npm run test:lot -- lot7`
- `npm run test:lot -- lot8`
- `npm run test:lot -- lot9`
- `npm run test:lot -- lot10`
- `npm run test:lot -- lot11`
- `npm run test:lot -- lot12`
- `npm run test:lot -- lot13`
- `npm run test:lot -- lot14`
- `npm run test:lot -- lot15`
- `npm run test:lot -- lot16`
- `npm test`
- `npm run build`

Validation manuelle DOM (demo active):

- `npm run dev:demo`

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
