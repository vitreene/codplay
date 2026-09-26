# Selection-frame — éditeur de zones

## Périmètre vérifié

Cette spécification décrit les comportements du modèle de zones et de
`createZoneEditor()` couverts par les tests du package. L’éditeur reçoit et
renvoie un `ZoneEditorState` ; il ne persiste pas lui-même les données dans le
document de l’application.

Les décisions et acceptations encore ouvertes — notamment la connexion au drop
du cadre et à l’éditeur hôte — restent dans le
[plan zone-editor](../plan/zone-editor-plan.md).

## Modèle

Une grille comporte `rows` et `cols`, avec une valeur facultative de `gap` CSS.
Une zone porte un `id`, un `name` et une emprise en pistes
`row`, `col`, `rowSpan`, `colSpan`. Les indices commencent à 1. Les zones
peuvent se chevaucher.

L’`id` identifie durablement la zone ; `name` est son étiquette modifiable.
Renommer conserve l’`id`.

Une zone peut porter une propriété `container` contenant une petite grille et
ses cellules enfants. Elle reste une seule entrée de `state.zones`.
`ZoneContainerChild` ne porte pas de nom propre : son libellé est calculé à
partir du nom de la zone parente et de sa position (`z1.1.2`). Chaque enfant
possède un `id` stable. Les enfants ne contiennent pas eux-mêmes de
`container`.

## Opérations sur le modèle

- `addZone` crée un nouvel identifiant et choisit le premier nom libre `z{n}`
  si aucun nom n’est fourni. Un nom en collision est rejeté.
- `removeZone` retire la zone désignée et, avec elle, son éventuelle division.
- `renameZone` conserve l’identité et rejette une collision de nom.
- `mergeZones` fusionne au moins deux zones en une emprise englobante. Le nom
  et l’identifiant de la première zone sélectionnée sont conservés par défaut.
  Une zone portant un `container` ne peut pas être fusionnée avant sa cassure.
- `divideZone` ajoute un `container` à la zone existante et crée deux cellules
  enfants sur un axe. Sans axe explicite, la grille a une rangée et deux
  colonnes ; `axis: 'row'` crée deux rangées et une colonne.
- `resizeContainerAxis` régénère une cellule 1×1 par position de la nouvelle
  grille. Les identifiants des positions conservées le restent ; les nouvelles
  positions reçoivent un identifiant et les positions supprimées disparaissent.
  Un axe ne peut pas descendre sous deux pistes.
- `breakContainer` ne casse qu’une zone par appel. Il retire la zone porteuse
  et remplace celle-ci par ses enfants convertis en zones autonomes. Les
  identifiants des enfants sont conservés et leurs noms calculés deviennent
  persistants.
- `listAllZoneNames` énumère les zones et leurs enfants avec leur `id`, leur
  nom calculé et leur type. La zone porteuse reste listée comme `leaf` ; les
  enfants portent `kind: 'container-child'` et l'`id` de la zone porteuse.

Une grille dont un axe dépasse 32 pistes ne peut pas déclarer de `gap` CSS ;
`validateZoneGridModel` signale cette combinaison.

`adjustFineGridForReservedTracks()` est aussi exportée et testée : elle choisit
le nombre de groupes le plus proche de la préférence qui tient dans la limite
de pistes fines après réservation des pistes de séparation. Le rendu actuel de
`createZoneEditor()` ne l'utilise pas ; le rôle à conserver pour cet utilitaire
reste à établir au plan.

## Interaction de `createZoneEditor`

L’éditeur suit le nœud `containerId` via `AuthorApi`. Il reste masqué tant que
le conteneur n’est pas monté et connecté. Le modèle reste utilisable sans DOM.

Les commandes de mutation et les gestes passent par le même chemin d’écriture
et notifient `onZonesChange`. Une sélection seule notifie `onSelectionChange`
sans mutation de zone. Les interactions vérifiées sont :

- tracer une zone en faisant glisser sur le fond de grille ;
- sélectionner, étendre ou réduire une sélection avec Shift, et parcourir des
  zones superposées avec Alt ;
- déplacer la zone ou la sélection, avec maintien des emprises et limitation
  aux bords de la grille ;
- redimensionner avec les huit poignées, sans réduire une emprise sous une
  piste ;
- diviser, ajuster ou casser un `container` au moyen des commandes et des
  flèches du clavier ;
- supprimer la sélection avec Delete ou Backspace.

Les commandes `setGrid`, `setState`, `select` et `setPartVisibility` mettent à
jour le modèle, la sélection ou la visibilité selon leur rôle.

## Présentation vérifiée par les tests

Le fond de grille est un seul élément de présentation, quelle que soit la
résolution. Chaque zone est un élément distinct positionné en pourcentage de la
grille. Les libellés des zones et des enfants calculés peuvent être masqués
indépendamment des zones ; le fond et les zones ont aussi des contrôles de
visibilité distincts.

## Preuves et limites

- [`zone-model.spec.ts`](../tests/zone-model.spec.ts) couvre les règles du
  modèle, les identifiants, les divisions et leur cassure, la fusion, les noms
  et la restriction des gaps CSS.
- [`zone-editor.spec.ts`](../tests/zone-editor.spec.ts) couvre le cycle
  d’attache du conteneur, le rendu du fond et des zones, les libellés et les
  contrôles de visibilité.
- [`zone-editor-gestures.spec.ts`](../tests/zone-editor-gestures.spec.ts)
  couvre les gestes, commandes, sélections, opérations clavier et garde de
  cycle de vie.

Cette spécification ne fixe pas le comportement de `fineDisplayThreshold`, la
mesure de `isCellPlacementAvailable()` sur une grille de navigateur, la
lisibilité à l’échelle réelle, ni les contrats de sauvegarde de cartes,
d’attachement des enfants ou de drop du cadre. Ces sujets restent au plan.
Le champ `padding` existe encore dans `ZoneGridModel`, mais aucun comportement
associé n'est vérifié ici.
La géométrie de `breakContainer()` n'est couverte par les tests que pour des
emprises divisibles exactement ; l'effet des gaps CSS locaux et des divisions
non entières reste au plan.
