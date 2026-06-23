# Final V1 - index de reference

## Statut

Document final de navigation V1.

- point d'entree de lecture
- non redondant avec les specs detaillees
- en cas de divergence, les specs normatives detaillees priment

## Objectif

Donner une vue stable des documents finals et de l'ordre de lecture recommande.

## Ordre de lecture final

1. `v1-glossaire.md`
2. `v1-invariants.md`
3. `v1-validation.md`
4. `v1-perso-spec.md`
5. `v1-layout-spec.md`
6. `v1-list-spec.md`
7. `v1-component-api.md` — contrat composant, props d'element interne (`img`, `video`), base class `:where()`, deprecation fitMode
7a. `v1-tween-action-spec.md` — action animée par fonction (`TweenAction`, `TweenSequence`), seek-compatible, easings anime.js
8. `v1-strap-spec.md`
9. `v1-story-spec.md`
10. `v1-scene-spec.md`
11. `v1-event-spec.md`
12. `v1-strap-helpers-spec.md`
13. `v1-runtime-policy-spec.md`
14. `v1-builder-spec.md`
15. `v1-builder-api.md`
16. `v1-player-api.md`
16a. `v1-rate-spec.md` — multiplicateur de vitesse, propagation setRate, hook AnimationAdapter
17. `v1-registry-api.md`
18. `v1-module-api.md`
19. `v1-preload-api.md` — modes author/broadcast, strategies par type, cache session, eviction sequence:end
19a. `v1-third-party-runtime-spec.md` — regles integration bibliotheques tierces (Rive, Three.js, Lottie...) : preload adapter, factory pattern, RenderAdapter hub, rate/ticker, services internes
19b. `v1-render-adapter-spec.md` — contrat RenderAdapter canonique : tick, prepareSeek, seek, pause, resume, rateChange, stop
20. `v1-scene-side-effects-api.md`
21. `v1-horizon-spec.md`
22. `v1-seek-spec.md`
23. `v1-error-catalog.md`
24. `v1-track-manager-spec.md`
25. `v1-compiled-scene-schema.md`

## Documents actifs de chantier

- `v1-construction-strategy-slices-scenes.md`
- `v1-move-separation-policy-state-backend-dom.md`
- `2026-05-27-runtime-module-implementation-plan.md`

## Frontiere normative

- les documents finals courants `v1-*.md` dans ce dossier sont normatifs
- les contrats de type et details d'API sont portes par ces fichiers finals courants
- les documents de transition et d'archive hors de ce dossier restent non normatifs

## Gel de terminologie V1

- terme cible: `event runtime`
- terme historique tolere en lecture: `event public`
- interpretation imposee: `event public` == `event runtime`
