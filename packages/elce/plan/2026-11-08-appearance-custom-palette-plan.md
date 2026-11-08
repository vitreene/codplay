# Plan — palette de couleurs personnalisées

**Statut : En cours.** Le sélecteur applique déjà des couleurs personnalisées
au niveau choisi ; l’auteur signale que le choix n’est pas reflété dans
l’éditeur. Le bouton « + » doit conserver une couleur dans la palette du projet.

## Contrat accepté

- Choisir une couleur l’applique au niveau courant (projet, page ou BDC) par
  l’override d’apparence existant ; la cascade continue de s’appliquer à ses
  descendants et une réinitialisation rétablit l’héritage.
- « + » ajoute la couleur courante à une palette persistée dans le projet,
  réutilisable sur toute cible. Ce choix de palette ne remplace pas l’override
  de la cible courante.

## Actions et acceptation

1. Reproduire dans l’éditeur réel le choix d’une couleur personnalisée et
   corriger le raccord au sélecteur et à la commande d’apparence existante.
2. Ajouter les couleurs enregistrées au document projet, avec migration depuis
   la version 12, validation, persistance SQLite et aller-retour API.
3. Afficher ces couleurs comme échantillons sélectionnables et ajouter le bouton
   « + » pour mémoriser la couleur courante ; éviter les doublons.
4. Vérifier le choix, l’enregistrement, le rechargement, les overrides projet →
   page → BDC et le reset dans l’éditeur réel, puis mettre à jour
   [`appearance-spec.md`](../specs/appearance-spec.md).
