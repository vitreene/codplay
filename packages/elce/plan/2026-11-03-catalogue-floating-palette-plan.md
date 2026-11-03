# Plan — palette flottante des catalogues

**Statut : En cours.** L’interface actuelle répartit le catalogue de pages
dans le panneau Scénario et les BDC/médias dans le panneau Contenus. La
palette consolide uniquement ces trois espaces ; les autres panneaux et leurs
comportements restent en place.

## Contrat demandé

- Un bouton de bascule placé à côté de « Prévisualiser » ouvre ou réduit une
  palette flottante, indépendante de la barre d’action et des colonnes.
- La palette présente trois onglets : Pages, BDC et Médias.
- Le dépôt d’une page ou d’un BDC n’importe où dans la palette place l’élément
  dans le bon catalogue, ouvre l’onglet correspondant et réutilise ses
  commandes de déplacement existantes.
- Un BDC du catalogue peut être déposé sur la rangée d’icônes BDC de la page.
  Un trait d’insertion épais indique sa position avant ou après l’icône visée ;
  le même repère marque le réordonnancement des BDC déjà dans cette rangée.
- Les catalogues Pages, BDC et Médias quittent leurs emplacements actuels pour
  être réunis dans la palette. Le panneau Scénario, ainsi que Style et
  Variables dans le panneau droit, restent en place.
- Le catalogue Médias conserve sa liste actuelle de ressources réutilisables.

## Travail et acceptation

- [x] Confirmer que seuls les catalogues Pages, BDC et Médias sont réunis ;
  les panneaux Scénario, Style et Variables restent en place.
- [x] Ajouter l’ouverture/fermeture de la palette au bouton voisin de
  « Prévisualiser » et ses trois onglets.
- [x] Détacher visuellement la palette de la barre d’action et l’afficher en
  superposition indépendante.
- [x] Relier les dépôts de pages et de BDC partout dans la palette aux
  commandes de placement existantes et sélectionner le catalogue adapté.
- [x] Déplacer les trois listes de catalogue dans la palette, en conservant le
  panneau Scénario et le panneau droit Style/Variables.
- [x] Accepter le dépôt d’un BDC du catalogue sur la rangée d’icônes de page ;
  afficher un trait épais avant/après pour le dépôt et le réordonnancement.
- [ ] Vérifier le dépôt palette→rangée d’icônes BDC, le réordonnancement et
  leurs traits d’insertion, les retours page/BDC, les médias, le profil/variables,
  le style, la position flottante, le focus clavier et le responsive dans
  l’éditeur réel.
- [ ] Mettre à jour les spécifications d’organisation et de catalogue après
  vérification de l’intégration.
