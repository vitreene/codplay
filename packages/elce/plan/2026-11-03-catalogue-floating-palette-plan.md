# Plan — palette flottante des catalogues

**Statut : En cours.** L’interface actuelle répartit le catalogue de pages
dans le panneau Scénario et les BDC/médias dans le panneau Contenus. La
palette consolide uniquement ces trois espaces ; les autres panneaux et leurs
comportements restent en place.

## Contrat demandé

- Un bouton de bascule placé à côté de « Prévisualiser » ouvre ou réduit une
  palette flottante, indépendante de la barre d’action et des colonnes.
- Les boutons « Prévisualiser » et « Catalogue » ont la même hauteur minimale
  de 2,25 rem ; « Prévisualiser » porte une icône Œil.
- La palette présente trois onglets : Pages, BDC et Médias.
- Le dépôt d’une page ou d’un BDC n’importe où dans la palette place l’élément
  dans le bon catalogue, ouvre l’onglet correspondant et réutilise ses
  commandes de déplacement existantes.
- Un BDC du catalogue peut être déposé sur la rangée d’icônes BDC de la page.
  Un trait d’insertion épais indique sa position avant ou après l’icône visée ;
  le même repère marque le réordonnancement des BDC déjà dans cette rangée.
- La palette flottante se déplace par sa barre de titre et possède une commande
  de fermeture ; le bouton Catalogue existant permet de la rouvrir.
- Le rail BDC de la page propose une cible Catalogue distincte de sa corbeille.
  Déposer un BDC direct sur cette cible réutilise `returnBdcToCatalog` ; la
  corbeille reste le seul geste de suppression définitive des BDC directs.
- Les pages quittent le Scénario vers le catalogue par le glisser-déposer
  existant dans la palette, sans corbeille par ligne.
- Les catalogues Pages, BDC et Médias quittent leurs emplacements actuels pour
  être réunis dans la palette. Le panneau Scénario, ainsi que Style et
  Variables dans le panneau droit, restent en place.
- Le catalogue Médias conserve sa liste actuelle de ressources réutilisables.

## Travail et acceptation

- [x] Confirmer que seuls les catalogues Pages, BDC et Médias sont réunis ;
  les panneaux Scénario, Style et Variables restent en place.
- [x] Ajouter l’ouverture/fermeture de la palette au bouton voisin de
  « Prévisualiser » et ses trois onglets.
- [x] Harmoniser la hauteur des boutons « Prévisualiser » et « Catalogue » et
  ajouter l’icône Œil à « Prévisualiser » ; Safari confirme 36 px pour chacun.
- [x] Ajouter une marge basse de 0.5 rem sous la rangée de commandes ; Safari
  mesure 8 px jusqu’au contenu central à 800 px et à 1139 px.
- [x] Détacher visuellement la palette de la barre d’action et l’afficher en
  superposition indépendante.
- [x] Relier les dépôts de pages et de BDC partout dans la palette aux
  commandes de placement existantes et sélectionner le catalogue adapté.
- [x] Déplacer les trois listes de catalogue dans la palette, en conservant le
  panneau Scénario et le panneau droit Style/Variables.
- [x] Accepter le dépôt d’un BDC du catalogue sur la rangée d’icônes de page ;
  afficher un trait épais avant/après pour le dépôt et le réordonnancement.
- [ ] Déplacer la palette depuis son en-tête, la maintenir dans la zone visible,
  ajouter sa commande de fermeture et conserver la réouverture par le bouton
  Catalogue.
- [ ] Ajouter une cible Catalogue au rail BDC, retirer la suppression des
  en-têtes des BDC directs et conserver les commandes de suppression typées
  derrière la corbeille centralisée.
- [ ] Retirer les corbeilles des lignes de page du Scénario et vérifier leur
  retour au catalogue par glisser-déposer.
- [ ] Vérifier le dépôt palette→rangée d’icônes BDC, le réordonnancement et
  leurs traits d’insertion, les retours page/BDC, les médias, le profil/variables,
  le style, la position flottante, le focus clavier et le responsive dans
  l’éditeur réel.
- [ ] Mettre à jour les spécifications d’organisation et de catalogue après
  vérification de l’intégration.
