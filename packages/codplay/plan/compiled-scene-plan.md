# Acceptation de `CompiledScene`

> Statut : **En cours**. La forme de scène, le build structurel et la
> frontière JSON sont décrits par leurs spécifications. Ce plan conserve les
> comportements restant à décider ou à certifier.

## Autorité

Les contrats vérifiés sont dans la [spécification auteur de scène](../specs/scene-authoring-spec.md),
la [spécification du codec JSON](../specs/compiled-codec-v2-spec.md), la
[spécification de reconstruction logique](../specs/runtime-reconstruction-v2-spec.md)
et les spécifications des capacités concernées. Ces documents déterminent
l'interprétation de leurs comportements ; ce plan ne les redéfinit pas.

Le chemin de build actuel utilise le snapshot de validation du catalogue,
normalise le document et produit un `CompiledScene` immuable avec ses
requirements et index dérivés. Les fonctions auteur restent dans la collection
séparée du résultat de build. Les plans spécialisés gardent les décisions
relatives aux payloads des features.

## Périmètre de stabilisation

Le format actuel est décrit par les spécifications. Les évolutions de
découverte des actions, d’activation et de defaults sont séparées dans le
[plan des évolutions](./evolutions/evolution-backlog.md).
La fermeture des médias et CSS de l’export est décrite par la
[spécification du paquet](../specs/scene-package-export-v1-spec.md).

### Manifeste `rootNodeIds` et montage page-level

L'implémentation actuelle dérive des candidats de racine depuis les placements
`@root` de `initial` et des actions, puis le runner crée des cibles de racine
par story contenant un candidat. Ce comportement n'est pas encore fixé par une
spécification ni directement asserti dans les tests du runner. Le builder
possède un test de fixture qui attend `['quiz-layout']` ; les tests de pipeline couvrent la
résolution temporelle des placements, mais aucun test du runner ne couvre
directement l'interprétation de `rootNodeIds`.

Parcours restant :

1. Tester la dérivation en ordre de déclaration, avec placements de racine dans
   `initial`, dans une action seulement, et avec plusieurs candidats.
2. Tester dans le runner réel l'attachement, le détachement et le réattachement
   à `@root` / `@off` aux frontières temporelles, puis par Seek avant et après
   ces frontières.
3. Vérifier l'ordre de plusieurs racines et l'unique propriétaire du montage
   page-level, sans seconde insertion par une façade.
4. Après ces preuves, fixer dans une spécification dédiée ou dans celle de
   reconstruction le sens exact de `rootNodeIds` et son raccord au montage
   HTML ; mettre à jour l'index général.

La règle envisagée est que la liste ordonnée unique nomme les persos qui
peuvent atteindre la racine par un placement auteur. Cette lecture reste une
hypothèse jusqu'à l'acceptation ci-dessus ; elle ne remplace pas l'état de
placement résolu au temps demandé.

## Critères de clôture

- La dérivation du manifeste et son interprétation au runner sont testées sur
  les placements initiaux et temporels.
- Le montage page-level, son ordre et ses transitions Play/Seek ont une preuve
  d'intégration réelle.
- Les specs décrivent uniquement les comportements certifiés et le présent
  plan ne garde ensuite aucun travail ; retirer le plan à ce moment-là.

Une modification du cœur demeure soumise à un plan accepté et à l'autorisation
explicite requise par les règles du dépôt.
