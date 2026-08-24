# Diagnostics du player V2

> Statut : Fixe
> Version CodPlay : V2 foundation

## Rôle

Ce dossier transforme les problèmes détectés dans les politiques de mouvement
résolues en rapports de diagnostic indépendants du player.

## Fonctionnement

Les diagnostics sont construits à partir des résultats calculés ; ils ne
modifient ni le cycle de vie, ni l'état des composants, ni la présentation.

## Organisation interne

Les fonctions de ce dossier sont appelées par la façade du player après la
résolution des mouvements. Elles produisent des données détachées, faciles à
transmettre à l'hôte ou à une interface de validation.

## Contrat et limites

Le dossier ne possède pas d'horloge, de materializer ou d'effet de présentation.
