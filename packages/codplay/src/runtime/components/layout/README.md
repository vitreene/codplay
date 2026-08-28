# Composant layout V2

> Statut : Fini
> Version CodPlay : V2 foundation

## Rôle

Le composant `layout` fournit une structure HTML déclarée par l'auteur. Il
sert de conteneur général pour les éléments que la scène doit placer dans ses
parties.

## Fonctionnement

Le profil `LayoutInitial` contient le template `markup`. Celui-ci est vérifié et
nettoyé avant l'instanciation du composant. La classe retourne ensuite ce
template et applique les propriétés visuelles à sa racine.

## Organisation interne

- `layout-types.ts` décrit le template initial et l'état visuel ;
- `layout-validation.ts` vérifie que le template est une chaîne non vide ;
- `layout-component.ts` retourne le template et applique les mises à jour ;
- `index.ts` expose le composant et sa validation.

## Contrat et limites

Le composant ne crée pas ses enfants et ne lit pas son contenu pour en déduire
une logique. Le materializer découvre les parties et la scène détermine leur
parentage.
