# CodPlay V2 — composant image `img`

> Version de référence : CodPlay V2 — 2026-11-10.

## Périmètre vérifié

Cette spécification décrit le cycle vérifié des nœuds image persistants et le
retrait de `fitMode`. Les transitions sont décrites séparément par la
[spécification replace-media](./replace-media-v2-spec.md).

## Nœuds par source

Le composant matérialise un wrapper HTML et une image native pour chaque source
rencontrée. Lors d'un passage de `/image-a.png` à `/image-b.png`, le nœud
affiché change ; un retour à `/image-a.png` réutilise le premier nœud et sa
source. Le test couvre l'identité des nœuds et leur état visible après ces
changements.

La déclaration exercée permet `src`, `alt` et des services `className` et
`style` imbriqués sous `img`. Le test vérifie le nom de classe de l'image
interne. Les comportements de transition `replace` pour une image relèvent de
la spécification replace-media.

## `fitMode` retiré

Le validateur d'initialisation signale `AUTHOR_IMAGE_FIT_MODE_REMOVED` si
`fitMode` est fourni. La valeur n'est pas un champ d'initialisation accepté.

## Preuve

[`image-input-polygon.spec.ts`](../tests/runtime/components/image-input-polygon.spec.ts)
vérifie A → B → A, l'identité du premier nœud après son retour et le diagnostic
sur `fitMode`.
