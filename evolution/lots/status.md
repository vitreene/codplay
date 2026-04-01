# Suivi lots - phase 1

## Etat courant

- Lot 01: `DONE` (tests L1-T1..L1-T5 verts)
- Lot 02: `DONE` (tests L2-T1..L2-T5 verts)
- Lot 03: `DONE` (tests L3-T1..L3-T5 verts)
- Lot 04: `DONE` (test L4-T1 vert)
- Lot 05: `DONE` (tests L5-T1..L5-T3 verts)
- Lot 06: `DONE` (tests L6-T1..L6-T6 verts)
- Lot 07: `DONE` (tests L7-T1..L7-T5 verts)
- Lot 08: `DONE` (tests L8-T1..L8-T10 verts + exemple DOM)

## Grille de progression

### Lot 01 - Timer / ticker

- Tests prevus: `L1-T1..L1-T4` (+ hardening `L1-T5`)
- Tests verts: `5/5`
- Demo manuelle: `optional`

### Lot 02 - Events pipeline

- Tests prevus: `L2-T1..L2-T5`
- Tests verts: `5/5`
- Determinisme 3 runs: `yes` (verified on repeated sort assertions)

### Lot 03 - Animation bridge

- Tests prevus: `L3-T1..L3-T5`
- Tests verts: `5/5`
- Adapter mock valide: `yes`

### Lot 04 - createElement minimal

- Tests prevus: `L4-T1`
- Tests verts: `1/1`
- Demo locale event->animation: `yes` (teste en integration)

### Lot 05 - animation properties extensibility

- Tests prevus: `L5-T1..L5-T3`
- Tests verts: `3/3`
- Pipeline agnostique proprietes/targets: `yes`

### Lot 06 - wait flow runtime

- Tests prevus: `L6-T1..L6-T6`
- Tests verts: `6/6`
- `suspendSource` freeze/reprise: `yes`

### Lot 07 - plugin list diff/FLIP/fallback

- Tests prevus: `L7-T1..L7-T5`
- Tests verts: `5/5`
- Fallback perf move-only: `yes`

### Lot 08 - moteur FLIP generique

- Tests prevus: `L8-T1..L8-T10`
- Tests verts: `10/10`
- Sequence anti-flicker read/write/rAF: `yes`
- Exemple DOM reel (`flip-example.html`): `yes`

## Regle de passage

- un lot passe `DONE` seulement si son critere de passage est atteint
- pas de demarrage du lot suivant tant que le lot precedent n'est pas `DONE`

## Snapshot reconstruction

- contrat de reconstruction: `evolution/17-guide-reconstruction-v1.md`
- commandes de reference: `npm test` puis `npm run build`
