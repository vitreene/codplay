# Utilitaires HTML runtime V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

Ce dossier contient les petites vérifications communes nécessaires aux modules
qui travaillent avec des éléments HTML. Il évite de recopier partout le même
test de compatibilité avec la surface de géométrie du navigateur.

## Fonctionnement

`isMeasurableHtmlElement` vérifie qu'un élément possède la surface nécessaire
pour être mesuré dans une capture de mise en page ou de mouvement. Le résultat
est utilisé comme garde technique avant toute lecture de géométrie.

## Organisation interne

Le dossier reste volontairement réduit : la garde de mesurabilité est partagée,
tandis que chaque propriétaire conserve ses règles de mise en page, de décodage
des pointeurs et de lecture des matrices.

## Contrat et limites

- aucun module de politique de liste ou de mouvement n'est défini ici ;
- aucune lecture de géométrie n'est déclenchée par cet utilitaire ;
- le parsing des matrices et les conversions propres aux materializers restent
  dans leurs dossiers respectifs.
