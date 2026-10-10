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

## Décisions et preuves

### CSS inclus dans une scène de diffusion

Décision appliquée dans Sighty : une ressource de scène peut porter
`{ sceneDoc, styleSheet }`, comme le résultat du builder de l’éditeur.
`styleSheet` est du texte CSS associé à la scène, pas un champ de `SceneDoc`.
Sighty le transmet à `preload.css.set()` sur son conteneur ; le service existant
applique `@scope` et retire les feuilles à la destruction de CodPlay. Aucun
résolveur ni champ `SceneDoc` parallèle n’est ajouté. Le chargement CSS par URL
reste au [plan preload](./media-preload-plan.md).

Preuve de référence : [`build-scene.ts`](../../editor/src/builder-v2/build-scene.ts)
produit les deux valeurs côte à côte et
[`scene-player-bridge.ts`](../../editor/src/app/bridges/scene-player-bridge.ts)
transmet le texte par le canal CSS existant. Les sources directes et différées,
le scope et le nettoyage du raccord Sighty sont couverts dans
[`runtime-features.spec.ts`](../../sighty/tests/runtime-features.spec.ts) et
suivis au [plan Sighty](../../sighty/plan/2026-09-15-sighty-navigation-reconstruction-plan.md).

### Découverte du manifeste de ressources

Le builder examine actuellement `src` sur les objets `initial` et les objets
d'action de premier niveau. Le commentaire de `collectResource()` annonce un
parcours récursif, mais son implémentation ne parcourt pas les objets imbriqués.
Le test confirme une source déclarée directement et l'ignorance d'une extension
inconnue ; il ne décide pas le traitement d'un `src` imbriqué dans une séquence
d'action.

#### Correctif à prévoir — `src` d'un perso `tag`

Statut : besoin accepté comme correctif futur ; la portée exacte de la
découverte reste à cadrer et aucune modification n'est implémentée.

Quiz Hunt a besoin d'une vidéo HTML native : son perso `tag` porte
`initial.attr.src`, avec `controls` et `autoplay`, afin que le navigateur garde
la lecture et ses contrôles. Cette source imbriquée n'entre pas dans
`CompiledScene.resources` avec la découverte actuelle. Sighty ne peut donc pas
la demander au service preload avant la matérialisation de la question ; le
chargement natif commence alors à l'ouverture.

Le correctif à prévoir est d'étendre le circuit existant de découverte du
manifeste afin qu'il puisse reconnaître au minimum `initial.attr.src` d'un
perso `tag` et l'exposer comme ressource compilée, pour que le préchargement
Sighty existant puisse la traiter avant l'entrée dans la question. Cette note
ne certifie ni la profondeur générale de parcours ni le handoff de la ressource
préchargée au `<video>` natif. Il faudra valider dans le navigateur qu'on gagne
bien la disponibilité avant ouverture sans lancer deux chargements. Aucun
circuit de preload parallèle ni contournement local à la démo ne doit être
ajouté.

Avant le code, cadrer dans ce plan les formes auteur couvertes et leur
classification, puis fixer une preuve : tests du builder et du codec pour la
source incluse dans le manifeste, test d'intégration Sighty du préchargement
avant matérialisation, et validation navigateur cache froid de la première
image et de l'absence de chargement redondant. La spécification auteur ne
décrit pas encore la profondeur de découverte ; ne pas présenter le comportement
observé du helper comme contrat complet. Toute modification du cœur reste
soumise à un plan accepté et à l'autorisation explicite requise par les règles
du dépôt.

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
