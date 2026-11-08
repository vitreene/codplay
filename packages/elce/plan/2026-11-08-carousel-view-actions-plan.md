# Plan — commandes horizontales des vues Carousel

**Statut : En cours.** La rangée Carte/Graphe reste horizontale et réutilise
les actions auteur existantes du Carousel.

## Décisions acceptées

- Remplacer les deux boutons d’ajout visibles par un bouton « + » qui ouvre
  leurs commandes Carte et Graphe existantes dans un menu compact ancré juste
  après le « + », hors du flux de la rangée.
- Un clic à l’extérieur ferme le menu ; ouvrir une autre commande flottante le
  ferme également.
- La corbeille reçoit le glisser d’une vue et la supprime par l’action typée
  existante ; elle est inactive lorsqu’il ne reste qu’une vue.
- L’icône Catalogue reçoit le glisser d’une vue, détache le BDC du Carousel et
  le remet au catalogue par la commande `bdc.remove` existante. Elle est inactive
  sur la dernière vue ; les réglages de durée et de transcript propres à
  l’entrée du Carousel quittent avec cette relation, tandis que le BDC est
  conservé.
- L’éditeur enfant Carte affiche le surtitre « Carte », retire sa corbeille
  locale et place son bouton Style à droite du surtitre.
- Décision utilisateur du 8 novembre 2026 : les vues Carte et Graphe peuvent
  désormais être déplacées au catalogue, sauf la dernière vue du Carousel.

## Travail et acceptation

- [x] Conserver les onglets horizontaux et regrouper « + », la corbeille et le
  catalogue dans la même rangée ; le menu « + » réutilise les actions Carte et
  Graphe actuelles et s’ouvre juste après le « + » sans agrandir la rangée.
- [x] Fermer le menu au clic extérieur, y compris depuis un autre menu flottant.
- [ ] Supprimer une Carte ou un Graphe enfant par glisser-déposer dans la
  corbeille, en gardant l’interdiction de retirer la dernière vue.
- [x] Ajouter l’en-tête Carte avec le bouton Style à droite et retirer la
  corbeille locale.
- [ ] Ajouter l’icône Catalogue comme cible de dépôt horizontale et la relier à
  `LearningEditorFacade.returnBdcToCatalog`.
- [ ] Vérifier dans l’éditeur réel l’ajout, la suppression, le réordonnancement,
  la conservation de la dernière vue et les styles de l’en-tête.
- [ ] Reporter le comportement vérifié dans la spécification Carousel.
