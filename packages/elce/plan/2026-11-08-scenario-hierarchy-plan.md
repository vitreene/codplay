# Plan — scénario hiérarchique et présentation

**Statut : En cours.** Le scénario actuel est plat sous la racine et chaque
chapitre ne contient que des pages. L’utilisateur accepte jusqu’à six niveaux
de chapitres standard, avec pages et sous-chapitres dans un ordre mêlé.

## Décisions acceptées et point ouvert

- Les chapitres standards peuvent contenir des pages et des sous-chapitres
  standards dans le même ordre. La profondeur maximale est de six niveaux.
- Les chapitres Évaluation ne peuvent pas être des sous-chapitres.
- Les règles de visibilité et les prérequis d’un chapitre parent s’appliquent à
  ses pages et à toute sa sous-arborescence.
- Le Sommaire conserve l’arborescence. Le prérequis automatique d’un chapitre
  suit la séquence de son niveau : l’entrée mixte immédiatement précédente
  (page ou chapitre) doit être terminée avant d’ouvrir le chapitre.
- L’entrée fixe du Sommaire dans l’éditeur apparaît une seule fois, à la racine
  du scénario, jamais dans les listes des chapitres.
- La corbeille des chapitres est conservée. Les lignes Page/Diapo perdent leur
  corbeille ; une page retourne au catalogue par glisser-déposer vers la palette
  ou vers la cible Catalogue du bandeau Scénario.
- Pour harmoniser le Sommaire avec les pages, étudier ensuite une colonne
  d’icônes à gauche ; le glisser vers la palette reste disponible.
- Nouvelle décision utilisateur du 8 novembre 2026 : remplacer les quatre
  commandes de création visibles du bandeau Scénario par une rangée « + » /
  corbeille / catalogue. « + » ouvre les quatre mêmes créations ; les pages
  peuvent être déposées au catalogue ou à la corbeille ; la corbeille accepte
  aussi un chapitre vide, mais aucun chapitre ne peut être placé au catalogue.
  Les corbeilles propres aux chapitres restent en place.
- Le menu « + » se ferme au clic extérieur, y compris quand l’auteur clique
  dans une autre commande flottante.

## Actions et acceptation

1. Garder le titre de projet visible ; placer le titre Scénario et la rangée
   « + » / corbeille / catalogue sur une ligne, avec l’icône Style blanche à
   droite. Le « + » réutilise les quatre actions existantes : Chapitre, Page,
   Diapo et Évaluation ; un clic extérieur ferme son menu. La rangée et son menu
   flottant sont implémentés et contrôlés dans Safari ; valider encore les gestes
   de dépôt décrits ci-dessus.
2. Remplacer les libellés Page/Diapo des entrées par leur icône, renforcer les
   séparateurs du premier niveau et conserver la corbeille des chapitres.
3. Adapter le document et ses invariants, les commandes de
   création/déplacement/suppression, l’auteur et SQLite au nouvel ordre
   hiérarchique.
4. Refuser une profondeur de sept niveaux et tout sous-chapitre Évaluation ;
   préserver les documents existants et leur ordre après migration.
5. Faire hériter les règles d’accès des ancêtres, puis adapter le Sommaire et
   les projections de lecture à l’arborescence.
6. Vérifier les mouvements entre niveaux, les limites de profondeur, la
   persistance, l’ordre de lecture, le Sommaire, la visibilité, les prérequis et
   le responsive ; confirmer que l’entrée auteur du Sommaire reste unique à la
   racine ; actualiser les spécifications d’organisation et de Sommaire.
