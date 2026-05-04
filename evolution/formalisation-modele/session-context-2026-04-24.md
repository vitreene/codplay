# Session context - 2026-04-24

## Statut

Phase 1 du chantier API `story` / `tracks` / `eventimes` demarree et cadree.

Livrable principal produit:

- `30-api-frontiere-public-interne-v1.md`

## Ce qui est termine dans cette session

- frontiere explicite API publique host vs API runtime interne fixee
- table unique des commandes publiques consolidee (lifecycle + story + tracks + eventimes + timeline + observabilite)
- table unique des responsabilites `Player` / `Director` / `Renderer` figee
- invariants transverses non negociables listes (determinisme, journal, policies, erreurs, adressage)

## Decisions de cadrage retenues

1. Surface publique

- la facade `Player` reste le seul point d entree host
- `emit(event)` reste disponible, mais les commandes nommees du domaine sont la voie cible

2. Frontiere runtime

- `Director` reste source de verite event/time et journal canonique
- `Renderer` reste strictement applicatif (commits + rendu), sans logique metier story

3. Stabilite interne

- les API internes `Director` / `Renderer` ne font pas partie du contrat host
- evolution interne autorisee si contrat public + invariants sont respectes

## Prochaine etape recommandee

Passer en Phase 2:

- figer le contrat `story.*` (`load`, `activate`, `reset`, `replay`, `snapshot`)
- definir schema TS canonique `Story`
- formaliser la normalisation des erreurs `AUTHOR_*` et `RUNTIME_*`
