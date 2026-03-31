# Suivi lots - phase 1

## Etat courant

- Lot 01: `DONE` (tests L1-T1..L1-T5 verts)
- Lot 02: `DONE` (tests L2-T1..L2-T5 verts)
- Lot 03: `READY_TO_START`
- Lot 04: `NOT_STARTED`

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

- Tests prevus: `L3-T1..L3-T4`
- Tests verts: `0/4`
- Adapter mock valide: `no`

### Lot 04 - createElement minimal

- Tests prevus: `L4-T1`
- Tests verts: `0/1`
- Demo locale event->animation: `no`

## Regle de passage

- un lot passe `DONE` seulement si son critere de passage est atteint
- pas de demarrage du lot suivant tant que le lot precedent n'est pas `DONE`
