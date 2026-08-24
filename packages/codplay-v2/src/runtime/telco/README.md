# Telco V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

La telco est la façade locale qui permet à une interface de piloter un player
V2. Elle transforme des commandes de transport en appels vers un player déjà
initialisé et expose son état sous une forme observable et sérialisable.

## Fonctionnement

Les commandes prises en charge sont `play`, `pause`, `seek` et `rewind`. La
telco les sérialise, les transmet à la cible de transport et publie les
instantanés d'état ainsi que la progression.

## Organisation interne

La démo utilise une seule façade telco avec `HtmlPlayerRunner` et un remote de
contrôle unique. Les boutons de la démo ne possèdent donc pas un circuit de
pilotage parallèle.

## Contrat et limites

- la telco ne contient ni logique de scène, ni recherche de cibles, ni
  materialization ;
- elle n'implémente pas encore de transport distant ;
- `rate` reste une capacité distincte du player ;
- son périmètre actuel sert à la validation capture/DnD interne.
