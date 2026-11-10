# Évolutions de l’export de scène

> Version cible : à affecter. La V1 du paquet est terminée ; ses contrats sont
> dans la [spécification du paquet](../../specs/scene-package-export-v1-spec.md).

## Ressources de scène depuis une origine distante

La V1 copie les ressources locales déclarées. L'évolution ultérieure demandée
permettra aux ressources d'une scène d'être lues depuis une origine distante.
Elle ne concerne pas l'hébergement du paquet lui-même : `scenePath` accepte
déjà une URL distante, décrite par la spécification du paquet. Le mode
`remote` des bibliothèques concerne leur runtime, pas les assets de scène.

Aucune règle technique ni prise en charge des URL distantes d'assets n'est
incluse dans cette tranche. À rouvrir avec un plan d'acceptation dédié ; la V1
refuse les sources non locales décrites par la spécification du paquet.

## Compatibilité player et paquet

Le choix de version de schéma et le traitement des paquets existants restent
ouverts avec le [plan de découverte des actions](./action-discovery-plan.md).
Aucun lecteur parallèle ni restauration du catalogue ne sont acceptés par
la seule suppression de cet index. Fixer cette décision avant de modifier
le codec ou le loader.

Le défaut des vidéos futures hors root reste au
[plan média V2](../media-preload-plan.md#isolation-des-vidéos-futures-avant-activation).
Il ne devient pas une évolution de l’export.
