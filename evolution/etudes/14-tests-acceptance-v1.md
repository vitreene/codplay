# Tests d'acceptance V1 (DoD)

## 1) Objectif

Definir les criteres pass/fail pour valider V1 avant implementation.

References:

- events: `evolution/09-catalogue-events-techniques-v1.md`
- transitions: `evolution/10-table-transitions-v1.md`
- conflits: `evolution/11-resolution-conflits-tick-v1.md`
- usage: `evolution/usage/`

## 2) Suites prioritaires

## T-A1 Seek en pause

Given:

- player `paused`
- scene chargee

When:

- `player:seek` avec `targetTimelineMs=12000`, `rebuild=state`

Then (DoD):

- traces: `player:seek:started` -> `runtime:reset:started` -> `runtime:reset:done` -> `player:seek:done`
- etat final player = `paused`
- aucun autoplay force cote media

## T-A2 Switch master media

Given:

- track FR active (master)
- track EN inactive

When:

- disable FR + enable EN

Then (DoD):

- un seul master actif
- trace `media:sync:corrected` emise seulement si derive > seuil
- pas de double playback master

## T-A3 Wait flow parallel

Given:

- story principale `timeline` en `playing`

When:

- `scenario.startWait({ mode:'parallel' })`

Then (DoD):

- `scenario:wait:started` present
- story source continue
- events paralleles continuent

## T-A4 Wait flow suspendSource

Given:

- story source `timeline` en `playing`

When:

- `scenario.startWait({ mode:'suspendSource' })`
- puis `scenario.resolveWait({ resumePolicy:'fromCursor' })`

Then (DoD):

- pause source + disable tracks pendant wait
- reprise source sur curseur gele

## T-A5 Form submit backend via strap

Given:

- wait story active

When:

- strap lance `effect.run('form.submit')`

Then (DoD):

- succes => `scenario:wait:resolve` puis `scenario:goto-story`
- echec => pas de transition implicite + message erreur patch item

## T-A6 Conflits meme tick

Given:

- deux actions contradictoires au meme tick sur meme cible

When:

- execution runtime

Then (DoD):

- gagnant conforme aux regles de `11-resolution-conflits-tick-v1.md`
- trace du perdant avec reason d'override

## T-A7 Rebuild policy

Given:

- runtime policy restrictive (`state` seulement)

When:

- `player:rebuild mode=full`

Then (DoD):

- commande rejetee `MODE_NOT_ALLOWED_BY_POLICY`
- etat runtime stable

## T-A8 Node identity invariant

Given:

- refs node resolues via editor API

When:

- `rebuild=state`

Then (DoD):

- meme `nodeRef`
- `runtimeRevision` inchangee

When:

- `rebuild=full`

Then (DoD):

- refs invalidees
- `runtimeRevision` incrementee

## 3) Criteres de sortie V1

- toutes suites T-A1 a T-A8 vertes
- aucune transition non tracee sur chemins critiques
- aucun comportement non deterministe observe sur 3 runs consecutifs
