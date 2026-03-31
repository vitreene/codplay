# Table de transitions V1

## 1) Regles generales

- chaque event est valide contre son payload (catalogue `09`)
- payload invalide => `status=REJECTED`, `reason=INVALID_EVENT_PAYLOAD`
- event non autorise depuis l'etat courant => `status=REJECTED`, `reason=INVALID_STATE`
- les labels d'event utilisent les noms canoniques de `evolution/09-catalogue-events-techniques-v1.md`
- les `reason` utilisent le registre `evolution/15-registre-erreurs-v1.md`

## 2) Reasons de rejet (registre minimal)

- `INVALID_STATE`
- `INVALID_EVENT_PAYLOAD`
- `MODE_NOT_ALLOWED_BY_POLICY`
- `WAIT_HANDLE_NOT_FOUND`
- `WAIT_ALREADY_ACTIVE_FOR_STORY`
- `WAIT_STORY_INVALID_CLOCK_MODE`
- `PLAYABLE_ALREADY_ENDED`

## 3) PlayerMachine

Etats: `idle`, `preloading`, `ready`, `playing`, `paused`, `seeking`, `rewinding`, `error`

## 3.1 `idle`

- `player:init` -> `preloading`
- `player:destroy` -> `idle` (idempotent)
- autres events `player:*` -> `REJECTED(INVALID_STATE)`

## 3.2 `preloading`

- `player:preload:ok` -> `ready`
- `player:preload:failed` -> `error`
- `player:destroy` -> `idle`
- `player:play|player:pause|player:seek|player:rewind|player:stop|player:rebuild` -> `REJECTED(INVALID_STATE)`

## 3.3 `ready`

- `player:play` -> `playing`
- `player:pause` -> `ready` (idempotent)
- `player:stop` -> `ready` (idempotent)
- `player:seek` -> `seeking`
- `player:rewind` -> `rewinding`
- `player:rebuild`:
  - `mode=state` -> `ready`
  - `mode=full` -> `preloading`
  - mode interdit -> `REJECTED(MODE_NOT_ALLOWED_BY_POLICY)`
- `player:set-rate` -> `ready`

## 3.4 `playing`

- `player:pause` -> `paused`
- `player:stop` -> `ready`
- `player:seek` -> `seeking`
- `player:rewind` -> `rewinding`
- `player:rebuild`:
  - `mode=state` -> `ready`
  - `mode=full` -> `preloading`
  - mode interdit -> `REJECTED(MODE_NOT_ALLOWED_BY_POLICY)`
- `player:set-rate` -> `playing`

## 3.5 `paused`

- `player:play` -> `playing`
- `player:stop` -> `ready`
- `player:seek` -> `seeking`
- `player:rewind` -> `rewinding`
- `player:rebuild`:
  - `mode=state` -> `ready`
  - `mode=full` -> `preloading`
  - mode interdit -> `REJECTED(MODE_NOT_ALLOWED_BY_POLICY)`
- `player:set-rate` -> `paused`

## 3.6 `seeking`

- `player:seek:done` -> etat de retour capture (`playing|paused|ready`)
- `player:seek:failed` -> `error`
- autre -> `REJECTED(INVALID_STATE)`

## 3.7 `rewinding`

- `player:rewind:done` -> `ready`
- `player:rewind:failed` -> `error`
- autre -> `REJECTED(INVALID_STATE)`

## 3.8 `error`

- `player:init` -> `preloading`
- `player:destroy` -> `idle`
- autre -> `REJECTED(INVALID_STATE)`

## 4) ScenarioMachine (gate d'attente)

Etats: `idle`, `running`, `waiting`, `error`

## 4.1 `idle`

- `player:init` -> `running`

## 4.2 `running`

- `scenario:transition:selected` -> `running`
- `scenario:transition:none` -> `running`
- `scenario:wait:start` -> `waiting`
- `scenario:wait:resolve` -> `REJECTED(WAIT_HANDLE_NOT_FOUND)`

## 4.3 `waiting`

- `scenario:wait:resolve` -> `running`
- `scenario:wait:start` -> `REJECTED(WAIT_ALREADY_ACTIVE_FOR_STORY)`
- `scenario:wait:failed` -> `running` (gate nettoye)

## 4.4 `error`

- `player:init` -> `running`

Regles wait:

- `mode=parallel`: story source continue a jouer
- `mode=suspendSource`: story source pausee + reprise au curseur selon policy

## 5) StoryMachine

Etats: `idle`, `ready`, `playing`, `paused`, `ended`, `error`

## 5.1 `idle`

- `scenario:show-story` -> `ready`
- `scenario:start-story` -> `playing`
- autres -> `REJECTED(INVALID_STATE)`

## 5.2 `ready`

- `scenario:start-story` -> `playing`
- `scenario:hide-story` -> `ready`
- `scenario:stop-story` -> `ended`

## 5.3 `playing`

- `story:paused` -> `paused`
- `story:ended` -> `ended`
- `scenario:stop-story` -> `ended`
- `scenario:hide-story` -> `playing` (etat logique inchange)

## 5.4 `paused`

- `story:resumed` -> `playing`
- `scenario:stop-story` -> `ended`

## 5.5 `ended`

- `scenario:start-story` -> `playing`
- `player:rewind` -> `ready`

## 5.6 `error`

- `scenario:start-story` -> `playing` (si recovery autorisee)
- `scenario:stop-story` -> `ended`

## 6) PlayableMachine

Etats: `idle`, `playing`, `paused`, `ended`, `error`

## 6.1 `idle`

- `media:play` -> `playing`
- `media:pause` -> `idle`
- `media:seek` -> `idle`
- `media:rewind` -> `idle`

## 6.2 `playing`

- `media:pause` -> `paused`
- `media:seek` -> `playing` (ou `paused` si player global non-playing)
- `media:ended` -> `ended`
- `media:rewind` -> `idle`

## 6.3 `paused`

- `media:play` -> `playing`
- `media:seek` -> `paused`
- `media:rewind` -> `idle`

## 6.4 `ended`

- `media:play` -> `REJECTED(PLAYABLE_ALREADY_ENDED)`
- `media:seek` -> `ended`
- `media:rewind` -> `idle`

## 6.5 `error`

- `media:rewind` -> `idle`
- autre -> `REJECTED(INVALID_STATE)`

## 7) Contraintes de coherence inter-machines

- commande globale `player:pause` force l'intent media vers `paused`
- commande globale `player:play` n'outrepasse pas un media deja `ended`
- `scenario:wait:start` n'implique pas de pause globale du player
- `scenario:wait:resolve` ne doit pas recreer de node en `rebuild=state`
