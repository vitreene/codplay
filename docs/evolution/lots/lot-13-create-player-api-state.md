# Lot 13 - createPlayer API + state runtime

## Objectif

Introduire une API `createPlayer` exploitable avec un cycle de vie complet (`init/destroy`) et les commandes de pilotage principales (`play/pause/seek/rewind/rebuild`) sur un format d'entree `SceneDoc`.

## Fonctions noyau

- `createPlayer(options?)`
  - `init(scene)`
  - `destroy()`
  - `play()`
  - `pause()`
  - `seek(targetTimelineMs)`
  - `rewind()`
  - `rebuild(mode?)`
  - `getState()`
  - `onTrace(listener)`
  - `onStateChange(listener)`

## Contrat runtime

- format d'entree player: `SceneDoc`
- pas d'autoplay implicite: `init` termine en `ready`
- commandes asynchrones (`Promise`) pour preparer l'integration Telco
- rejections explicites et deterministes:
  - `PLAYER_NOT_INITIALIZED`
  - `INVALID_PLAYER_STATE`
  - `MODE_NOT_ALLOWED_BY_POLICY`
  - `SCENE_STORY_NOT_FOUND`
- trace player centralisee (`scope='player'`) sur les commandes appliquees/rejetees

## Scenarios de test (DoD)

- `L13-T1` `init/destroy` idempotents
- `L13-T2` transitions `play/pause/seek/rewind` deterministes
- `L13-T3` commandes invalides rejetees avec codes explicites
- `L13-T4` emissions `onTrace` et `onStateChange`

## Critere de passage

- 4 tests verts (`tests/lot13`)
- non-regression lots 1 a 12
