# Présentation DOM V2 (runner HTML)

> Statut : En cours — correction de la frontière géométrique FLIP
> Version CodPlay : V2 foundation
> Relecture : calcul d'endpoint et parent démarré plus tard couverts par les tests ; contrôle navigateur des positions effectué

## Rôle

`HtmlPlayerRunner` relie une scène compilée, un `RuntimePlayer`, le catalogue
runtime et une racine HTML visible. Il transforme les états résolus de la scène
en affichage dans le navigateur.

Le runner possède le circuit de présentation HTML. Il ne crée pas de deuxième
player, de deuxième scène logique ou de deuxième historique pour animer les
éléments.

Un composant peut produire des éléments SVG dans son template. Ils sont
matérialisés par ce même runner HTML/DOM ; aucun point d'entrée ni materializer
SVG distinct n'est sélectionné.

## Fonctionnement

Le chemin de présentation est unique :

```text
SolvedScene(t)
  -> synchronisation des composants auteur
  -> materialization de la structure HTML
  -> resolvePresentationFrame(t)
  -> commit atomique de la présentation HTML
```

Les services HTML sont assemblés dans `service-definitions.ts` et
enregistrés par le catalogue core. Le runner reçoit le catalogue déjà composé
par CodPlay ; il ne crée pas de registre local.

Pour une scène qui utilise les longueurs logiques `cqw`, le host initialise
`numericLengthScale` à `largeur-de-la-racine / 100` et le recalcule à chaque
resize. Le runner ne déduit aucune unité depuis une déclaration CSS : il ne
projette que la forme logique déjà produite par le builder V2.

La garde `isMeasurableHtmlElement` et le pont HTML du module `markup` sont
également conservés ici : ils dépendent du substrat DOM et ne font pas partie
des états logiques des capacités.

Play et Seek utilisent exactement cette opération. Le runner conserve les
frontières géométriques immuables nécessaires à la présentation et, pendant
une capture live ouverte, le FIRST utilisé pour la remise `endEmit`. Il ne
conserve jamais un arbre DOM historique et ne rejoue pas une branche spéciale
de capture.

Le planning de mouvement est compilé à l'initialisation du journal visible,
après une capture live terminée et après un resize. Il contient les transitions
`move.transition` et les transitions d'action qui modifient une pose. La boucle
de frame résout le graphe conservé et l'état de présentation du materializer ;
elle ne relit pas la géométrie du DOM et ne reconstruit pas le planning à chaque
frame.

## Organisation interne

Les deux présentateurs HTML qui concentrent le plus de responsabilités sont
spécialisés dans leurs propres dossiers :

- `motion-presentation/` contient les types de ressources temporaires, la
  géométrie des poses et matrices, ainsi que l'ordre des parents et descendants ;
- `list-dnd-preview/` contient la géométrie du hit-test, le décodage des
  pointeurs, les ghosts, le nœud flottant et les helpers de prévisualisation
  FLIP.

`HtmlMotionPresentationHost` et `HtmlListDndPreview` restent les seuls
orchestrateurs de leurs circuits respectifs. Ces dossiers ne créent ni nouveau
materializer, ni nouveau player, ni nouveau système de mouvement, ni autre
chemin logique de DnD.

## Capture de géométrie

Le runner ne construit pas un second arbre HTML pour le FLIP. Lorsqu'un
`move` ou une transition de pose existe, une phase explicite :

1. retire les transformations locales, réserves de taille et masques du frame
   précédent ;
2. demande au `RuntimePlayer` de résoudre la scène aux temps utiles :
   `before`, `afterStart`, les éventuels endpoints intermédiaires de propriétés,
   puis `after` ;
3. présente chaque état résolu sur les nœuds auteur persistants, puis lit leur
   géométrie ;
4. conserve uniquement les instantanés numériques immuables.

Les overlays existants restent en dehors de la mise en page normale et sont
réutilisés. Ils ne servent pas d'arbre de mesure. « Jouer » un point de capture
signifie ici résoudre et matérialiser l'état de la scène ; cela n'appelle pas
`play()`, ne joue pas les médias, ne recharge pas les sources et ne détruit pas
les composants. Le reset est synchrone : aucun frame du navigateur ne
s'intercale entre la présentation de l'état et la lecture de sa géométrie.

Pour un `move` structurel, la capture inclut les enfants actuels des cibles
source et destination. Un enfant qui possède aussi un mouvement direct ultérieur
reste disponible pour animer le reflow de la liste. Un élément capturé seulement
comme dépendance d'un ancêtre ne peut pas écraser sa propre trajectoire naturelle.

## Géométrie interne de présentation

Le runner possède des briques de capture (`captureHtmlPose`,
`captureHtmlLayoutSnapshot` et `presentSceneForGeometryCapture`) pour ses propres
besoins de mouvement HTML, FLIP et reparent. Elles mesurent des nœuds dans une
transaction interne et ne constituent pas un contrat d'authoring.

La première verticale éditeur position/taille ne consomme pas ces captures : elle
lit l'état logique par `instance.snapshot`, utilise la largeur de sa racine de
scène comme repère local et monte son cadre d'interaction dans cette racine. Le
runner ne publie donc ni frame de sélection, ni référence DOM, ni pose de nœud à
l'éditeur. Toute évolution de capture pour une grille, une taille intrinsèque ou
un repère transformé devra faire l'objet d'une spécification et d'une tranche
distinctes.

Le reset retire aussi les masques de source laissés par l'overlay précédent. Les
ghosts existants sont remis dans l'ordre parent-avant-enfant, en remontant toute
la chaîne même lorsqu'un intermédiaire n'a pas de ghost ; `appendChild`
réordonne alors un nœud existant et n'en crée pas un nouveau. Les masques des
descendants indépendants sont suivis par frame et effacés avant l'application
suivante, afin qu'un clone d'ancêtre réutilisé ne conserve pas un enfant caché.
Les ghosts partagent le même `z-index` : l'overlay parent est donc inséré avant
son enfant indépendant, qui est peint au-dessus de lui lorsqu'ils se recouvrent.

Le runner n'écrit pas de transformations neutres `translate`, `rotate` ou
`scale`. Il les neutralise avec `none` seulement lorsqu'une valeur auteur non
neutre entrerait en composition avec la matrice de présentation ; la déclaration
`transition` n'est pas modifiée.

Cette règle concerne la capture de géométrie. Une présentation `reparent` peut
posséder une représentation temporaire parce que le nœud auteur doit rester
dans son parent logique. Cet overlay n'est ni un arbre de mesure ni une seconde
materialization de composant. Pendant le basculement, la source et le clone
sont mutuellement exclusifs : la source est masquée avant l'insertion ou la
révélation du clone, puis le clone est retiré avant que la source soit révélée.

Le runner fournit une révision logique. Si la structure du template est stable,
le host synchronise la représentation existante ; il ne la recrée qu'après une
invalidation structurelle. La révision inclut l'état auteur résolu afin que le
contenu et les attributs restent synchronisés. Elle ne provient pas du DOM et
n'entre pas dans le calcul de pose.

Pour chaque frontière compilée :

- un `move` capture FIRST avec `resolveSceneBeforeBoundary(startAt)` ; pour la
  structure naturelle immédiatement après le commit, il capture aussi
  `afterStart` avec `resolveSceneAt(startAt)` ; enfin, il capture LAST à
  `resolveSceneBeforeBoundary(startAt + delay + duration)` ;
- `afterStart` sert uniquement à donner aux frères les slots de reflow qui
  existent dès le démarrage du move. Il ne doit pas être remplacé par le
  snapshot d'endpoint, car celui-ci peut déjà contenir un autre eventime ;
- LAST reste le snapshot d'endpoint du mover direct. Il peut donc contenir la
  cible et la chaîne d'ancêtres dans leur état temporel à cet endpoint, sans
  importer cet état dans les trajectoires de reflow des frères ;
- une transition de pose (`style`, y compris un mot ou une propriété de
  présentation) capture FIRST à `startAt`, puis LAST à
  `startAt + delay + duration`. Elle reste pilotée par le materializer sur le
  nœud source : elle ne crée ni reflow FLIP ni overlay par elle-même.

Les propriétés d'une même action qui ne finissent pas ensemble ajoutent leurs
temps de fin intermédiaires à cette séquence. Leur scène est résolue par le
player canonique avant chaque présentation : le runner HTML ne recalcule donc
ni leur valeur, ni leur easing, ni leur état logique. `resolveHtmlMotionActionTransition`
ne fait que transmettre les temps nécessaires au planning ; il partage la
normalisation de timing du pipeline et ne constitue pas un second moteur de
transition.

Le LAST d'un `move` est donc sa position géométrique à la fin de sa transition,
pas une lecture immédiate au temps logique de l'événement. Cette distinction
permet à une cible ou à un ancêtre absent au FIRST mais monté au LAST de fournir
le contexte de destination. `afterStart` empêche cependant qu'un eventime
ultérieur modifie dès le départ la trajectoire des frères du move précédent.
La distinction ne décale pas l'application logique de l'événement et ne demande
aucun montage artificiel au FIRST. Si la scène ne contient aucun `move`
transitionnel ni transition de pose du materializer, le runner n'initialise pas
de système de mouvement, ne capture pas les positions et ne crée pas d'overlay.

Exemple : un `move` commence à `1200 ms`, dure `1000 ms` et sa cible est montée
à `1500 ms`. Le snapshot FIRST est celui de `1200 ms` avant le commit ; le
snapshot `afterStart` est mesuré à `1200 ms` pour les slots de reflow ; le
snapshot LAST est mesuré à `2200 ms` et peut donc contenir la cible et toute sa
 chaîne d'ancêtres. Entre ces bornes, le graphe résout la présentation à partir
 des poses conservées ; il ne relit pas le DOM et ne reconstruit pas une scène
 concurrente.

Chaque attachement conserve également les mesures de l'item et de sa chaîne
d'ancêtres au FIRST ou au LAST correspondant. Si l'enfant commence avant son
parent, la résolution avance dans le segment temporel du parent pour obtenir sa
pose au temps demandé ; elle n'utilise jamais la pose finale du parent comme
substitut. Les ancêtres sans transition ne produisent aucune sortie de frame :
leurs poses locales ne servent qu'à composer celle du mover.

Un mover qui est absent au FIRST parce qu'un ancêtre est détaché conserve sa
chaîne logique dans le graphe. Lorsque le mover et cette chaîne sont disponibles
au LAST, la capture présente ponctuellement l'état FIRST du mover dans le
contexte des ancêtres montés au LAST afin d'obtenir son attachement source. Elle
réutilise les nœuds auteur persistants, ne crée pas de DOM de mesure et restaure
le LAST avant sa lecture finale. L'absence reste inchangée dans la présentation
normale au FIRST. La fusion hybride est limitée au mover et à ses ancêtres ;
elle ne peut pas remplacer le FIRST d'un autre mover de la même frontière.

## Présentation locale et reparent

Les deux modes utilisent la même pose résolue.

### Mode local

Le mode local applique les réserves de taille et les slots de transformation au
nœud auteur dans son parent courant. Il est choisi par défaut lorsque la cible
reste la même, notamment pour un réordonnancement dans une liste.

Les tailles locales actives sont écrites avant le calcul des matrices, dans un
ordre parent-avant-enfant. Les frères réutilisent la matrice inverse de leur
parent résolu. Un transform n'est réécrit que si la matrice affine ou le nœud
source change.

### Mode reparent

Le mode `reparent` masque le nœud auteur et crée une représentation indexée dans
l'overlay racine. Il est obligatoire lorsque la cible ou le parent logique
change, notamment lors d'un transfert entre deux listes. `flipMode:
'overlay-world'` peut aussi le demander explicitement.

Les poses de l'overlay sont calculées par rapport à sa propre couche mesurée,
avec ses bordures et transformations. Un descendant en mouvement indépendant
est caché dans le clone de son ancêtre. Un descendant seulement local sous un
ancêtre overlay reçoit ses slots dans le ghost de cet ancêtre et ne possède pas
de ressource indépendante. Seul un descendant ayant lui-même une représentation
`reparent` reçoit un ghost séparé.

La matrice inverse de la racine est calculée une fois par frame de présentation
et réutilisée. Les dimensions d'un ghost stable ne sont écrites que lorsqu'elles
changent ; la matrice de pose reste la seule écriture par frame.

## Cycle de vie

- `init()` initialise les composants visibles, capture les frontières seulement
  lorsqu'un mouvement existe, puis construit le graphe immuable ;
- `play()` et `seek(t)` présentent le graphe à un temps logique absolu ;
- `resize()` prépare la géométrie naturelle, invalide les captures, reconstruit
  le graphe et réapplique la frame courante sans recréer les overlays stables ;
- `destroy()` retire les slots locaux, les overlays, les composants et les
  horloges possédées.

## Capture HTML classique

Le runner branche `HtmlPointerCaptureSourceAdapter` après l'initialisation du
player visible. Pour chaque `perso.emit.pointerdown.capture`, l'adaptateur :

1. émet l'événement de début avec `RuntimePlayer.emit()` ;
2. ouvre la capture avec `beginCompiledCapture()` après la promesse de début ;
3. transmet les `pointermove` à `trackCapture()` ;
4. ferme sur l'événement déclaré dans `endOn` — `pointerup` par défaut — avec
   `endCapture()`.

Le suivi et la fin sont écoutés sur la cible globale, en phase de capture, afin
de rester actifs lorsque le pointeur quitte le perso. L'adaptateur ne demande
pas la capture native du pointeur au navigateur : le routage global est le seul
circuit de suivi. Le `pointerId` de l'ouverture est conservé ; seuls les
événements déclarés dans `endOn` ferment la session. `pointercancel` et
`lostpointercapture` n'ont aucun effet particulier s'ils ne sont pas déclarés.
La cible peut être fournie avec `captureEventTarget` ; dans un navigateur, la
fenêtre du document de la racine HTML est utilisée par défaut. La destruction
du runner annule les sessions ouvertes.

Le runner n'embarque pas la sémantique `list` ni le DnD. Une démo peut brancher
`HtmlListDndPreview` comme couche HTML de prévisualisation ; elle ne modifie ni
le journal ni l'ordre logique. Le commit final passe par `RuntimePlayer`,
`move` et la capacité `list`.

L'hôte peut fournir à la preview l'ordre des enfants résolu par `list` avec
`resolveListItemNodes`; à défaut, les racines DOM directes marquées par le
materializer sont utilisées. Le perso saisi est toujours exclu de cet ordre
transitoire. Pour chaque cible, la preview capture une seule fois les rectangles
stabilisés des enfants de la liste candidate ; le FLIP des voisins réutilise cette
capture après l'insertion du ghost.

Pendant la prévisualisation, le perso saisi reste à son point de prise et le
ghost est le seul élément ajouté au flux. Les voisins reçoivent un FLIP HTML
temporaire. Au `pointerup`, le runner photographie la pose visible avant le
commit pour fournir le FIRST de `endEmit`. Cette photographie n'est ni un état
logique ni une entrée du journal. Le snapshot live est supprimé avant un seek.

Les nœuds temporaires portent `data-codplay-transient`. Le materializer les
exclut de la réconciliation structurelle et compare d'abord l'ordre des nœuds
auteur. La preview retire le marqueur à sa fermeture ; la frame suivante
réapplique alors l'ordre logique normal.

Avec `enableInteractionLock: true`, le runner verrouille la racine HTML tant que
le player n'est pas en lecture et rétablit son état initial à la destruction. La
telco doit être montée en dehors de cette racine.

## Ressources et resize

Les ressources de la scène peuvent être fournies au runner avec `resources` et
sont enregistrées dans l'engine du player visible :

```ts
const runner = new HtmlPlayerRunner({
  // ...compiledScene, root, rootTargets et catalog
  resources: compiledScene.requirements.resources,
})
```

Le preload n'est pas implicite dans `init()`. L'hôte choisit le manifeste et
appelle la capacité partagée :

```ts
const preload = createRuntimePreload({ cache: sharedPreloadCache })

await preload.load({
  manifest: [currentScene.resources, nextScene.resources],
  options: { mode: 'broadcast' },
})
```

Sighty et l'éditeur utilisent ce même appel et ne créent pas de loader
parallèle. La diffusion autonome peut appeler `runner.run()`, qui enchaîne
explicitement `preload.load()`, `init()` et `play()`.

Après un preload direct, l'hôte transmet les ressources disponibles à l'engine
avant `player.init()` et les métadonnées au runner :

```ts
engine.registerResources(currentScene.resources.entries.map((entry) => entry.url))
if (result.ok) runner.setResourceMetadata(result.data.metadata)
```

`RuntimePlayer.init()` et `HtmlPlayerRunner.init()` restent synchrones. Si un
engine externe pilote les frames, `run()` met le player en lecture mais lui
laisse l'avancement du temps.

Le facteur passé à `resize()` s'applique aux valeurs de longueur logiques
qualifiées et aux canaux numériques de transform explicitement reconnus, à la
frontière HTML. Par exemple, une longueur `cqw` de `20` devient `20px` avec un
facteur `1` et `40px` avec un facteur `2`. La qualification d'un nombre
`unitless` du contrat éditeur appartient à la compilation CodPlay ; le runner
ne déduit aucune unité. Les unités CSS opaques et les chaînes brutes de
`style.transform` restent inchangées.

```ts
const designWidth = 1440

const runner = new HtmlPlayerRunner({
  // ...compiledScene, root, rootTargets et catalog
})

function applyViewportZoom(): void {
  runner.resize(window.innerWidth / designWidth)
}

window.addEventListener('resize', applyViewportZoom)
applyViewportZoom()
```

Le runner réapplique la frame courante quand le facteur change ; il ne
reconstruit pas la scène compilée et ne rejoue pas la timeline. Le listener de
resize appartient à l'hôte et doit être retiré par celui-ci.

## Contrat et limites

- l'état logique n'est jamais reconstruit depuis le DOM visible ;
- aucun deuxième DOM, player, engine ou materializer n'est créé pour la capture
  de mouvement ;
- les instantanés de géométrie ne conservent aucune référence DOM ;
- chaque élément possède ses segments temporels indépendamment ;
- le mouvement d'un parent est composé récursivement à la résolution ;
- un reflow local recouvert recale le segment sur la pose visuelle déjà résolue
  sans redémarrer l'easing à zéro ;
- une seule source ou représentation indépendante est visible par élément ;
- la composition HTML utilise des origines affines et des matrices ;
  `rect.left/top` restent des valeurs AABB dérivées.
