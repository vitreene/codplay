# Evolution - notes de travail

Ce dossier centralise la conception V1 et le plan d'implementation.

## Lecture rapide (ordre recommande)

- `08-checklist-verrouillage-v1.md`
- `02-specifications-engine-v1.md`
- `05-recommandations-api.md`
- `09-catalogue-events-techniques-v1.md`
- `10-table-transitions-v1.md`
- `14-tests-acceptance-v1.md`
- `17-guide-reconstruction-v1.md`

## Organisation par theme

### Cadrage

- `01-cahier-des-charges-engine.md`
- `04-glossaire.md`
- `99-handoff-new-project.md`

### Spec moteur

- `02-specifications-engine-v1.md`
- `03-pseudo-code-engine-v1.md`
- `06-machines-et-traces-v1.md`

### API / events / transitions

- `05-recommandations-api.md`
- `09-catalogue-events-techniques-v1.md`
- `10-table-transitions-v1.md`
- `11-resolution-conflits-tick-v1.md`
- `15-registre-erreurs-v1.md`

### Contrats specialises

- `12-contrat-plugin-list-v1.md`
- `13-contrat-trace-debug-v1.md`
- `07-compat-legacy-convertisseur-v1.md`

### Validation

- `14-tests-acceptance-v1.md`
- `17-guide-reconstruction-v1.md`
- `usage/`

### Plan implementation

- `16-plan-implementation-noyau-v1.md` (vue d'ensemble)
- `lots/` (un fichier par lot)

## Dossiers

- `lots/`: plan detaille par lot (phase 1 + backlog)
- `usage/`: scenarios narratifs/metier
- `scenario/`: proposition d'orchestration initiale
- `formalisation-modele/`: cadrage du modele Scene/Story/Strap/Eventimes

## Positionnement

- mode reflexion + planification incrementale
- implementation guidee par tests DoD par lot
- compat legacy via convertisseur externe (pas dans le runtime core)
