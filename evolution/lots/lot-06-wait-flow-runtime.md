# Lot 06 - wait flow runtime (`startWait` / `resolveWait`)

## Objectif

Implementer un runtime de wait flow testable qui couvre les deux modes V1:

- `parallel` (story source continue)
- `suspendSource` (story source gelee puis reprise)

## Fonctions noyau

- `createWaitFlowRuntime(options?)`
  - service in-memory des waits actifs
  - generation `waitId` deterministe (`wait-1`, `wait-2`, ...)
- `startWait(startOptions)`
  - valide les preconditions
  - cree un `WaitHandle`
  - retourne les operations runtime a executer
- `resolveWait(resolveOptions)`
  - ferme un wait actif
  - restaure tracks si demande
  - reprend la source selon `resumePolicy`

## Contrat runtime

- mode par defaut: `parallel`
- `suspendSource` exige `fromStory`
- `disableTracks='auto'`:
  - `parallel` => aucune track desactivee
  - `suspendSource` => utilise `fromStoryTrackIds`
- `resumePolicy='fromCursor'` (defaut) reprend sur `frozenCursorMs`
- `resumePolicy='fromStart'` reprend a `0`
- API retourne des `operations` explicites (story/track) + traces `scenario:wait:*`

## Scenarios de test (DoD)

- `L6-T1` `startWait` parallel n'interrompt pas la source
- `L6-T2` `startWait` suspendSource gele le curseur et desactive les tracks source
- `L6-T3` `resolveWait` restaure tracks et reprend depuis curseur gele
- `L6-T4` `resolveWait` avec `fromStart` reprend a `0`
- `L6-T5` rejection: suspendSource sans `fromStory`
- `L6-T6` rejection: `resolveWait` avec `waitId` inconnu

## Critere de passage

- 6 tests verts (`tests/lot6`)
- aucun impact regressif sur lots 1 a 5
