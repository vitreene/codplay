# Présentation des mouvements HTML V2

> Statut : Fixe
> Version CodPlay : V2 foundation

## Rôle

Ce dossier contient les fonctions de géométrie et d'arbre DOM utilisées par
`HtmlMotionPresentationHost`. Elles servent à présenter les mouvements calculés
par le graphe sans créer un deuxième circuit de scène.

## Fonctionnement

La géométrie localise les poses et compare les matrices affines. Les fonctions
d'arbre gèrent les ancêtres de l'overlay, les chemins de clone, l'ordre des
nœuds et le nettoyage des ressources temporaires.

## Organisation interne

- `geometry.ts` porte la localisation des poses et les comparaisons affines ;
- `tree.ts` porte l'arbre de l'overlay, les clones stables, l'ordre et le
  nettoyage ;
- `types.ts` porte les contrats des ressources d'overlay.

## Contrat et limites

`HtmlMotionPresentationHost` reste l'unique orchestrateur du circuit de
présentation HTML. Ces fonctions ne créent ni materializer, ni player, ni
système de mouvement concurrent.
