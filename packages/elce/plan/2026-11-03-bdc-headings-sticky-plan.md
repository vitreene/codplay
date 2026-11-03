# Plan — en-têtes adhérents des BDC de page

**Statut : En cours.** Les en-têtes des BDC directs restent visibles en haut
de la colonne centrale pendant le défilement de leur propre bloc.

## Contrat accepté

- Réutiliser le défilement vertical existant de la colonne centrale de
  l’éditeur ; ne pas ajouter de scrollport ni de gestionnaire JavaScript.
- Rendre adhérents les en-têtes des BDC directs de la page : Section, Question,
  Résultat, Carousel, Carte et Graphe.
- Un en-tête reste en haut tant que son BDC est visible dans la séquence. À la
  limite du bloc, il laisse la place à l’en-tête du BDC suivant.
- Le titre, les actions et la barre de mise en forme d’une Section forment un
  seul bloc sticky opaque, avec un espace sous les icônes inclus dans le bloc
  pour éviter que le texte passe dans un jour.
- Les vues Carte/Graphe d’un Carousel et les éditeurs d’ancres gardent leur
  contexte imbriqué existant et ne deviennent pas des en-têtes de la séquence
  directe.

## Travail et acceptation

- [x] Appliquer l’adhérence aux six en-têtes de BDC directs dans le scrollport
  central et leur donner un fond opaque adapté au BDC.
- [x] Regrouper le titre, les actions et la barre Section dans un seul bloc
  sticky opaque, avec un espace inférieur intégré au bloc.
- [ ] Vérifier dans l’éditeur réel qu’un en-tête reste visible pendant le
  défilement de son BDC, que le suivant prend le relais, et qu’aucun en-tête ni
  la barre Section ne se recouvre ; vérifier aussi une largeur étroite.
- [ ] Après validation, reporter le contrat vérifié dans la spécification
  d’organisation et dans les spécifications des BDC concernés.
