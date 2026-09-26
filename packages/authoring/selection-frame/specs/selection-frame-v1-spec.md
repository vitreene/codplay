# Selection-frame — entrée AuthorApi V1

## Périmètre vérifié

Cette spécification décrit les comportements couverts par les tests du package
pour les entrées racine `createSelectionFrame()` et
`createMultiSelectionFrame()`, leurs adaptateurs et `createFlexAnchorTool()`.
Ces entrées utilisent `AuthorApi` V1, qui s’appuie sur `codplay-v1`.

Le mode création et l’éditeur de zones ont chacun leur
[spécification dédiée](./creation-mode-spec.md) et
[spécification dédiée](./zone-editor-spec.md). L’entrée `@codplay/selection-frame/v2`
est distincte et n’est pas couverte ici. Le contrat d’`AuthorApi` est défini par
la [spec AuthorApi V1](../../../../docs/formalisation/v1-author-api-spec.md).

## Cadre sur un item

`createSelectionFrame()` associe un cadre d’overlay à un `itemId` observé via
`AuthorApi.subscribeToNode()`. Le cadre reste masqué sans nœud connecté, devient
visible quand le nœud apparaît et se masque lorsqu’il disparaît. Il se réaffiche
au retour du nœud. Une notification reçue avant la connexion du nœud ne rend
pas le cadre visible ; une notification ultérieure pour ce même nœud connecté
active l’attache.

Le handle permet de masquer ou réafficher le cadre sans perdre l’item attaché,
de masquer ou réafficher l’élément suivi, et de désactiver ou réactiver les
interactions du cadre. `destroy()` retire le cadre et désabonne le suivi.

Un preset limite les capacités utilisables. Les poignées de redimensionnement
disparaissent quand ni `resize` ni `scale` ne sont actifs. La configuration des
poignées peut fixer leur mode ou interdire la bascule ; un Alt-clic bascule
entre redimensionnement et échelle lorsque la configuration l’autorise.

Le callback facultatif `onAltClickCycle` reçoit les identifiants des éléments
renvoyés par le hit-test, dans leur ordre, ainsi qu’un booléen indiquant si Maj
était maintenue. Les éléments du layer d’overlay ne sont pas proposés comme
candidats. L’éditeur reste propriétaire de la décision de sélection.

## Fin d’un geste

Pour un déplacement, `CsValueAdapter.onCommit('move')` est appelé une fois au
relâchement, après les previews ; il n’est pas appelé lorsque `pointercancel`
interrompt le geste. Si le suivi partagé perd le nœud pendant un déplacement,
la session est interrompue et les mouvements ultérieurs ne sont plus transmis
à l’adaptateur.

## Sélection multiple

`createMultiSelectionFrame()` affiche un cadre partagé dès qu’au moins un des
items suivis est connecté. La disparition partielle réduit l’ensemble aux items
encore connectés ; le cadre se masque quand aucun ne reste. Un déplacement
diffuse le même delta à chaque adaptateur des items présents. Les méthodes
`applyPreset()` et `setAdapter()` sont sans effet sur ce handle, qui reçoit un
adaptateur par item.

## Adaptateurs vérifiés séparément

Les tests d’adaptateur établissent les comportements suivants sans certifier
un parcours complet avec player et navigateur :

- `LibreAdapter` transmet déplacement, taille, rotation et échelle par
  `AuthorApi` ; son mode `top-left` modifie `left` et `top`. Un pivot fourni à
  la rotation met à jour `transform-origin` en conservant la pose visuelle.
- `FlexAdapter` traduit ses onze cibles d’alignement en `align-self` et
  `justify-self`. Les cibles d’étirement ne modifient que leur axe ; les deltas
  bruts de déplacement et de taille n’ont pas d’effet.
- `createFlexAnchorTool()` présente ces onze cibles quand le conteneur est
  connecté et transmet la cible choisie à l’adaptateur.
- `GridPlacementAdapter` accumule les deltas sous-piste, choisit les pistes
  voisines à partir de la géométrie fournie, tient compte des gaps et limite
  placements et emprises aux bornes de grille. `applyCellDrop()` accepte une
  cellule cible et `applyCellArea()` une emprise atomique.
- `overlay-pose.ts` compose les transformations individuelles et les matrices
  parentes ; `grid-geometry.ts` couvre les pistes en pixels, les gaps, les
  pistes irrégulières et le calcul uniforme de repli.

Ces preuves portent sur les circuits testés séparément. Elles ne certifient pas
que le drag du cadre affiche puis applique un drop de grille à travers
l’intégration de l’éditeur hôte.

## Preuves

- [`selection-frame.spec.ts`](../tests/selection-frame.spec.ts) couvre le suivi
  d’un item, les contrôles de visibilité et d’activité, les presets, le cycle
  Alt-clic, `onCommit`, l’interruption à la disparition du nœud et le
  déplacement partagé.
- [`machine.spec.ts`](../tests/machine.spec.ts) couvre les gardes de capacité,
  d’activité et de visibilité.
- [`adapters.spec.ts`](../tests/adapters.spec.ts) couvre les adaptateurs libre,
  flex et grille.
- [`flex-anchor-tool.spec.ts`](../tests/flex-anchor-tool.spec.ts),
  [`overlay-pose.spec.ts`](../tests/overlay-pose.spec.ts),
  [`grid-geometry.spec.ts`](../tests/grid-geometry.spec.ts) et
  [`tracked-session.spec.ts`](../tests/tracked-session.spec.ts) couvrent les
  outils et primitives mentionnés ci-dessus.

## Limites de cette spécification

Les tests du package ne prouvent pas un parcours navigateur de l’entrée racine
avec un vrai player V1. Ils ne valident pas non plus ensemble le geste simple
de resize/rotation/échelle, la projection visuelle d’un item transformé ou le
drop du cadre vers une zone de l’éditeur. Le statut de support de cette entrée
et son chemin d’acceptation restent suivis au
[plan V1](../plan/selection-frame-v1-plan.md).
