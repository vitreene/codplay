# CodPlay V2 - coordination list et FLIP

## Statut

Status: En cours  
CodPlay version: V2 foundation  
Review: required before components and renderer

## Contrat V2

FLIP est une capacité du backend de rendu DOM. Il ne devient pas une dépendance
du move core, de `ListCapabilityState` ou d'un composant list particulier.

La capacité list reste responsable de l'état logique :

- parent et montage ;
- ordre logique ;
- politiques `reorderOnMove`, `reorderOnAdd`, `reorderOnRemove` ;
- ensemble logique des éléments affectés ;
- production des demandes de projection et de transition.

Le backend DOM reste responsable de :

- capture des rects avant ;
- application des mutations DOM ;
- mesure après ;
- calcul inverse et animation ;
- matrices d'ancêtres ;
- `overlay-world` ;
- reflow et nettoyage des transitions.

## Frontiere

```text
SolvedScene + MoveStateDelta
        -> ListCapability / ListCoordinator
        -> RenderProjectionRequest
        -> DomFlipBackend
        -> DOM projection and transition
```

`RenderProjectionRequest` est la frontière à définir entre décision logique et
projection. Il doit porter l'ensemble affecté, l'ordre cible, le parent source,
le parent cible et les options de transition, sans contenir d'`HTMLElement` dans
le contrat list.

Un backend non DOM peut consommer la même demande avec sa propre stratégie de
projection. FLIP n'est donc pas généralisé artificiellement ; seule la frontière
de coordination l'est.

## Seek

Le seek reconstruit l'état logique et le montage cible sans rejouer les transitions
FLIP. Le backend de rendu :

- nettoie les transitions précédentes ;
- projette directement l'état cible ;
- établit sa baseline ;
- ne produit aucune animation de rattrapage.

## Dépendances

- `MoveStateDelta` est produit par le core et ne connaît pas FLIP ;
- `ListCapabilityState` reste pur et ne lit pas le DOM ;
- `ListCoordinator` est une future instance de capacité, par player ;
- `DomFlipBackend` appartient à la tranche renderer/measure ;
- les composants consomment les snapshots et demandes de projection, mais ne
  deviennent pas la source de vérité logique.

## Hors tranche actuelle

- aucun backend DOM FLIP V2 ;
- aucune mesure DOM ;
- aucune matrice d'ancêtres ;
- aucun contrat public de `RenderProjectionRequest` final ;
- aucun composant list de production.
