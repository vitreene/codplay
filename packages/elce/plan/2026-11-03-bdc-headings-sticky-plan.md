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
- Les six bandes adhérentes ont un fond légèrement translucide. Leurs marges,
  paddings et espacements voisins sont intégrés à la bande pour que le contenu
  défilant ne passe pas à travers des fentes.
- Le titre, les actions et la barre de mise en forme d’une Section forment un
  seul bloc sticky, avec l’espace sous les icônes intégré au bloc.
- Les vues Carte/Graphe d’un Carousel et les éditeurs d’ancres gardent leur
  contexte imbriqué existant et ne deviennent pas des en-têtes de la séquence
  directe.
- Décision utilisateur du 8 novembre : chaque BDC direct de page est isolé dans
  son propre cadre ; les filets servent uniquement aux emplacements de dépôt.

## Travail et acceptation

- [x] Appliquer l’adhérence aux six en-têtes de BDC directs dans le scrollport
  central, avec un fond légèrement translucide adapté au BDC et couvrant leurs
  espaces de marge, padding et séparation.
- [x] Regrouper le titre, les actions et la barre Section dans un seul bloc
  sticky, avec les espaces supérieur et inférieur intégrés au bloc.
- [ ] Vérifier dans l’éditeur réel qu’un en-tête reste visible pendant le
  défilement de son BDC, que le suivant prend le relais, et qu’aucun en-tête ni
  la barre Section ne se recouvre ; vérifier aussi une largeur étroite.
- [x] Encadrer les BDC directs via leur conteneur commun et retirer les cadres
  concurrents des éditeurs internes. Safari MCP confirme les styles calculés
  des BDC Avatar et Carousel à 800 px et 1139 px, sans débordement horizontal ;
  la capture est vide, donc seule la structure DOM a été vérifiée.
- [ ] Vérifier visuellement dans l’éditeur réel les cadres et les en-têtes
  adhérents sur écran large et étroit.
- [ ] Après validation des en-têtes, reporter leur contrat dans la
  spécification d’organisation et dans les spécifications des BDC concernés.
