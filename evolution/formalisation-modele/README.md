# Formalisation du modele

Ce dossier formalise le modele cible oriente events pour le nouveau player.

## Reference V1 active

La source principale est:

- `plan-consolide.md`

Specs V1 alignees sur ce plan:

- `02-story-model.md`
- `03-event-model.md`
- `04-eventime-model.md`
- `06-runtime-contract.md`
- `10-api-host-v1.md`
- `11-runtime-context-mapping-v1.md`
- `12-runtime-migration-plan-v1.md` (objectif 2: plan de migration code)
- `13-sequence-user-view-progress-v1.md` (progression percue sequence)
- `16-base-component-v1.md` (contrat composant generique)
- `17-user-events-emit-v1.md` (interactions utilisateur -> events publics)
- `19-text-component-v1.md` (spec composant text)
- `22-image-component-v1.md` (spec composant image)
- `23-list-component-v1.md` (spec composant list)
- `24-runtime-log-policy-v1.md` (spec-cadre logs/traces runtime)
- `25-flip-runtime-core-v1.md` (spec runtime FLIP, calcul unique)
- `26-player-orchestration-v1.md` (orchestration Player, routing move)
- `28-flip-overlay-world-mode-v1.md` (variant FLIP optionnelle, mode auteur overlay-world)
- `29-flip-deux-variantes-principe-et-implementation.md` (note technique implementation locale + overlay-world)

Pre-specs / cadrage evolutif:

- `20-text-advanced-pre-spec.md` (evolution texte enrichi, micro-animations, transitions)
- `21-text-micro-animations-v1.md` (contrat micro-animations texte)
- `27-flip-overlay-world-space-pre-spec.md` (options FLIP overlay/world-space pour overlap list)

## Notes de contexte / transition

- `00-bilan-orientation.md`
- `00-perimetre-builder.md`
- `14-component-system-v1-draft.md` (draft systeme composants)
- `15-list-component-v1-checklist.md` (checklist deploiement composant List)
- `18-socle-v1-grandes-lignes.md` (note de transition, consolidee dans le plan)
- `session-context-2026-04-16.md` (journal de decisions recentes)
- `session-context-2026-04-19.md` (cloture cycle FLIP + statut plan A-E)
- `session-context-2026-04-10.md` (plan de reprise de session)

## Nettoyage documentaire

Les notes historiques pre-consolidation ont ete retirees du dossier pour eviter toute ambiguite sur la reference V1 active.

Regle de lecture:

- les `session-context-*` restent non normatifs
- en cas de divergence, la reference est la section "Reference V1 active"
