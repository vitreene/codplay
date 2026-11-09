# Plan — palette de couleurs personnalisées

**Statut : En cours.** La palette est enregistrée. Le choix d’une palette ou
d’un fond doit sortir de Transparence ; la validation du rendu et de la
réinitialisation reste ouverte.

## Contrat accepté

- Choisir une couleur l’applique au niveau courant (projet, page ou BDC) par
  l’override d’apparence existant ; la cascade continue de s’appliquer à ses
  descendants et une réinitialisation rétablit l’héritage.
- « + » ajoute la couleur courante à une palette persistée dans le projet,
  réutilisable sur toute cible. Choisir une palette applique ses rôles Fond et
  Texte au niveau courant ; les réglages explicites locaux conservent la
  priorité définie par le résolveur.
- Choisir une couleur de fond ou une palette lorsque la densité effective est
  `none` rétablit Normal. « Transparent » reste couplé au retrait intérieur.
- Le fond et la couleur du texte s’appliquent au rendu uniquement. Les champs
  auteur et la zone centrale conservent leurs couleurs d’interface.
- « + » reprend le bouton d’icône secondaire et l’icône Plus communs. Cadre,
  Transparent et Contraste auto utilisent la même présentation de case à cocher.

## Actions et acceptation

1. Reproduire dans l’éditeur réel le choix d’une couleur personnalisée et
   corriger le raccord au sélecteur et à la commande d’apparence existante.
2. Ajouter les couleurs enregistrées au document projet, avec migration depuis
   la version 12, validation, persistance SQLite et aller-retour API.
3. Afficher ces couleurs comme échantillons sélectionnables et ajouter le bouton
   « + » pour mémoriser la couleur courante ; éviter les doublons.
4. Vérifier le choix, l’enregistrement, le rechargement, les overrides projet →
   page → BDC, le retour de Transparence à Normal après choix d’une palette,
   et le reset dans l’éditeur réel, puis mettre à jour
   [`appearance-spec.md`](../specs/appearance-spec.md).
5. Reproduire la modification et le reset dans la preview Learning réelle,
   aux niveaux projet, page et BDC. Vérifier les événements du picker, la
   cascade parent/enfant et la synchronisation par le circuit existant.
   Le picker traite `input` et `change` par la même commande, sans doublon
   d’historique pour une même valeur.
6. Vérifier les conventions des contrôles, les couleurs de texte avec et sans
   contraste automatique, la preview réelle, la persistance et le responsive.
   Exécuter les régressions ciblées, le typecheck, la suite et le build Elcé.

La reprise complète des portées demandée par l’utilisateur est possédée par le
[plan Style](2026-10-22-elce-style-tab-plan.md#reprise-de-la-chaîne-des-portées).
Ce plan de palette n’autorise pas à modifier isolément une surface du lecteur.
