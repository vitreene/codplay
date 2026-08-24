# Délégation des modules du player V2

> Statut : Fixe
> Version CodPlay : V2 foundation

## Rôle

Ce dossier relie `RuntimePlayer` aux modules créés pour chaque player. Il
centralise la délégation afin que la façade du player reste responsable du
cycle de vie sans connaître les détails de chaque capacité.

## Fonctionnement

La délégation transmet les notifications, les demandes liées à l'horloge
native, les politiques d'ordre structurel, les deltas de mouvement et les
interruptions du seek en plusieurs étapes.

## Organisation interne

Les modules reçoivent les dépendances et les surfaces typées qui leur sont
nécessaires. Les fonctions de ce dossier ne possèdent pas l'état global du
player ; elles transmettent les opérations au module concerné.

## Contrat et limites

Le dossier ne crée ni registre de modules concurrent, ni cycle de vie parallèle,
ni alternative au chemin de lecture principal.
