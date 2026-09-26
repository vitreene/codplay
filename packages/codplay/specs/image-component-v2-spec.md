# CodPlay V2 — composant image `img`

## Périmètre vérifié

Cette spécification décrit le cycle vérifié des nœuds image persistants et le
retrait de `fitMode`. Les autres critères d'acceptation de la tranche sont dans
le [plan image/input/polygon](../plan/components-image-input-polygon-svg-plan.md).

## Nœuds par source

Le composant matérialise un wrapper HTML et une image native pour chaque source
rencontrée. Lors d'un passage de `/image-a.png` à `/image-b.png`, le nœud
affiché change ; un retour à `/image-a.png` réutilise le premier nœud et sa
source. Le test couvre l'identité des nœuds et leur état visible après ces
changements.

La déclaration exercée permet `src`, `alt` et des services `className` et
`style` imbriqués sous `img`. Le test vérifie le nom de classe de l'image
interne. Cette spec ne fixe pas ici les comportements de transition `replace`
pour une image.

## `fitMode` retiré

Le validateur d'initialisation signale `AUTHOR_IMAGE_FIT_MODE_REMOVED` si
`fitMode` est fourni. La valeur n'est pas un champ d'initialisation accepté.

## Preuve

[`image-input-polygon.spec.ts`](../tests/runtime/components/image-input-polygon.spec.ts)
vérifie A → B → A, l'identité du premier nœud après son retour et le diagnostic
sur `fitMode`.

Validation ciblée exécutée le 2026-09-25 avec la suite image/input/polygon :
2 fichiers, 6 tests réussis. La tranche image n'a pas encore de validation
navigateur dédiée ; ses autres critères restent au plan.
