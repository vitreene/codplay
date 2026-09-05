# Plan — découverte live de `move` et portée de l’overlay

## Statut

> Status: En cours — implémentation terminée ; validation navigateur et build global restants
> CodPlay version: V2 foundation
> Plan validé pour implémentation le 2026-09-05.

## Objectifs

1. Découvrir un eventime ajouté pendant la lecture lorsqu’il porte `move`, puis
   recalculer les frontières HTML avec l’état matérialisé par cet event.
2. Limiter l’overlay au conteneur local qui présente les items en mouvement.

Le plan ne modifie aucun contrat auteur existant et ne traite pas le cycle de
vie du conteneur appelant. Si ce conteneur est masqué, l’overlay, qui en est un
descendant, est masqué avec lui. Aucun `unmount` ou nettoyage anticipé n’est
ajouté.

## Références

- [`move-contract-plan.md`](./move-contract-plan.md) : contrat de `move` et
  frontières de présentation ;
- [`runtime/motion/README.md`](../src/runtime/motion/README.md) : graphe et
  retarget ;
- [`runtime/runner-html/README.md`](../src/runtime/runner-html/README.md) :
  capture HTML et cycle du runner ;
- [`runtime/player/README.md`](../src/runtime/player/README.md) : journal,
  reconstruction et dispatch ;
- [`runtime/materializer/README.md`](../src/runtime/materializer/README.md) :
  materialisation et nœuds auteur persistants.

## Cause établie

Le runner prépare le planning et le système de mouvement avec les eventimes
connus à `init()`. Un eventime live portant `move` peut ensuite être journalisé
et matérialisé sans que ses frontières soient ajoutées au graphe HTML.

La classe éventuelle de la même action est appliquée avant la capture. Elle peut
donc modifier la position mesurée. `move` est le déclencheur du recalcul ; il ne
faut pas observer séparément `target`, `className` ou `style`, ni étendre
`diffSolvedScenes` pour cela.

## Placement de l’overlay

La racine de scène et le conteneur de mouvement sont deux repères différents :

```text
racine de scène (cycle de vie du runner)
└── conteneur local de mouvement (items source/cible)
    ├── items auteur
    └── [data-codplay-motion-overlay]
```

Le code actuel appelle `ensureHtmlOverlayLayer(this.root)` ; dans le chemin V2,
`this.root` est le `sceneSlot`. L’overlay devient donc un enfant de la scène
entière. Ce point doit être corrigé.

Le runner doit conserver la racine de scène pour son cycle de vie, mais fournir
au `HtmlMotionPresentationHost` le conteneur local de mouvement. La couche doit
être créée comme enfant direct de ce conteneur, au-dessus de ses items, avec le
même repère géométrique pour la capture et la projection. Elle ne doit pas être
enfant du layout général ni couvrir les contrôles voisins.

Cette modification implique de vérifier :

- la résolution du conteneur local sans introduire de notion de vue ou de
  carousel dans CodPlay ;
- la conversion des poses lorsque le conteneur local n’est pas la racine de
  scène ;
- le masquage automatique de l’overlay avec son conteneur ;
- la suppression de la couche au teardown général du runner.

L’implémentation associe à chaque snapshot un identifiant runner-local du
conteneur capturé. Le host retrouve cet élément à la présentation et change de
couche lorsque la frontière active change de conteneur ; les ressources
temporaires sont alors libérées avant d’être recréées dans le nouveau conteneur.

## Mise en œuvre

### 1. Raccord de découverte live

Dans la transaction commune du `RuntimePlayer`, trouver le point après :

1. dispatch de l’event et de ses cascades ;
2. reconstruction de la scène ;
3. matérialisation de l’action, y compris sa classe.

À ce point, signaler au runner qu’un append au journal a eu lieu. Le runner
recompile alors le planning et ne reconstruit que si un `move` est effectivement
actif. Le raccord doit couvrir les emits publics, les adapters, les straps et
les cascades. `subscribeTransport()` ne doit pas servir de détecteur et aucune
API publique ne doit être créée.

Réalisé : le `RuntimePlayer` signale aussi l’ajout direct d’un eventime
journalisé, car ce chemin ne matérialise pas nécessairement la scène au moment
de l’append. Le runner filtre les révisions sans nouvel intent `move` et
réutilise le même cœur de capture pour les autres chemins.

### 2. Rebuild des frontières

Réutiliser le cœur de capture déjà exécuté par `init()` et `resize()` :

1. compiler le planning à partir du journal courant ;
2. créer le système HTML s’il n’existe pas ;
3. capturer les états sur les nœuds auteur persistants ;
4. mesurer après l’application de l’event portant `move` ;
5. remplacer les frontières du graphe ;
6. retargeter depuis la pose visuelle courante ;
7. présenter immédiatement le temps courant.

Conserver les contrats existants de Play, Seek, replay, resize et
`persist-only`. Aucun second player, journal, scheduler ou graphe ne doit être
introduit.

Réalisé : le rebuild est déclenché après matérialisation normale ; le premier
eventime live est capturé avant la présentation suivante et la frame courante
est présentée avec les nouvelles frontières.

### 3. Adaptation de l’overlay

Modifier le host et son initialisation pour séparer :

- `sceneRoot` : racine conservée par le runner pour le cycle de vie ;
- `motionContainer` : parent DOM direct de la couche overlay et repère local
  des poses présentées.

La couche reste unique pour le conteneur de mouvement concerné, est insérée
après les items auteur et reste au-dessus d’eux. Si plusieurs conteneurs locaux
doivent être présentés simultanément, cette décision doit être validée avant
de généraliser le host ; ne pas la résoudre par une couche globale.

Réalisé pour le host HTML : les frontières capturent le plus petit ancêtre
commun des nœuds d’item et de leurs cibles, stockent sa clé runner-local et
insèrent l’overlay directement dans ce conteneur.

## Critères d’acceptation

- un event sans `move` ne déclenche pas ce rebuild ;
- le premier `move` ajouté après `init()` crée le système et capture ses
  frontières ;
- une classe + `move` dans le même event est mesurée après matérialisation de la
  classe ;
- le retarget conserve les temps et les invariants du contrat `move` ;
- l’overlay est enfant du conteneur local de mouvement, pas du `sceneSlot` ;
- l’overlay est au-dessus des items du conteneur, mais pas du reste de la scène ;
- le masquage du conteneur masque aussi l’overlay ;
- le teardown retire l’overlay temporaire sans détruire les nœuds auteur ;
- Play, Seek, resize, replay et persistence n’utilisent pas d’histoire parallèle.

## Validation

Les tests du raccord live et du placement de l’overlay sont ajoutés au niveau
du runner réel. Ils vérifient le DOM et le parentage ; la suite ciblée couvre la
non-régression parent/enfant et reparent, Play, Seek, resize, persistence et
lifecycle.

État : tests facade live/overlay et capture ciblée passants (110 tests) ; le
typecheck isolé du package `codplay` est bloqué par des imports `codplay-v1` dans
`packages/authoring/scene-factory`, le typecheck global conserve ses erreurs V1
préexistantes, et `@codplay/demos` n'expose pas de script `typecheck`. Le build
global et le contrôle navigateur Safari restent à exécuter.

## Décision appliquée

Le `motionContainer` est résolu côté runner comme le plus petit ancêtre DOM
commun des items concernés et de leurs cibles. L'overlay est créé comme enfant
direct de ce conteneur ; la racine de scène ne sert qu'au cycle de vie du
runner. Le raccord live reste interne : `RuntimePlayer` signale l'ajout au
journal, puis le runner réutilise le chemin de capture de `resize()` uniquement
si un nouvel intent `move` est présent. Aucun contrat `move`, observateur de
`target` ou circuit propre à la démo n'a été ajouté.
