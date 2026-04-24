# Session context - 2026-04-20

## Statut

Session cloturee et preparee pour reprise ulterieure.

Ce qui est termine avant ce handoff:

- cycle FLIP cloture (mode local stable + mode `overlay-world` valide sur la demo)
- nettoyage logs debug overlay termine
- coupling ticker player <-> animejs engine active dans la demo (`engine.useDefaultMainLoop = false` + `engine.update()` pilote par ticker player)
- validation automatique OK (`npm test`, `npm run build`)

---

## Prochain chantier cible

Definition API pour:

- `story`
- `tracks`
- `eventimes` / timeline events

Approche retenue: contract-first, puis implementation, puis migration.

---

## Plan general en phases

## Phase 1 - Cadrage API public vs interne

Objectif:

- separer clairement API host publique et API runtime interne

Livrables:

- table unique des commandes publiques
- table unique des responsabilites (`Player`, `Director`, `Renderer`)
- liste des invariants transverses

## Phase 2 - Contrat Story API (lifecycle + operations)

Objectif:

- figer le contrat `story` independamment de l'implementation

Livrables:

- operations: `load`, `activate`, `reset`, `replay`, `snapshot`
- schema TS canonique de `Story`
- normalisation des erreurs (`AUTHOR_*`, `RUNTIME_*`)

## Phase 3 - Contrat Tracks/Eventimes API

Objectif:

- definir les commandes de manipulation des tracks et events timeline

Livrables:

- operations track: `set/create/update/activate/deactivate`
- operations eventime: `add/update/remove/normalize`
- regles de determinisme (`eventSeq`, tri stable, conflits)

## Phase 4 - Pipeline de compilation eventimes

Objectif:

- transformer un format auteur vers un format runtime canonique

Livrables:

- module compileur `author -> runtime tracks/events`
- normalisation IDs/index/source
- deduplication + tri stable

## Phase 5 - API de lecture temporelle

Objectif:

- exposer une lecture timeline stable pour playback/seek

Livrables:

- `getEventsAt(ms)`
- `getEventsBetween(startMs, endMs)`
- `getNextEventAfter(ms)`
- `resolveTimelineEndMs()`

## Phase 6 - Observabilite + validation

Objectif:

- rendre chaque decision runtime inspectable et testable

Livrables:

- spec de traces API (applied/rejected/ignored)
- tests acceptance API story/tracks/eventimes
- tests determinisme multi-runs

## Phase 7 - Migration + verrouillage

Objectif:

- preparer l'adoption sans casser les scenes existantes

Livrables:

- guide migration
- validateur de schema scene
- checklist de compatibilite finalisee

---

## Ordre d'execution recommande

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7

Rationale:

- contrats avant code
- lecture timeline apres compilation canonique
- migration seulement apres stabilisation des contrats

---

## Definition of Done globale (chantier API)

- contrats TS figes et documentes
- tests unit + integration API verts
- determinisme confirme en executions repetes
- `npm test` et `npm run build` verts
- demo de reference validee en `play`, `pause`, `seek`, `replay`

---

## Point d'entree pour reprise

Au redemarrage, commencer par Phase 1:

- produire un document de cadrage API unique
- valider la frontiere public/interne
- lister les invariants non negociables avant implementation
