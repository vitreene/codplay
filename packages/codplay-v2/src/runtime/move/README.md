# État de mouvement V2

> Statut : Fixe
> Version CodPlay : V2 foundation
> Relecture : placement pur et deltas structurels validés le 2026-08-20 ; les politiques de liste restent hors de ce module

## Rôle

Ce dossier calcule où placer les éléments et quelles différences structurelles
existent entre deux états de scène. Il ne s'occupe pas de l'animation visuelle.

## Fonctionnement

Le contrat auteur `move` est décrit dans
[`../../../plan/move-contract-plan.md`](../../../plan/move-contract-plan.md). L'auteur
indique une cible `target`; le runtime la résout en identifiants de cible et de
parent traités comme des valeurs opaques.

Le module produit les changements `mount`, `unmount` et `move`. Il résout aussi
les conflits de mouvements qui arrivent au même instant et transporte les
paramètres de transition déclarés par l'auteur.

Les chemins SVG sont normalisés avant d'entrer ici ; ce dossier ne fait que les
transporter avec l'état de placement et les deltas.

## Organisation interne

La capacité `list` consomme les deltas et applique ensuite sa politique propre à
chaque conteneur. Les materializers consomment les demandes de présentation
plus tard, dans le graphe de mouvement.

## Contrat et limites

- aucune lecture du DOM ;
- aucune instance de composant ;
- aucune politique d'ordre propre aux listes ;
- aucun materializer FLIP ;
- les résultats restent des données pures, donc testables sans navigateur.
