# Capacité list V2

> Statut : Fixe
> Version CodPlay : V2 foundation
> Relecture : contrat V2 de la capacité et branchement FLIP validés le 2026-08-21

## Rôle

La capacité `list` décide où placer les éléments d'une liste pendant la
lecture. Elle travaille avec le composant `list`, mais ne dessine rien et ne
conserve pas une deuxième version de l'ordre des éléments.

L'ordre de référence reste celui calculé par la scène. La capacité applique
simplement la politique de placement demandée par le composant et les actions.

## Fonctionnement

La politique est lue dans `initial.config` du `perso` `list` :

```ts
config: {
  reorderOnMove?: boolean
  reorderOnAdd?: boolean
  reorderOnRemove?: boolean
}
```

Les trois options valent `true` par défaut. Un placement explicite (`first`,
`last`, `prepend`, `append` ou une position numérique) reste prioritaire. Le
mode `auto` conserve la position actuelle lorsque l'option correspondante est
désactivée ; `reorder: false` désactive toujours le changement d'ordre.

À chaque événement structurel, la capacité applique une opération complète :

1. retirer les éléments déplacés ou détachés de leur ancienne liste ;
2. insérer les éléments montés selon le mode demandé ;
3. comparer l'appartenance obtenue avec celle de la scène résolue ;
4. publier un instantané complet de l'ordre.

## Organisation interne

Le réducteur structurel porte l'ordre logique. Le materializer HTML lit ensuite
cet ordre et le projette sur les nœuds persistants des auteurs. La présentation
FLIP — comparaison des positions avant et après un changement — est réalisée
par le graphe de mouvement existant.

Les paramètres de transition restent sur l'action `move` :
`move.transition.duration`, `ease`, `path`, `traversal` et, pour une trajectoire
calée sur le centre affine, `pathAnchor: 'center'` sont consommés par le graphe
existant. La capacité `list` ne crée pas de pipeline d'animation parallèle.

Un déplacement dans la même liste est présenté comme un mouvement local par
défaut. Un transfert vers une autre liste change de parent logique et devient
un mouvement de type `reparent`. Cette décision ne dépend pas de `flipMode`.

## Contrat et limites

- la capacité est créée une fois par lecteur ;
- elle ne modifie jamais directement le DOM ;
- elle ne mesure pas les positions et ne crée pas d'animation parallèle ;
- elle ne lit pas l'historique d'un module pour reconstruire l'ordre ;
- les paramètres de transition restent portés par l'action `move` ;
- le materializer et son adaptateur restent responsables de l'affichage.
