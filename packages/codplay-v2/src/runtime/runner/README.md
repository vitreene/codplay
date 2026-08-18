# HTML runner V2

Status: A relire
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
  -> MoveFlipLayoutProjection
  -> HtmlDomProjection
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

Lors de l'initialisation, le host matérialise d'abord les composants afin que le
module `markup` publie les outlets, puis les modules player-scoped prennent leur
snapshot initial. Une capacité `list` peut ainsi conserver l'ordre initial de
ses enfants même lorsque la liste est imbriquée dans un outlet HTML.

`play()` démarre le ticker uniquement lorsque le runner possède son engine.
`advance(nowMs)` reste l'entrée déterministe pour les tests et les hosts qui
possèdent leur horloge. `seek(t)` reconstruit l'état logique sans rejouer les
straps. `resize()` incrémente l'epoch exposé pour la tranche visuelle future.

Dans cette tranche, les services DOM projettent les canaux auteur `style.x` et
`style.y` en une translation CSS composée. La résolution ACE fournit les valeurs
interpolées; le runner ne lit pas la position calculée du navigateur.

Un `move` explicite avec une transition positive active actuellement une capture
FLIP locale du perso déplacé, des siblings montés des targets before/after et de
leurs chaînes de composants ancêtres résolues.
Les ancêtres dont la boîte change sont aussi projetés comme entries locales afin
que leur `width`/`height` évolue avant les enfants.
Un mover dont la chaîne de parents change entre FIRST et LAST n'utilise pas la
chaîne de destination pour sa pose FIRST : sa pose est interpolée dans le repère
monde, tandis que les siblings restés dans la même chaîne conservent leur repère
local.
Les moves compilés à durée positive sont indexés par un journal d'occurrences et
peuvent être réalisés froidement depuis leurs scènes historiques. La présentation
historique restaure la scène courante dans un `finally` avant la projection au
temps demandé. Les événements live et les reorders `list` historiques restent
hors de cette tranche. Voir `plan/runner-flip-integration-study.md`.

Quand le module `list` est présent, son snapshot d'ordre et de touched set est
consommé par le player avant la projection DOM. La réalisation froide d'un
reorder list historique recrée des instances de modules temporaires et rejoue les
frontières d'événements compilées depuis `t=0`, sans modifier l'état du player
courant.

## Invariants

- Les composants sont les seuls écrivains de leur état DOM.
- `LayoutDomBackend` est le seul responsable du parentage logique.
- Les parts publiées sont enregistrées et supprimées avec le cycle de vie du composant.
- `destroy()` détache les noeuds matérialisés et libère les services player-scoped.
- Les éléments initialement présents dans le root fourni par le host ne sont pas supprimés par le runner.

## Hors tranche

Cette tranche ne prétend pas fournir:

- les overlays et les réalisations historiques d'événements live;
- les captures froides des événements live ou des transitions complexes ou
  concurrentes;
- la policy métier `list` et son reorder; le touched set générique local ne
  remplace pas cette capacité;
- l'exécution générique de `listen` et des straps.

Ces capacités devront ouvrir leurs contrats avant l'adaptation de `flip-stress`.
