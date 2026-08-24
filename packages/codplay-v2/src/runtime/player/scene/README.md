# Reconstruction de scène du player V2

> Statut : Fixe
> Version CodPlay : V2 foundation

## Rôle

Ce dossier reconstruit l'état d'une scène à un instant donné. Il est partagé
par Play, Seek et la capture de géométrie du runner afin que ces trois usages
produisent le même résultat.

## Fonctionnement

Le chemin unique est :

```text
materialize -> resolve -> solve
```

Les fonctions reçoivent explicitement les dépendances possédées par le player
et retournent les données nécessaires à la synchronisation des composants et à
la mise à jour structurelle.

## Organisation interne

La reconstruction reste pure autant que possible. La façade `RuntimePlayer`
coordonne le moment où elle est appelée et transmet ensuite la scène résolue au
materializer.

## Contrat et limites

Le dossier ne crée pas de player, de journal, de materializer ou de circuit de
replay parallèle. Il ne lit pas le DOM pour reconstruire l'état logique.
