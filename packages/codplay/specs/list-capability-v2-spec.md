# CodPlay V2 — capacité de placement `list`

## Périmètre vérifié

Cette spécification décrit le composant core `list` et sa capacité player-scoped
de résolution d'ordre structurel. La preview HTML de drag-and-drop est dans la
[spécification DnD/list](./list-dnd-v2-spec.md). Les dimensions interpolées
restent au [plan d'acceptation de `move.resize`](../plan/list-dimension-interpolation-plan.md).

## Composant auteur

Le composant `list` possède une racine HTML et déclare les services de cette
racine. Il ne construit pas ni ne réordonne ses enfants lui-même : le
materializer projette l'ordre fourni par la scène résolue.

Son profil accepte un tag HTML optionnel, dont la valeur par défaut est
`section`, et une politique facultative :

```ts
type ListConfig = Readonly<{
  reorderOnMove?: boolean
  reorderOnAdd?: boolean
  reorderOnRemove?: boolean
}>
```

Les trois valeurs sont des booléens lorsqu'elles sont présentes. Le défaut de
chacune est `true`.

## Résolution de l'ordre

Le catalogue core déclare le module runtime `list` avec le composant. Chaque
player reçoit son propre état de capacité, construit depuis le `CompiledScene`.
Cet état traite les deltas structurels du circuit `MoveState` et fournit l'ordre
à la même `StructuralTimeline` que celle utilisée par la reconstruction et la
matérialisation. Il ne lit pas le DOM et ne crée ni journal ni reducer d'ordre
parallèle.

La configuration `reorderOnMove`, `reorderOnAdd` ou `reorderOnRemove` gouverne
le placement automatique correspondant. Les modes explicites `first` et
`last` restent appliqués même lorsque les trois politiques automatiques sont
désactivées. Leur résultat est reconstruit à partir des mêmes deltas lors d'un
Seek ; la matérialisation HTML reçoit alors le même ordre logique.

La capacité appartient au player et libère ses métadonnées au teardown. Un
reset de timeline réinitialise son historique de placement avant la
reconstruction. Le composant `list` reste propriétaire de sa racine et de ses
services HTML ; la capacité reste propriétaire des règles d'ordre.

## Preuves ciblées

- [`capability-validation.spec.ts`](../tests/scene/validation/capability-validation.spec.ts)
  vérifie le profil de configuration et les erreurs de types invalides.
- [`runtime-player.spec.ts`](../tests/runtime/player/runtime-player.spec.ts)
  vérifie l'ordre historique par `first`/`last`, le Seek vers les mêmes ordres
  et les politiques automatiques.
- [`pipeline.spec.ts`](../tests/runtime/player/pipeline.spec.ts) vérifie le
  transport des métadonnées d'ordre compilées.
- [`player-runner.spec.ts`](../tests/runtime/runner-html/player-runner.spec.ts)
  vérifie le commit de l'ordre dans le host HTML et la résolution après
  enregistrement d'un outlet imbriqué.

La preview pointer, le ghost et le commit capture persistante sont décrits et
testés dans la [spécification DnD/list](./list-dnd-v2-spec.md).
