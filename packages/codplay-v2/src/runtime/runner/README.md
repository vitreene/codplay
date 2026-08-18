# HTML runner V2

Status: En cours  
CodPlay version: V2 foundation

## Role

Le runner est la frontière HTML générique entre un `CompiledScene`, un
`RuntimePlayer` et un root DOM. Il ne contient aucune règle propre à une démo.

Le flux couvert par cette tranche est:

```text
CompiledScene
  -> HtmlPlayerRunner
  -> RuntimePlayer
  -> RuntimeComponentRuntime
  -> HtmlComponentMaterializer
  -> LayoutDomBackend
  -> DOM
```

## Contract

`HtmlPlayerRunner` reçoit:

- un `CompiledScene` déjà construit et validé;
- un root HTML;
- une liste explicite de `rootTargets` associant un ID opaque à un `storyId`;
- un catalogue de composants et un catalogue de services DOM;
- éventuellement un `RuntimeEngine` et un `RuntimeModuleServiceCatalog` externes.

Les `rootTargets` sont obligatoires pour rendre `@root` matérialisable. Les
outlets sont publiés par le module `markup` lorsqu'un composant expose les parts
choisies par sa définition runtime. Le runner ne déduit jamais un target depuis
le nom d'un élément ou depuis le DOM.

`play()` démarre le ticker uniquement lorsque le runner possède son engine.
`advance(nowMs)` reste l'entrée déterministe pour les tests et les hosts qui
possèdent leur horloge. `seek(t)` reconstruit l'état logique sans rejouer les
straps. `resize()` incrémente l'epoch exposé pour la tranche visuelle future.

Dans cette tranche, les services DOM projettent les canaux auteur `style.x` et
`style.y` en une translation CSS composée. La résolution ACE fournit les valeurs
interpolées; le runner ne lit pas la position calculée du navigateur.

## Invariants

- Les composants sont les seuls écrivains de leur état DOM.
- `LayoutDomBackend` est le seul responsable du parentage logique.
- Les parts publiées sont enregistrées et supprimées avec le cycle de vie du composant.
- `destroy()` détache les noeuds matérialisés et libère les services player-scoped.
- Les éléments initialement présents dans le root fourni par le host ne sont pas supprimés par le runner.

## Hors tranche

Cette tranche ne prétend pas fournir:

- `HtmlDomProjection` ou `MoveFlipLayoutProjection`;
- les captures FLIP et leur seek pendant une transition;
- la détection d'ancêtres, les overlays et les mesures historiques;
- la capacité `list` et le reorder métier;
- l'exécution générique de `listen` et des straps.

Ces capacités devront ouvrir leurs contrats avant l'adaptation de `flip-stress`.
