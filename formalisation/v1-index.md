# Final V1 - index de reference

## Statut

Document final de navigation V1.

- point d'entree de lecture
- non redondant avec les specs detaillees
- en cas de divergence, les specs normatives detaillees priment

## Objectif

Donner une vue stable des documents finals et de l'ordre de lecture recommande.

## Ordre de lecture final

1. `101-final-v1-glossaire.md`
2. `102-final-v1-invariants-transverses.md`
3. `103-final-v1-validation-minimale.md`
4. `31-perso-spec-v1.md`
5. `32-strap-spec-v1.md`
6. `33-story-spec-v1.md`
7. `35-scene-spec-v1.md`
8. `36-event-spec-v1.md`
9. `37-strap-helpers-spec-v1.md`
10. `38-runtime-policy-events-v1.md`
11. `34-builder-spec-v1.md`
12. `44-builder-api-v1.md`
13. `45-player-api-v1.md`
14. `46-preload-api-v1.md`
15. `47-scene-side-effects-api-v1.md`
16. `48-error-catalog-v1.md`
17. `49-track-manager-spec-v1.md`
18. `50-compiled-scene-schema-v1.md`

## Frontiere normative

- les documents `100+` cadrent et synthetisent
- les contrats de type et details d'API restent portes par `31-38` et `43-50`
- les documents de transition (`10-30`, `plan-consolide.md`, `session-context-*`) restent non normatifs

## Gel de terminologie V1

- terme cible: `event runtime`
- terme historique tolere en lecture: `event public`
- interpretation imposee: `event public` == `event runtime`
