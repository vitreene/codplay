# CodPlay V2 - corpus de scenes demo pour les tests

## Statut

Decision active pour la tranche `CompiledScene`, CodPlay V2 foundation.

## Role

Les scenes S1 a S4 des demos V1 fournissent les formes representatives du premier
corpus de tests V2 :

- S1 : scene minimale et placement racine;
- S2 : hierarchie parent/enfant, services communs et eventime;
- S3 : deplacements entre parents et `flipMode`;
- S4 : stories multiples, layout, media, ressource et animation.

Les fixtures V2 sont recopiees sous `packages/codplay/tests/fixtures/` afin de ne
pas introduire de dependance runtime vers V1 ou vers le package demos. Elles servent
actuellement a verifier la normalisation, les guards et le premier build. Elles ne
constituent pas encore une comparaison d'execution player V1/V2.

### Mise à jour du 2026-09-08 — migration `move`

La mention `flipMode` de S3 décrit la provenance V1 du corpus. Dans la forme
V2 cible, cette propriété devient `reparent`; `mode`, `reorder` et les champs de
`transition` restent inchangés. Le corpus reste une fixture de test et ne crée
aucun contrat runtime supplémentaire.

## Invariants de test

- Toute nouvelle forme ajoutee aux demos doit etre classee avant d'entrer dans une
  fixture V2.
- Une fixture doit porter un invariant observable, pas seulement augmenter la
  couverture de lignes.
- La parite player et les traces temporelles seront ajoutees lorsque le player V2
  sera ouvert.
