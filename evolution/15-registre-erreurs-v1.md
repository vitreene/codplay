# Registre de codes d'erreur V1

## 1) Portee

Registre unique des codes utilises par l'API, les transitions et les traces.

References:

- transitions: `evolution/10-table-transitions-v1.md`
- events: `evolution/09-catalogue-events-techniques-v1.md`
- trace/debug: `evolution/13-contrat-trace-debug-v1.md`

## 2) Format des codes

- format recommande: `UPPER_SNAKE_CASE`
- un code conserve la meme semantique dans tous les modules

## 3) Codes API/runtime

- `INVALID_EVENT_PAYLOAD`
- `INVALID_STATE`
- `MODE_NOT_ALLOWED_BY_POLICY`
- `WAIT_HANDLE_NOT_FOUND`
- `WAIT_ALREADY_ACTIVE_FOR_STORY`
- `WAIT_STORY_INVALID_CLOCK_MODE`
- `PLAYABLE_ALREADY_ENDED`
- `EFFECT_TIMEOUT`
- `EFFECT_UNAVAILABLE`
- `EFFECT_REJECTED`
- `GLOBAL_COMMAND_PRECEDENCE`
- `STYLE_OVERRIDDEN_SAME_TICK`
- `MOVE_OVERRIDDEN_SAME_TICK`
- `MEDIA_COMMAND_OVERRIDDEN`
- `TRACK_STATE_OVERRIDDEN_SAME_TICK`
- `LIST_PERF_FALLBACK`

## 4) Codes validation scenario

- `SCENARIO_INITIAL_NODE_NOT_FOUND`
- `SCENARIO_NODE_ID_MISMATCH`
- `SCENARIO_TRANSITION_TARGET_NOT_FOUND`
- `SCENARIO_INVALID_WHEN_EVENT`

## 5) Codes convertisseur legacy

- `E_NO_PERSOS`
- `E_NO_EVENTTIMES`
- `E_ITEM_ID_MISSING`
- `E_EVENT_NAME_MISSING`

Warnings associes:

- `W_TYPE_UNKNOWN`
- `W_PARENT_SYNTHETIC_CREATED`
- `W_ID_CANONICAL_DIFFERENT_FROM_KEY`
- `W_DUPLICATE_EVENT_SAME_MS_NAME`

## 6) Regles d'usage

- tout `Result.ok=false` doit exposer un `error.code` de ce registre
- toute trace `REJECTED` doit mapper vers un code de ce registre
- ne pas reutiliser un code pour une semantique differente
