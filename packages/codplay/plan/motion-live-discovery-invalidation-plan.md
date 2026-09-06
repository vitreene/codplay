# Plan — découverte live de `move` et portée de l’overlay

## Statut

> Status: En cours — raccord de pose live implémenté ; validation navigateur restante
> CodPlay version: V2 foundation
> Plan validé pour implémentation le 2026-09-05.

## Objectifs

1. Découvrir un eventime ajouté pendant la lecture lorsqu’il porte `move`, puis
   recalculer les frontières HTML avec l’état matérialisé par cet event.
2. Limiter chaque overlay au conteneur de la story qui présente les items en
   mouvement.

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

La validation de la démo `position` établit aussi une contrainte du
présentateur HTML : plusieurs frontières de `move` peuvent être actives au
même instant tout en appartenant à des stories différentes. Les FIRST/LAST
restent propres à chaque item, mais le host ne doit pas réduire ces stories à
une seule racine courante. Sinon la couche d’un item actif est déplacée dans le
dernier conteneur capturé et pollue la présentation d’une autre story.

La partition est logique : les intents sont regroupés par `storyId`, puis par
bornes temporelles et nature structurelle. Elle n’est pas déduite de
l’ascendance DOM courante. Le runner connaît déjà le `storyId` de chaque perso
et les racines logiques de la story dans le graphe résolu.

## Placement de l’overlay

La racine de scène et les conteneurs de story sont deux repères différents :

```text
racine de scène (cycle de vie du runner)
├── conteneur de la story A
│   ├── items auteur
│   └── [data-codplay-motion-overlay]
└── conteneur de la story B
    ├── items auteur
    └── [data-codplay-motion-overlay]
```

Le host doit conserver une couche par story active. Dans le chemin V2, la couche
n’est pas enfant du `sceneSlot` lorsque la story possède une racine visuelle
unique : elle est enfant direct de cette racine de story. Si une story possède
plusieurs racines visuelles indépendantes, aucune racine de story unique
n’existe ; le runner conserve alors une couche identifiée par cette story sous
la racine de scène. Ce cas est celui de `flip-stress` et ne doit pas modifier
son ordre d’empilement.

Le runner doit conserver la racine de scène pour son cycle de vie, mais fournir
au `HtmlMotionPresentationHost` le conteneur de story de chaque snapshot. Le
host conserve une couche par story, chacune au-dessus de ses items et dans son
propre repère géométrique. Aucune couche d’une story à racine unique ne doit
être enfant du layout général ni couvrir les contrôles voisins.

Cette modification implique de vérifier :

- la résolution du conteneur de story à partir du graphe, sans introduire de
  notion de vue ou de carousel dans CodPlay ;
- la conversion des poses lorsque le conteneur de story n’est pas la racine de
  scène ;
- le masquage automatique de l’overlay avec son conteneur ;
- la suppression de chaque couche au teardown général du runner ;
- la coexistence de couches de stories différentes lorsqu’elles ont un `move`
  actif.

L’implémentation associe à chaque item de snapshot l’identifiant runner-local et
la pose du conteneur de sa story. Le host retrouve chaque conteneur à la
présentation, maintient une couche par story et ne libère une couche que
lorsqu’elle ne contient plus de ressource active.

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

Lorsqu’un `move` live est ajouté alors que l’item est déjà en mouvement, le
runner prend la pose numérique de sa `PresentationFrame` au temps de
l’événement comme FIRST transitoire. Cette pose sert uniquement au raccord
visuel entre l’ancienne présentation et la nouvelle cible ; elle n’est ni
ajoutée au journal ni transformée en trajectoire rejouable. Le replay conserve
uniquement les positions et états produits par les événements journalisés.

### 3. Partitionnement et adaptation de l’overlay

Le host et son initialisation séparent :

- `sceneRoot` : racine conservée par le runner pour le cycle de vie ;
- `storyContainer` : parent DOM direct de la couche overlay et repère local
  des poses présentées pour une story.

Avant la capture, partitionner les intents par `storyId`, puis résoudre la
racine visuelle logique de cette story. Chaque couche reste unique pour cette
story, est insérée après les items auteur et reste au-dessus d’eux. Les couches
de stories différentes coexistent sans se remplacer.

Le resolver n’utilise pas le plus petit ancêtre DOM commun pour choisir la
story. Il utilise les `storyId`, `parentByPerso` et les nœuds persistants déjà
enregistrés par le runner. Le chemin V2 réel fournit toujours la story ; aucun
carousel ou concept de vue n’entre dans CodPlay.

L’attribut d’overlay porte aussi l’identité runner-locale de la story lorsque
plusieurs stories doivent exceptionnellement partager la racine de scène. Cela
évite que `ensureHtmlOverlayLayer` réutilise la couche d’une autre story.

Implémenté pour le host HTML : les frontières stockent la clé et la pose du
conteneur de story par item ; le host crée ou retrouve la couche correspondante
sans modifier `orderOverlayStack`, qui reste la référence de `flip-stress`.

## Critères d’acceptation

- un event sans `move` ne déclenche pas ce rebuild ;
- le premier `move` ajouté après `init()` crée le système et capture ses
  frontières ;
- une classe + `move` dans le même event est mesurée après matérialisation de la
  classe ;
- le retarget conserve les temps et les invariants du contrat `move` ;
- un `move` live qui recalcule sa cible repart de la pose visuelle courante,
  sans saut, sans journaliser cette pose intermédiaire ni sa trajectoire ;
- l’overlay est enfant du conteneur de sa story, pas du `sceneSlot`, lorsque la
  story possède une racine visuelle unique ;
- l’overlay est au-dessus des items de la story, mais pas du reste de la scène ;
- deux mouvements actifs dans deux stories conservent chacun leur couche et
  leur repère FIRST/LAST ;
- `flip-stress` conserve une couche pour sa story `main`, son parentage et son
  ordre d’empilement à FIRST, MIDDLE et LAST ;
- le masquage du conteneur masque aussi l’overlay ;
- le teardown retire l’overlay temporaire sans détruire les nœuds auteur ;
- Play, Seek, resize, replay et persistence n’utilisent pas d’histoire parallèle.

## Validation

Les tests du raccord live et du placement de l’overlay sont ajoutés au niveau
du runner réel. Ils vérifient le DOM et le parentage ; la suite ciblée couvre la
non-régression parent/enfant et reparent, Play, Seek, resize, persistence et
lifecycle.

État : la suite ciblée runner HTML/motion et les façades `position` et
`flip-stress` passent (16 fichiers, 115 tests). Elle couvre maintenant le
handoff de la pose présentée vers le FIRST live sans ajout au journal. Le
contrôle Safari Technology Preview précédent couvre le parentage des overlays,
mais pas encore ce saut après recalcul. Le typecheck du package `codplay` reste
bloqué par les imports `codplay-v1` préexistants dans
`packages/authoring/scene-factory`. Le build `@codplay/demos` reste bloqué par
l'import V1 `@codplay/editor/builder/build-scene`.

## Décision retenue

Le runner partitionne les moves par story avant toute capture. Chaque story
possède une identité de couche et, lorsqu’elle a une racine visuelle unique,
son overlay est créé comme enfant direct de cette racine. Une story à plusieurs
racines, comme `flip-stress`, conserve une couche identifiée par story sous la
racine de scène, sans changement de son graphe d’empilement. La racine de scène
reste uniquement le repère de cycle de vie et le repli nécessaire à ce cas
multi-racines.

Le raccord live reste interne : `RuntimePlayer` signale l’ajout au journal,
puis le runner réutilise le chemin de capture de `resize()` uniquement si un
nouvel intent `move` est présent. Aucun contrat `move`, observateur de `target`
ou circuit propre à la démo n’est ajouté.
