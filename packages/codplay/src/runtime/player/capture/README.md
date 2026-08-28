# Sous-module capture du player V2

> Statut : Fixe
> Version CodPlay : V2 foundation

## Rôle

Ce dossier regroupe les fonctions internes qui permettent à `RuntimePlayer` de
gérer une capture continue. Il ne définit pas l'API publique de capture et ne
crée pas un deuxième journal d'événements.

## Fonctionnement

Les fonctions résolvent les cibles d'actions compilées, appliquent les actions
actives, fusionnent l'état temporaire de capture et gèrent l'annulation.

## Organisation interne

- `action-target-index.ts` prépare une fois les cibles des actions live ;
- `live-capture-actions.ts` réapplique les actions par les surfaces des
  composants ;
- `state-updates.ts` fusionne l'état non journalisé et traite l'annulation ;
- `types.ts` porte les formes d'état appartenant au player.

## Contrat et limites

Ces fonctions reçoivent leurs dépendances depuis `RuntimePlayer`. Elles ne
créent ni player, ni registre de modules, ni nouveau circuit de seek.
