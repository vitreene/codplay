# Lot 01 - Timer / ticker

## Objectif

Fournir une base de temps fiable, monotone, testable, sans dependance DOM/animejs.

## Fonctions noyau

- `createClock(nowProvider?)`
  - `nowMs()`
  - `reset(baseMs?)`
- `createTicker(options)`
  - `start(onTick)`
  - `stop()`
  - `isRunning()`

Tick payload minimal:

```ts
{ prevMs: number, nowMs: number, deltaMs: number, marginMs: number }
```

## Scenarios de test (DoD)

- `L1-T1` start/stop idempotent
- `L1-T2` monotonicite (`nowMs >= prevMs`)
- `L1-T3` `deltaMs = nowMs - prevMs`
- `L1-T4` callback recoit le payload minimal

Hardening recommande:

- `L1-T5` pause/reprise sur visibilite document (`pauseOnDocumentHidden`)

## Critere de passage

- 4 tests verts
- aucun couplage avec DOM/animejs
