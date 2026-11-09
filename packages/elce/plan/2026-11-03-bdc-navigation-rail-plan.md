# Plan — rail d’icônes des BDC de page

**Statut : En cours.** Remplacer les poignées individuelles et la barre
d’ajout supérieure par un rail vertical d’accès, de déplacement et d’ajout des
BDC directs de la page.

## Contrat accepté

- Le rail se place à gauche de la séquence, dans une seule colonne verticale,
  avec une icône de type par BDC direct. Son premier point s’aligne sur le haut
  du premier BDC.
- Un espace horizontal de 1,25 rem sépare le rail de la séquence des BDC.
- Le rail reste adhérent en haut de la zone de page pendant son défilement.
- Une commande « Ajouter un contenu » avec l’icône « + » est la dernière entrée
  du rail. Elle ouvre une liste verticale de créations, chaque ligne associant
  l’icône et le libellé du BDC.
- Un clic à l’extérieur ferme la liste ; cliquer sur une autre commande flottante
  ferme aussi celle-ci avant d’ouvrir la suivante.
- La liste ouverte s’affiche au premier plan par-dessus les en-têtes et barres
  d’outils collants des BDC.
- Sous « + », une icône de corbeille sans contour ni fond de bouton accepte le
  dépôt d’une icône BDC du rail et supprime ce BDC par sa commande typée
  existante. Le déplacement vers « Blocs disponibles » garde sa fonction de
  mise en réserve.
- Une icône Catalogue distincte accepte le dépôt d’un BDC du rail et le remet
  dans le catalogue par la commande existante. La suppression des BDC directs
  reste centralisée dans la corbeille du rail ; leurs en-têtes ne répètent plus
  cette commande.
- Après une suppression réussie, l’icône de la corbeille tourne une fois pour
  confirmer l’action.
- La barre d’ajout supérieure est retirée. Le menu du rail réutilise les mêmes
  commandes, conditions de disponibilité et actions de création.
- Cliquer un point fait défiler jusqu’au BDC correspondant.
- Glisser un point sur un autre réordonne le rail et la séquence documentaire
  par les commandes BDC existantes. Le haut ou le bas du point détermine le
  placement avant ou après sa cible.
- Glisser un point vers « Blocs disponibles » conserve le retour au catalogue
  existant ; il n’y a pas de nouveau circuit de déplacement.
- Les séparateurs de la séquence restent disponibles pour insérer un BDC du
  catalogue dans la page.

## Travail et acceptation

- [x] Remplacer les poignées `GripVertical` par le rail vertical d’icônes.
- [x] Porter l’écart horizontal rail/BDC à 1,25 rem et confirmer le rendu dans
  l’éditeur réel : 20 px de grille, environ 22 px entre le bouton et le BDC.
- [x] Ajouter le défilement vers le BDC au clic.
- [x] Réutiliser la commande de déplacement existante pour réordonner depuis
  le rail et vers le catalogue.
- [x] Déplacer les commandes de création sous le bouton « + » et retirer la
  barre d’ajout supérieure.
- [x] Fermer la liste de création au clic extérieur, y compris quand l’auteur
  clique dans une autre commande flottante.
- [x] Vérifier que la liste ouverte recouvre les en-têtes et barres d’outils
  collants des BDC.
- [x] Garder le bouton « + » accessible pour une page vide.
- [ ] Mettre à jour la spécification d’organisation après validation du rendu
  et des gestes.
- [x] Vérifier deux ajouts de BDC via `LearningEditorFacade` et le même acteur
  XState, en changeant de page entre eux, puis relire leur présence depuis
  SQLite après chaque révision.
- [x] Réconcilier l’API auteur sur `5181` avec la version documentaire 10. Le
  listener obsolète a été arrêté puis remplacé par le serveur courant ; sa
  migration SQLite a converti le document ciblé « Test Elcé — liens et date »
  de v9 à v10. Les ajouts réels via le rail ont été sauvegardés aux révisions
  37, 38 et 39, puis vérifiés après rechargement dans l’éditeur, qui indique
  « Synchronisé ».
- [x] Ajouter la corbeille sous « + », sans apparence de bouton, et relier le
  dépôt de chaque BDC direct aux suppressions typées existantes.
- [x] Déclencher une seule rotation courte de la corbeille après confirmation
  effective de la suppression.
- [ ] Ajouter une cible Catalogue au rail et retirer l’icône de suppression des
  en-têtes des BDC directs, en conservant la suppression par le rail.
- [ ] Valider le dépôt et la suppression des différents types de BDC, la
  suppression des enfants appartenant à une Section ou un Carousel, la rotation
  après réussite et le maintien du geste de mise en réserve vers le catalogue.
- [ ] Vérifier dans l’éditeur réel l’alignement initial, l’adhérence après
  défilement, la navigation au clic, le réordonnancement et le retour au
  catalogue. Le lancement a aussi révélé qu’un serveur API déjà présent peut
  être réutilisé sur la seule base d’un contrôle CORS ; le garde-fou de version
  du lanceur local reste à examiner.

