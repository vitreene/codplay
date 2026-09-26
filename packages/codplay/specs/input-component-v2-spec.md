# CodPlay V2 — composant de saisie `input`

## Périmètre vérifié

Cette spécification couvre la structure matérialisée de `InputComponent`, ses
deux cibles d'icône publiées et la conservation de champs d'action propres au
composant par le résolveur. La projection scalaire non journalisée vers un
contrôle monté relève de la [spécification de projection input](./input-projection-spec.md).
Les validations métier encore ouvertes restent au
[plan image/input/polygon](../plan/components-image-input-polygon-svg-plan.md).

## Markup et parts

Le template testé a une racine native `label` qui contient un `input` et cinq
parts logiques : le contrôle, le label, l'icône de sélection, l'icône de
correction et l'indication (`hint`). Le materializer consomme les attributs
`data-part` et ne les laisse pas dans le DOM matérialisé.

Seuls les deux slots d'icônes sont publiés à la capacité `markup`. Leurs
identifiants testés sont dérivés de la story et du perso :

```text
<storyId>:<persoId>__selection-icon-slot
<storyId>:<persoId>__correction-icon-slot
```

Les parts `control` et `label` ne sont pas résolubles comme cibles publiques.
La destruction de la materialisation retire les deux cibles publiées.

## État logique

Le test builder/résolveur fournit une action qui remplace `inputType` et met à jour
`selectedAnswerIds` et `selectionIcon`. Ces champs spécifiques sont conservés
dans l'état résolu par le circuit d'action V2.

Cette preuve ne certifie pas à elle seule la totalité du comportement quiz V1,
notamment la sélection et la désactivation de réponses ou la révélation de la
correction. Ces validations sont suivies au plan.

## Preuves

- [`image-input-polygon.spec.ts`](../tests/runtime/components/image-input-polygon.spec.ts)
  vérifie la racine, le contrôle natif, les parts, les deux cibles publiées,
  leur retrait et la conservation de champs d'action spécifiques.
- [`input-projection.spec.ts`](../tests/facade/input-projection.spec.ts)
  vérifie séparément la projection scalaire publique vers un `input` déjà monté.

La suite ciblée image/input/polygon exécutée le 2026-09-25 passe : 2 fichiers,
6 tests réussis. La projection input a été testée séparément dans un contrôle
de 4 fichiers, 12 tests réussis.
