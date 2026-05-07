# Plan d'ecartement des documents preparatoires

## Objectif

Reduire le bruit documentaire sans perdre l'historique utile pour les lots a venir.

## Regles

- ne supprimer aucun document transitoire tant que son lot n'est pas cloture
- deplacer les documents ecartes vers un dossier d'archives dedie
- conserver un index minimal des archives

## Phases proposees

### Phase A - Immediate (safe)

- garder tous les contenus en place
- utiliser `formalisation/v1-index.md` comme point unique de reference
- utiliser `formalisation/transitoire-index.md` comme filtre de lecture

### Phase B - Apres stabilisation lot runtime

Precondition:

- APIs et contrats runtime V1 verifies en implementation

Documents candidats archivage:

- `plan-consolide.md`
- `10-api-host-v1.md`
- `11-runtime-context-mapping-v1.md`
- `12-runtime-migration-plan-v1.md`
- `13-sequence-user-view-progress-v1.md`
- `24-runtime-log-policy-v1.md`
- `25-flip-runtime-core-v1.md`
- `26-player-orchestration-v1.md`
- `30-api-frontiere-public-interne-v1.md`

### Phase C - Apres stabilisation lot composants/usage

Precondition:

- composants cibles branches sur le corpus V1 normatif

Documents candidats archivage:

- `14-component-system-v1-draft.md`
- `15-list-component-v1-checklist.md`
- `16-base-component-v1.md`
- `17-user-events-emit-v1.md`
- `18-socle-v1-grandes-lignes.md`
- `19-text-component-v1.md`
- `20-text-advanced-pre-spec.md`
- `21-text-micro-animations-v1.md`
- `22-image-component-v1.md`
- `23-list-component-v1.md`
- `27-flip-overlay-world-space-pre-spec.md`
- `28-flip-overlay-world-mode-v1.md`
- `29-flip-deux-variantes-principe-et-implementation.md`

### Phase D - Journaux

Precondition:

- decisions majeures reprises dans le corpus final 100+

Action:

- archiver tous les `session-context-*`

## Cible de structure archive

Proposition:

- `formalisation/archive/transition-runtime/`
- `formalisation/archive/transition-composants/`
- `formalisation/archive/session-context/`
- `formalisation/archive/meta-orientation/`

Ce deplacement est volontairement differe pour eviter toute casse de liens tant que les lots ne sont pas clos.
