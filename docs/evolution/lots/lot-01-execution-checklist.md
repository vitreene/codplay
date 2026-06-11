# Lot 01 - Checklist d'execution

## Objectif

Lancer le lot timer/ticker avec un chemin court et verifiable.

References:

- `evolution/lots/lot-01-timer-ticker.md`
- `evolution/lots/status.md`

## Etape 0 - Preparation minimale

- creer les dossiers cibles:
  - `src/core/time/`
  - `tests/lot1/`
- verifier la convention de nommage:
  - `clock.ts`
  - `ticker.ts`
  - `clock.spec.ts`
  - `ticker.spec.ts`

Livrable attendu:

- arborescence prete, aucun comportement implemente

## Etape 1 - Red tests (DoD lot 1)

Ecrire d'abord les 4 tests:

- `L1-T1` start/stop idempotent
- `L1-T2` monotonicite (`nowMs >= prevMs`)
- `L1-T3` `deltaMs = nowMs - prevMs`
- `L1-T4` payload tick `{ prevMs, nowMs, deltaMs, marginMs }`

Puis ajouter un test de robustesse:

- `L1-T5` pause/reprise sur visibilite document

Livrable attendu:

- tests en place
- echec initial attendu (red)

## Etape 2 - Implementation noyau clock

Implementer `createClock(nowProvider?)`:

- `nowMs()`
- `reset(baseMs?)`

Regles:

- `nowProvider` injecte pour tests deterministes
- aucun couplage DOM/animejs

Livrable attendu:

- tests `clock` verts

## Etape 3 - Implementation noyau ticker

Implementer `createTicker(options)`:

- `start(onTick)`
- `stop()`
- `isRunning()`

Regles:

- `start` idempotent
- `stop` idempotent
- calcule `prevMs`, `nowMs`, `deltaMs`
- reinjecte `marginMs` dans le payload de tick

Livrable attendu:

- tests `ticker` verts

## Etape 4 - Verification lot

Verification finale lot 1:

- 4 tests verts
- pas de dependance animation/media
- pas de side effects globaux hors ticker

Verification hardening (optionnelle mais recommandee):

- `L1-T5` vert

Si OK:

- passer `Lot 01` en `DONE` dans `evolution/lots/status.md`
- autoriser demarrage `Lot 02`

## Commandes conseillees

Les scripts de test ne sont pas encore branches dans le projet.
Quand ils le seront, executer au minimum:

- tests lot 1 seulement
- puis run complet tests

Exemples de cibles de commande (a ajuster selon runner):

- `npm run test -- tests/lot1`
- `npm run test`
