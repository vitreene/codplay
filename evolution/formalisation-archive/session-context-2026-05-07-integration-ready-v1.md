# Session context - 2026-05-07 - integration ready V1 (updated)

## Etat de session

Session terminee avec plan final d'integration V1 valide, puis enrichie avec les specs master/eventimes portables.

## Decisions confirmees

- ne pas reecrire le noyau, adapter l'existant
- proteger strictement la demo FLIP/list POC
- conserver le layout demos: `aside` controles/logs + `main` player
- executer l'integration par phases/slices avec gates obligatoires
- `master` est une propriete du `Perso` (`initial.master`), pas un objet `masterMedia`
- un seul master actif a la fois; le dernier active est prioritaire
- policy retenue pour le master precedent: `previousMasterAction` (`pause` par defaut, `stop` possible)
- les eventimes portables sont portes par la `Story` (`eventimes`, `startAt`, `events`)
- `Scene.tracks` orchestre l'ancrage/activation, sans devenir la source metier des eventimes

## Documents finalises pendant la session

- plan final pret a execution: `formalisation/v1-construction-strategy-slices-scenes.md`
- formalisation V1 restructuree et archivee selon plan precedent
- specs V1 mises a jour pour master/eventimes:
  - `formalisation/v1-perso-spec.md`
  - `formalisation/v1-story-spec.md`
  - `formalisation/v1-scene-spec.md`
  - `formalisation/v1-track-manager-spec.md`
  - `formalisation/v1-runtime-policy-spec.md`
  - `formalisation/v1-player-api.md`
  - `formalisation/v1-event-spec.md`
  - `formalisation/v1-preload-api.md`
  - `formalisation/v1-builder-spec.md`
  - `formalisation/v1-compiled-scene-schema.md`
  - `formalisation/v1-invariants.md`

## Couverture specs

Le plan final couvre l'integration de tous les documents V1:

- index/glossaire/invariants/validation
- specs scene/story/event/strap/runtime policy
- APIs builder/player/preload/scene side effects
- schema compiled scene, error catalog, track manager, perso spec
- ajout couvre aussi:
  - master clock runtime avec fallback ticker
  - separation horloge de synchro vs etat media
  - eventimes story-level portables et ancrage runtime/build

## Gates obligatoires de non regression

Pour chaque phase impactant player/director/renderer/runtime/demos:

1. `npm run test:lot7`
2. `npm run test:lot8`
3. `npm run test:lot18`
4. validation visuelle de la demo POC via `npm run dev:demo`

## Point d'arret exact

Arret sur "plan final fige + specs master/eventimes integrees"; integration non commencee.

## Reprise recommandee (ordre strict)

1. relire rapidement les deltas master/eventimes dans `formalisation/v1-perso-spec.md`, `formalisation/v1-story-spec.md`, `formalisation/v1-track-manager-spec.md`, `formalisation/v1-runtime-policy-spec.md`
2. executer Phase 0 du plan (`formalisation/v1-construction-strategy-slices-scenes.md`)
3. ajouter script `test:lot18` dans `package.json`
4. creer `src/demos/scenes/` avec S1/S2/S3
5. creer tests `tests/v1/*` de bootstrap
6. lancer les gates et valider avant passage Phase 1

## Critere de reprise

La reprise doit partir du document:

- `formalisation/v1-construction-strategy-slices-scenes.md`

et verifier en preambule les specs mises a jour:

- `formalisation/v1-perso-spec.md`
- `formalisation/v1-story-spec.md`
- `formalisation/v1-track-manager-spec.md`
- `formalisation/v1-runtime-policy-spec.md`

Ce document est la source unique de pilotage pour l'integration V1.
