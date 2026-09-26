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

Le contexte de conception sur la normalisation, le snapshot du catalogue et la
séparation des frontières est conservé dans la
[note de cohérence](./notes/2026-07-31-scene-coherence-boundaries.md). Cette
note n'est pas normative ; les spécifications et les gates ci-dessous font foi.

## Décisions et preuves restantes

### Découverte du manifeste de ressources

Le builder examine actuellement `src` sur les objets `initial` et les objets
d'action de premier niveau. Le commentaire de `collectResource()` annonce un
parcours récursif, mais son implémentation ne parcourt pas les objets imbriqués.
Le test confirme une source déclarée directement et l'ignorance d'une extension
inconnue ; il ne décide pas le traitement d'un `src` imbriqué dans une séquence
d'action.

Décider quelles formes auteur contribuent au manifeste, puis en fixer une
preuve. La spécification auteur ne décrit pas encore la profondeur de cette
découverte. Ne pas présenter le comportement observé du helper comme contrat
complet avant cette décision.

### Sémantique de `SceneDoc.defaults`

La propriété apparaît dans le type auteur, la normalisation et la donnée
compilée, mais aucun test ne certifie de règle qui l'applique et aucun
consommateur n'a été trouvé dans `packages/codplay/src`. Elle n'est donc pas un
mécanisme de defaults certifié par les specs.

Décider si cette propriété a un rôle V2. Si elle est conservée, préciser les
champs auxquels elle s'applique et sa priorité par rapport aux valeurs
explicites, aux actions déjà résolubles et aux defaults des composants/services.
La hiérarchie envisagée dans les versions précédentes de ce plan n'est pas un
contrat. Aucun code ne doit l'interpréter avant la décision et son parcours
d'acceptation.

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

- La décision sur `SceneDoc.defaults` est explicite : propriété définie et
  testée, ou rôle écarté de la tranche V2.
- La profondeur de découverte des sources auteur est décidée et testée ; le
  commentaire du helper et la spécification décrivent le même comportement.
- La dérivation du manifeste et son interprétation au runner sont testées sur
  les placements initiaux et temporels.
- Le montage page-level, son ordre et ses transitions Play/Seek ont une preuve
  d'intégration réelle.
- Les specs décrivent uniquement les comportements certifiés et le présent
  plan ne garde ensuite aucun travail ; retirer le plan à ce moment-là.

Une modification du cœur demeure soumise à un plan accepté et à l'autorisation
explicite requise par les règles du dépôt.
