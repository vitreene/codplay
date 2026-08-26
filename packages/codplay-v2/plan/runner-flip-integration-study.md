# CodPlay V2 — architecture du mouvement hiérarchique HTML

> Status: Fini — tranche HTML motion V2
> CodPlay version: V2 foundation
> Review: le contrat du graphe reste conservé ; la mesure par DOM dupliqué est retirée

## Objet unique

Cette tranche fournit le déplacement d'un élément entre des sources et cibles
arbitraires dans une hiérarchie d'éléments imbriqués, chacun pouvant suivre sa
propre animation à une phase temporelle indépendante.

Les positions FIRST et LAST dépendent du type de transition :

- pour un `move`, FIRST est le layout exact juste avant la frontière et LAST
  est le layout naturel immédiatement après l'événement ;
- pour une action qui anime une propriété de pose, FIRST est capturé au début de
  l'action et LAST à sa fin effective (`start + delay + duration`) ;
- la durée et le délai appartiennent au segment, ils ne déplacent jamais la
  frontière logique du `move`.

Play et Seek évaluent un circuit unique à un temps absolu `t`.

## Décisions fixées

### Source de vérité structurelle

`SolvedGraph` est l'unique source de parentage, target et ordre. Le DOM ne corrige
jamais le graphe et aucun module ne maintient un ordre historique alternatif.

`StructuralTimeline` réduit les frontières compilées en snapshots complets et
immutables `childrenByTarget`. Tous les consommateurs interrogent cette timeline.

### Persistance des materialisations auteur

Les elements et ressources crees pour un perso sont persistants pendant toute la
duree de la sequence/player, qu'ils soient actuellement montes ou detaches.
`mount`, `unmount`, reparentage et reorder sont des operations de structure et ne
detruisent jamais une materialisation auteur.

Play et Seek reutilisent les memes instances de composants et les memes elements.
Un seek ne detruit, ne recree et ne recharge donc pas les elements media ; il
reconcilie uniquement l'etat cible, le parentage et l'ordre.

La destruction des materialisations auteur intervient uniquement lors du teardown
final du player/sequence. Les clones d'overlay sont des ressources techniques
transitoires. Aucune materialisation auteur, aucun composant et aucun media ne
doit être créé dans un second arbre pour mesurer FLIP.

### Côtés d'une frontière

La frontière temporelle est un type sémantique, pas un epsilon :

```text
before(t) = événements dont startAt <  t
after(t)  = événements dont startAt <= t
```

`materializeSceneBeforeBoundary()` rend cette distinction valide même à `0 ms`.

### Modes de présentation

Les modes ont des usages distincts :

| Situation | Mode effectif | Présentation HTML |
|---|---|---|
| réordonnancement dans la même target/list | `local` | nœud source réel |
| changement de target ou de parent logique | `reparent` | overlay indépendant |
| `flipMode: 'overlay-world'` explicite | `reparent` | overlay indépendant |

`flipMode` est facultatif. L'absence de mode choisit `local` si la target reste
identique et `reparent` si elle change. Un `local` explicite ne peut pas dégrader
un vrai reparentage en présentation locale.

L'overlay est le procédé de présentation du mode reparent. Ce n'est ni un second
graphe ni un second algorithme temporel.

### Pas de bridge FLIP autonome

Le bridge autonome, les captures persistées et leur cache ont disparu du
périmètre V2. La géométrie affine HTML est une primitive interne au module
`motion`; elle n'expose aucun runtime de capture concurrent au runner.

## Architecture appliquée

```text
                         +----------------------+
CompiledScene ---------->| StructuralTimeline   |
       |                 | parent/target/order  |
       |                 +----------+-----------+
       |                            |
       +-> compileMotionSchedule    |
                    |               |
                    v               v
             event boundaries -> position capture on visible author nodes
                                      | before / after data snapshots
                                      v
                                buildMotionGraph
                                      |
                             MotionGraph by item
                                      |
                current natural layout + absolute t
                                      |
                                      v
                          resolvePresentationFrame
                                      |
                           +----------+----------+
                           |                     |
                       local host          reparent host
```

### 1. `StructuralTimeline`

Fichier : `src/runtime/player/structural-timeline.ts`.

La timeline part de l'état initial exclusif à `0`, parcourt chaque frontière
compilée dans l'ordre, applique les deltas de placement puis fige l'ordre complet.
Elle expose `resolveAt(t)` et `resolveBefore(t)`.

La capacité list n'est plus un reducer mutable. Son service runtime est un
marqueur ; la sémantique ordonnée appartient au graphe structurel commun.

### 2. `compileMotionSchedule`

Fichier : `src/runtime/motion/motion-schedule.ts`.

Le compilateur pur aplatit les eventimes, sélectionne la dernière commande d'un
item à une même frontière et produit les intentions directes. Il accepte aussi
un résolveur fourni par le materializer pour les actions qui animent une pose :

```ts
type ScheduledMotionIntent = {
  id: string
  itemId: string
  startAt: number
  delay: number
  duration: number
  endAt: number
  ease: string
  presentationMode: 'local' | 'reparent'
  path?: Path
}
```

Le player logique ne connaît ni ce calendrier, ni les overlays, ni leurs
ressources HTML. Le résolveur HTML ne lit pas le DOM : il reconnaît les
propriétés de layout/transform et transmet uniquement leur timing au schedule.

### 3. Capture géométrique sur les materialisations auteur

Fichiers :

- `src/runtime/runner-html/layout-snapshot.ts` ;
- `src/runtime/runner-html/player-runner.ts`.

La capture géométrique lit les nodes auteur persistants du root visible. Elle ne
crée ni root hors écran, ni `RuntimePlayer`, ni `RuntimeEngine`, ni
`RuntimeComponentMaterializer` auxiliaire. Pour chaque frontière, une phase de
capture présente successivement les états purs `before` et `after` sur les mêmes
materialisations, puis ne conserve que leurs données géométriques. Pour un
`move`, les deux états sont pris au même temps logique, de part et d'autre de
l'événement. Pour une action de pose, l'état `after` est pris à la fin effective
de son action, selon le délai et la durée compilés.

Cette phase est une transaction interne au runner : elle suspend les effets de
lecture, retire d'abord les contributions transitoires de la présentation
précédente, puis ne déclenche ni `play()`, ni rechargement de source, ni
destruction de composant. Elle restaure ensuite l'état courant du player avant
toute lecture ou seek visible.

Un `LayoutSnapshot` contient, par `itemId` :

- `parentItemId` logique ;
- `targetId` opaque ;
- pose affine locale au parent ;
- pose affine relative au root ;
- dimensions locales.

Le snapshot ne contient aucune référence DOM. Il contient uniquement les poses
et relations nécessaires au graphe. La sélection d'une frontière comprend les
items déplacés, les enfants des targets source et cible susceptibles de reflow,
puis ferme cette sélection sur toute la chaîne d'ancêtres jusqu'à `root`. Les
ancêtres sont donc présents comme données de composition et peuvent eux-mêmes
posséder une transition ; ils ne reçoivent pas automatiquement une seconde
trajectoire parce qu'un descendant les utilise. Les branches sans rapport ne
sont pas capturées.

La géométrie du navigateur reste nécessaire : une simple position logique ne
remplace pas les dimensions, matrices, transforms hérités, flex/grid, contenus
intrinsèques ou pourcentages calculés par le materializer HTML.

La capture peut lire le DOM visible pendant cette phase explicite ; le DOM reste
une source de géométrie uniquement. `SolvedGraph` reste l'unique source de
structure, parentage, target et ordre.

### 3 bis. Activation conditionnelle

Le runner compile d'abord le calendrier des transitions `move` et des actions de
pose reconnues par le materializer. S'il ne contient aucune transition, il
n'instancie ni système motion, ni capture géométrique, ni overlay FLIP. Un
`move` purement structurel sans transition ne demande pas de graphe motion.

Un move ajouté par un événement runtime active le même circuit avant sa mutation :
la position FIRST est capturée au point pré-commit, puis la position LAST après
la mutation. Il ne peut pas être découvert après coup sans perdre la source du
mouvement.

### 4. Graphe temporel par item

Fichiers :

- `src/runtime/motion/types.ts` ;
- `src/runtime/motion/motion-graph.ts` ;
- `src/runtime/motion/motion-pose.ts`.

`buildMotionGraph()` ferme d'abord le scope de chaque frontière sur les ancêtres,
afin de pouvoir remonter jusqu'à `root` pendant la résolution. Il compare ensuite
les deux snapshots sélectionnés. Un segment est créé lorsque l'attachement local
d'un mover direct ou d'un item de reflow change : parent, target, origine, matrice
ou dimensions. Un ancêtre de contexte reste résoluble comme pose naturelle ; il
n'est pas animé une seconde fois par le FLIP du descendant. Si cet ancêtre porte
sa propre intention de mouvement à la même frontière ou à une autre frontière,
son segment est conservé et composé récursivement.

Chaque segment appartient à exactement un item :

```ts
type MotionSegment = {
  itemId: string
  startAt: number
  delay: number
  endAt: number
  duration: number
  ease: string
  presentationMode: 'local' | 'reparent'
  from: MotionAttachment
  to: MotionAttachment
  direct: boolean
}
```

Un enfant dont l'attachement local ne change pas ne reçoit pas une trajectoire
dupliquée : il suit récursivement la pose résolue de son parent. Cette règle ne
code aucune profondeur maximale.

### 5. Parents mobiles et attachements dynamiques

La résolution remonte explicitement la chaîne parentale jusqu'à `root`. Les
endpoints ne sont pas des coordonnées monde figées. Un
`MotionAttachment` conserve la relation locale au parent source ou cible. À tout
temps `t`, le resolver :

1. résout la pose courante du parent source ;
2. compose le FIRST local avec cette pose ;
3. résout la pose courante du parent cible ;
4. compose le LAST local avec cette pose ;
5. interpole les deux résultats.

Les phases temporelles des parents et enfants peuvent donc être différentes.
Un parent reste souverain : une frontière enfant ne termine, n'annule et ne
recalcule jamais sa trajectoire.

Pour la présentation HTML, le parent effectif d'un item local est résolu en
remontant toute la chaîne capturée jusqu'au premier ancêtre actuellement
présenté. Les ancêtres intermédiaires qui ne possèdent pas de trajectoire
propre sont recomposés avec leur `localPose`. La profondeur de la chaîne est
illimitée ; aucun calcul de position ne suppose que le parent utile est
immédiat.

### 6. Chevauchement et retarget

Lorsqu'une nouvelle frontière affecte un item déjà animé, son nouveau FIRST est
la pose calculée par le graphe existant au temps exact de la frontière. Le
planner n'utilise pas la pose logique finale du segment précédent. Pour un
reflow local qui n'a pas son propre intent direct, le segment en cours conserve
son `startAt`, son `endAt`, son easing et sa phase ; seul son endpoint est
retargeté. Le graphe conserve ce retarget dans une liste de sous-frontières
immutables afin que l'ancien endpoint reste inchangé avant la frontière.

La pose source virtuelle du retarget est extrapolée à la phase courante dans la
même géométrie que l'interpolation : sans `path`, l'extrapolation est affine ;
avec `path`, elle résout aussi le point de départ canonique nécessaire pour que
le point courbe à cette phase soit exactement la pose visuelle courante. Ainsi,
le départ d'un autre item dans la même liste ne remet pas le sibling à une
easing de progression zéro et ne crée pas de palier visuel. Un intent direct de
l'item conserve sa propre ownership, son chemin et son timing.

Les segments restent indexés chronologiquement par item. Le plus récent segment
actif possède la pose de l'item, sans annuler les segments d'autres items ou de
ses ancêtres.

La timeline naturelle applique la même distinction : un item qui possède une
action future reste dans le snapshot s'il est un participant des targets source
ou cible d'un `move` structural en cours. Il peut ainsi recevoir le segment de
reflow de la liste. En revanche, un item direct capturé seulement dans la
fermeture d'ancêtres est une dépendance de composition ; son snapshot ne doit
pas remplacer la timeline naturelle de sa propre transition.

### 7. Résolveur absolu unique

`resolvePresentationFrame(graph, currentLayout, t)` est pur. Son résultat ne
dépend pas des temps précédemment visités.

Le layout courant est fourni par la timeline de snapshots capturés aux bornes.
Les mouvements auteur continus sont représentés par leurs propres segments dans
le graphe ; ils ne sont pas reconstruits par une lecture DOM entre deux frames.
Les slots locaux et les ressources overlay de la frame précédente sont retirés
avant toute capture ponctuelle afin que le layout lu soit naturel. Le graphe
apporte ensuite les segments structurels à partir de ces snapshots. Les parents
sont résolus récursivement avant leurs descendants.

`MotionMaterializer` appelle ce même resolver après chaque materialisation
structurelle. Le runner assemble une timeline de layouts naturels à partir des
snapshots déjà capturés aux frontières. Play et Seek ne sélectionnent aucune
stratégie différente. `present()` ne déclenche aucune capture géométrique et ne
crée aucun nœud DOM ; les lectures de géométrie restent bornées à
l'initialisation, aux fins d'action, aux FIRST/LAST de move, au resize et aux
invalidations explicites.

Lors d'un seek, le runner neutralise temporairement les transitions CSS auteur
sur le root visible pendant la transaction de materialisation. L'état cible est
ainsi appliqué sans rejouer une transition CSS résiduelle depuis la position
précédente, notamment sur `visibility`. Le verrou est retiré après le commit et
ne modifie aucune déclaration auteur persistante.

### 8. Présentation locale

Le host local écrit uniquement des slots CSS réservés sur les sources réelles.

Pour une frame complète :

1. retirer les anciennes contributions locales ;
2. écrire seulement les dimensions locales modifiées ;
3. résoudre les matrices parent-first à partir du graphe ;
4. écrire les transforms de présentation nécessaires ;
5. retirer les slots à LAST.

La stabilisation et la lecture géométrique appartiennent à la capture
transactionnelle des bornes, jamais à cette boucle de frame. Les dimensions
stables des ghosts sont conservées par ressource ; seules leurs dimensions
interpolées sont réécrites lorsqu'elles changent.

Dans le host local, l'inverse affine d'un parent est partagé par ses enfants au
sein d'un commit. La matrice locale déjà écrite est conservée par source et
n'est pas réappliquée lorsqu'elle est identique ; cette mémoire est supprimée
avec les slots locaux lors de la capture naturelle ou de la sortie du mode.

Cette transaction évite de calculer un sibling contre un layout seulement
partiellement mis à jour.

### 9. Présentation reparent par overlay

Le host reparent indexe les ressources par `itemId`, jamais par capture. Il masque
la source, clone son contenu auteur courant, applique la pose résolue dans la
couche overlay puis restaure la source à LAST.

La pose est localisée contre la géométrie mesurée de la couche overlay elle-même,
pas contre une hypothèse sur le root. Les bordures et transforms du root ne
créent donc pas de saut source/overlay.

L'inverse affine du root est calculé une seule fois par commit de frame puis
réutilisé pour toutes les poses overlay actives. Les dimensions interpolées des
ghosts ne sont écrites que lorsqu'elles changent ; la matrice de pose reste la
seule écriture overlay effectuée à chaque frame.

Un descendant qui possède une trajectoire indépendante en mode `reparent` est
masqué dans le clone de son ancêtre et reçoit une ressource overlay propre. Un
segment local situé sous un ancêtre overlay reste dans le ghost de cet ancêtre :
le host retrouve le descendant correspondant et lui applique ses slots locaux
dans ce sous-arbre. Il ne reçoit donc pas de ghost indépendant et ne change pas
de représentation pour des raisons techniques.

## Code retiré

La restructuration supprime les concepts suivants :

- `FlipCapture` et groupes de captures ;
- `captureId`, aliases et cache canonique ;
- replay historique de modules/list ;
- `HtmlPresentationTransaction` sur le DOM visible ;
- `HtmlFlipRuntime` et bridge FLIP autonome ;
- ownership/handoff mutable de ghosts ;
- `resolveFlipAncestorRegime` et coupes host ;
- touched sets utilisés comme contrats temporels ;
- chemins distincts de résolution Play et Seek ;
- second `measurementPlayer`, `measurementEngine` et `measurementRoot` ;
- matérialisations auteur auxiliaires destinées à produire des snapshots.

Le dossier `src/runtime/flip` a été supprimé. La géométrie restante vit dans
`src/runtime/motion/html-pose.ts` et `html-types.ts`.

## Invariants normatifs

1. Un `move` définit FIRST/LAST autour de sa frontière ; une action de pose
   définit FIRST au démarrage et LAST à sa fin effective.
2. Une frontière possède deux côtés explicites, sans epsilon.
3. Le graphe structurel est complet et unique à tout temps.
4. Chaque item possède ses propres segments temporels.
5. Un descendant inchangé suit récursivement son parent sans segment dupliqué.
6. Chaque parent conserve sa trajectoire et sa phase propres.
7. Un overlap local retargete depuis la pose visuelle résolue en conservant la
   phase du segment ; il n'est jamais réécrit rétroactivement avant sa frontière.
8. Une target différente force le mode reparent et donc l'overlay.
9. Une target identique choisit local par défaut.
10. Play et Seek appellent le même résolveur absolu et le même commit.
11. Une pose affine utilise origine et matrice ; `rect` n'est qu'une AABB dérivée.
12. Le DOM visible n'est jamais une source de structure ; il peut seulement être
    lu pendant une phase explicite de capture géométrique.
13. Un graphe motion ne contient aucune référence DOM ni materialisation auteur.
14. Sans transition `move` ni action de pose reconnue, aucune capture géométrique
    FLIP n'est initialisée.
15. Toute matrice locale est calculée dans le repère du parent CodPlay et
    soustrait l'origine de `localPose` dans ce même repère ; aucun offset du
    parent DOM intermédiaire n'entre dans le contrat motion.
16. Un descendant local d'un ancêtre overlay reste présenté dans le clone de
    cet ancêtre ; seuls les descendants `reparent` indépendants sont détachés.

## Validation appliquée

Les tests à conserver et à rejouer après la refonte couvrent notamment :

- parent source et parent cible animés indépendamment ;
- propagation récursive à cinq niveaux sans pistes enfant dupliquées ;
- overlap et retarget continu ;
- retarget de reflow sans remise à zéro de l'easing ;
- retarget d'une trajectoire courbe sans saut à la frontière ;
- indépendance à l'historique d'évaluation ;
- inférence local/reparent et override `overlay-world` ;
- frontière exclusive à `0 ms` ;
- ordre list reconstruit par la timeline structurelle.

La démo runner expose deux scénarios :

- reorder `[B, C, A] -> [A, B, C]` dans une même list : A/B/C locaux,
  aucun overlay ;
- P et Q reparentés simultanément dans une hiérarchie imbriquée : deux overlays
  indépendants, B/C locaux.

Inspection Safari effectuée aux frontières et par pas de `10 ms` :

- continuité locale à `800 ms` et `2200 ms` ;
- continuité source/overlay à `800 ms` après localisation dans la couche réelle ;
- résidu inférieur au sous-pixel à la limite gauche de `2200 ms` ;
- frame Play à `1467 ms` strictement identique à un Seek immédiat à `1467 ms` ;
- aucun overlay, masque ou transform transitoire après LAST.

La fixture stress contient désormais six enfants par liste (`Qa…Qf` et `Ka…Kf`),
présentés en deux rangées de trois. Les douze échanges alternés couvrent
`1200…6700 ms` avec un espacement de `500 ms`. Les transitions de Q/K utilisent
un arc orienté vers le centre de la page ; chaque enfant utilise deux arcs
pseudo-aléatoires générés par son identifiant, donc stables entre Play et Seek.
Le contrôle `Ke` autour de `6200 ms` couvre aussi une frontière simultanée : son
chemin reste continu lorsque `Qf` provoque le reflow de la liste. La continuité
finale `8990→9000 ms` est maintenant résolue par les segments des ancêtres B/D
et ne demande aucune capture intercalaire.

Le stage de stress remplit désormais exactement la zone de présentation
responsive (`100%` en largeur et en hauteur). Les conteneurs A–D utilisent des
ancres et des déplacements verticaux en pourcentage du root, tout en conservant
leur taille de stress fixe pour préserver les deux rangées Q/K. Un
`ResizeObserver` invalide le graphe mesuré après chaque changement de taille du
stage, au temps logique courant ; avant cette invalidation, le runner retire les
slots motion et les ghosts afin de ne jamais capturer une ancienne frame comme
une nouvelle géométrie.
Safari a vérifié un redimensionnement au milieu de la scène (`t=5000 ms`) entre
les viewports `900×656`, `850×578` et `1024×786` : les représentations actives
restent présentes, aucune racine de mesure n'est créée, et les checkpoints
`BOUNDARY` et `LAST` restent navigables.

## État de revue

Le graphe, ses frontières et son résolveur sont le contrat de la tranche HTML
clôturée. La mesure par second arbre DOM est proscrite ; la capture géométrique
transactionnelle décrite ci-dessus est le seul chemin HTML. Les materializers
SVG, Canvas et Three.js relèvent de tranches ultérieures et ne conditionnent pas
la clôture de ce runner.

### Contrôle de cette passe — 2026-08-25

La démo `flip-stress` reste inchangée et sert de repère visuel final. Elle a été
rejouée sur les états `BOUNDARY`, `MIDDLE`, `LAST`, après resize et après seeks
non monotones. `C` et `D` restent visibles après `1000 ms`, les items Q/K
conservent leur ordre parent-enfant et aucun ghost, masque ou slot transitoire
ne subsiste à `10000 ms`.

Le schedule V2 traite maintenant les deux sources de mouvement du runner HTML :
`move.transition` et les actions de pose `style` reconnues par le materializer.
Pour ces dernières, la capture prend FIRST au début de l'action et LAST à son
endpoint effectif ; le graphe conserve ensuite le délai et la durée. Les
ancêtres restent dans la fermeture de données et leurs propres segments sont
composés récursivement, sans piste FLIP ajoutée par simple propagation.

La suite V2 passe à 71 fichiers et 438 tests. Un test ciblé de
`motion-graph.spec.ts` verrouille le cas causal : un enfant reparenté termine
sur la pose intermédiaire de son ancêtre de destination, et non sur le FIRST
de cet ancêtre. `typecheck`, la suite complète, le build du runner HTML et
`git diff --check` sont verts.

La vérification Safari a rejoué la démo réelle aux bornes `0`, `1000` et
`9000 ms`. À `1000 ms`, Q et K restent présentés depuis leurs positions FIRST
respectives tandis que C et D sont montés ; à `9000 ms`, les overlays ont
disparu et Q/K sont revenus dans leurs cibles naturelles. Aucun warning ni
error de console n'a été relevé.

### Correction de régression — reflow alterné des listes — 2026-08-23

La démo `flip-stress` lance bien un item de Q ou K toutes les `500 ms`. La
timeline naturelle excluait auparavant les futurs movers de chaque snapshot,
alors que ces items sont précisément les voisins qui doivent accompagner le
déplacement courant. À `1200 ms` et `1700 ms`, `Qb…` et `Ka…` recevaient donc
directement leur nouvelle position naturelle.

La sélection conserve désormais les participants des targets source et cible
pour les moves structurels, tout en maintenant l'exclusion des ancêtres capturés
uniquement comme dépendances. Le graphe existant fournit alors les segments
locaux des voisins ; aucun circuit de reflow distinct n'est ajouté.

Vérification Safari : les positions de A, Q et K restent continues entre
`999/1000/1001 ms`, et les voisins portent une transformation locale aux
frontières `1200 ms` et `1700 ms`. Les logs temporaires utilisés pour isoler la
régression ont été retirés.

### Pose naturelle des ancêtres HTML

La fermeture du graphe inclut chaque ancêtre jusqu'à `root`. Un ancêtre qui
possède sa propre transition reste résoluble sans recevoir une piste FLIP
dupliquée ; un descendant dont l'attachement local ne change pas compose la
pose de cet ancêtre. Les poses naturelles nécessaires sont capturées aux bornes
des actions et des moves, puis conservées sous forme de données.

Ce contrat interdit toute lecture de la fermeture à chaque frame et tout second
DOM d'analyse. La timeline naturelle assemblée par `motion-layout.ts` fournit le
layout retenu à `present()`, tandis que les segments du graphe portent les
intermédiaires des parents et des descendants.

### Ancêtre absent au FIRST, présent au LAST

Un perso détaché reste dans le graphe logique avec son `parentByPerso` et son
`targetByPerso`. Il ne figure pas dans `childrenByTarget`, dans l'ordre DOM ou
dans les racines présentées tant que son montage effectif est faux. Un outlet
interne conserve donc son propriétaire de scène même lorsque celui-ci est
détaché ; il n'est pas traité comme un outlet externe simplement parce que son
nœud n'est pas présent.

Lorsqu'un mover direct est absent au FIRST uniquement parce qu'un ancêtre est
détaché, mais que le mover et la chaîne source sont disponibles au LAST, la
capture géométrique prépare ponctuellement un état hybride : l'état FIRST du
mover est présenté dans le contexte des ancêtres montés au LAST. Cette
composition sert uniquement à obtenir son attachement source exact ; elle
réutilise les materialisations persistantes, ne crée aucun arbre DOM d'analyse,
et restaure immédiatement l'état LAST avant de capturer le snapshot final.

Cette composition est limitée au mover absent et à sa fermeture d'ancêtres. Elle
ne fusionne jamais le snapshot complet de la scène : deux movers réunis à la
même frontière gardent chacun leur FIRST. Pour une action de pose qui monte son
perso à `startAt`, FIRST est au contraire l'état monté à `startAt`, avec les
valeurs initiales de l'action ; LAST reste son endpoint à
`startAt + delay + duration`. Ce segment de pose reste disponible pour composer
la trajectoire d'un enfant reparenté, sans créer une piste FLIP supplémentaire
pour le parent.

La règle ne décale pas l'événement, ne force pas `visibility`, ne monte pas
l'état absent dans la présentation normale et ne fabrique pas de source si la
chaîne source n'est pas disponible au LAST. La démo doit continuer à exposer
ces cas limites, notamment `K -> D` au FIRST puis `K -> C` au LAST à la même
frontière.

### Correction de régression — FIRST concurrent et parent animé — 2026-08-25

La capture hybride de `K -> C` réécrivait auparavant tout le snapshot FIRST
avec le contexte utilisé pour mesurer K. Q était donc déjà remplacé par son
état B à `t=1000`, sans overlay visible. La fusion est maintenant limitée à K
et à ses ancêtres ; Q conserve son FIRST A et son overlay démarre à sa position
source.

C et D sont capturés dans l'état monté au FIRST de leur action de révélation,
puis à leur LAST. Leur trajectoire de pose est ainsi disponible dans le graphe
pour composer la destination de K, sans lecture DOM pendant la présentation et
sans duplication d'arbre d'analyse.

### Correction de régression — ordre et dimensions overlay

La synchronisation in-place d'un ghost réinitialise ses dimensions mémorisées
avant le commit suivant. L'ordre parent-enfant est réappliqué par déplacement
des ghosts existants et les masques de descendants sont recalculés lorsque la
fermeture active change. Ces opérations ne créent pas de nœud pendant la boucle
de présentation. La décision de neutraliser les longhands de transform est
capturée à la création d'une représentation et réappliquée sans lecture de
style lors d'une synchronisation in-place.

La vérification visuelle Safari à `LAST` conserve `C` et `D`, l'ordre parent-
enfant et les positions Q/K du repère. Aucun nœud de mesure n'est créé et la
lecture géométrique reste limitée aux bornes explicites.

### Référence visuelle de non-régression — 2026-08-23

La démo `flip-stress` est actuellement fonctionnelle et constitue la référence
visuelle finale des évolutions de cette intégration. Elle doit être utilisée telle
quelle pour contrôler Play, Seek, resize, reparent, l'ordre parent-enfant et la
persistance des représentations.

La démo n'est pas un endroit où compenser une lacune du runner : aucune
modification de son scénario, de son timing ou de sa structure ne doit servir à
faire passer un test. Toute divergence observée doit être corrigée dans le
pipeline V2 ou signalée comme un écart de contrat avant modification.

## Repasse de cohérence et optimisation — 2026-08-23

### Représentation `reparent`

Le clonage d'un sous-arbre dans l'overlay n'est pas une capture géométrique. Il
sert à maintenir simultanément deux contraintes : le materializer conserve le
nœud auteur dans son parent logique, tandis que la présentation animée peut
être rendue dans un autre repère. Supprimer systématiquement ce clone
imposerait soit de déplacer temporairement le nœud auteur, soit de créer un
placeholder structurel pour chaque racine de composant. Ces deux options
perturberaient la persistance des materialisations, les fragments multi-racines
et les composants média.

L'optimisation recevable est donc la réutilisation d'une représentation overlay
existante par `itemId`, et non la suppression générale du clone. Le host conserve
désormais le clone entre les frames, synchronise ses attributs et ses nœuds texte
quand la structure reste identique, et ne recrée le sous-arbre qu'à l'entrée du
mode ou après une invalidation structurelle. La révision logique fournie par le
runner évite de parcourir le template quand l'état auteur n'a pas changé.

### Séparation capture naturelle / commit de frame

La préparation de capture naturelle reste nécessaire avant une lecture de
géométrie : les tailles, transforms et masques de la frame précédente ne doivent
pas contaminer la nouvelle capture. Le host ne détruit toutefois plus les
ressources overlay persistantes à cette étape ; elles sont hors flux et peuvent
être réutilisées par le commit suivant.

Cette préparation invalide aussi la clé de masquage des descendants clonés.
Après chaque capture, le commit réapplique donc le masquage des enfants
présentés individuellement dans le ghost de leur parent. Sans cette
invalidation, le contenu de `transfer-items` réapparaissait sous les overlays
des items en mouvement et produisait un doublonnage visuel.

La séparation est maintenant :

1. une préparation explicite de capture naturelle, appelée avant les captures
   FIRST/LAST et après un resize ;
2. un commit normal qui conserve et réconcilie les ressources locales et overlay
   déjà actives ;
3. un nettoyage complet réservé à la destruction ou à une libération de mode.

Cette séparation préserve le nettoyage complet lors d'un changement de mode ou
d'une destruction et évite toute création DOM dans la boucle de présentation
normale.

La capture naturelle n'est pas une opération de frame dans le contrat cible.
`present()` consomme les snapshots de frontière et l'état de présentation
conservé par le materializer ; il ne relit pas le DOM, ne recalcule pas les
ancêtres et ne reconstruit pas les sources. Une nouvelle capture reste demandée
seulement à une frontière ou après une invalidation explicite (initialisation,
resize, changement structurel ou clôture d'une capture live).

Pendant cette phase de capture, les sources overlay sont restaurées dans leur
état auteur et les ghosts conservés sont masqués. Ils restent réutilisables,
mais ne peuvent jamais participer visuellement à la lecture FIRST/LAST. Le
commit suivant retire ces masques avant de rétablir la présentation courante.

La révision logique de l'état auteur reste limitée aux items overlay actifs :
elle sert à décider si le template réutilisé doit être synchronisé. Elle ne
participe pas au calcul de pose et ne lit pas le DOM. La synchronisation in-place
ne recrée pas le ghost ; sa décision de neutralisation des longhands de
transform est conservée et réappliquée sans nouvelle lecture de style.

Le ghost n'écrit pas les longhands `translate`, `rotate` et `scale` lorsqu'ils
sont à leur valeur CSS neutre. Ils ne sont neutralisés par `none` que si la
valeur auteur est non neutre et risquerait de se composer avec la matrice de
présentation. La propriété `transition` n'est pas modifiée par ce nettoyage.

### Preview DnD

`HtmlListDndPreview` n'est pas une seconde capture géométrique : il intervient
pendant le geste, avant le commit logique du `move`, pour résoudre le hit-test,
placer le ghost et animer les voisins. Il ne doit donc pas être remplacé par
`HtmlMotionSystem`, qui résout une scène déjà committée à un temps absolu.

Les optimisations sans changement de contrat sont : limiter les mesures aux
listes candidates et au slot dont la cible a changé, conserver les rectangles
jusqu'à l'invalidation par déplacement du ghost ou resize, et réutiliser le
ghost déjà créé. Les primitives de rectangle stabilisé et de transition FLIP
sont maintenant isolées dans `transient-flip.ts`, afin d'être partagées
par les previews HTML sans dupliquer leur algorithme. La décision de cible et le
cycle de capture restent dans la capacité `list`/preview.

Pour une résolution de cible, les rectangles stabilisés des enfants sont
capturés une seule fois puis transmis à l'application de la cible. Le FLIP des
voisins réutilise cette capture après l'insertion du ghost ; il ne relit pas une
seconde fois les mêmes enfants dans le même cycle de résolution.

### Correction de régression — ordre et masques overlay

La réutilisation a d'abord laissé deux états transitoires vivre au-delà de la
frame qui les avait produits : les sources masquées pouvaient contaminer la
capture naturelle, et un descendant rendu séparément pouvait rester masqué
dans le ghost de son ancien parent. La boucle de commit recréait aussi
implicitement l'ordre DOM en recréant les ghosts.

Le contrat corrigé est explicite :

- `prepareNaturalCapture()` retire les masques des sources overlay et les
  masques de descendants suivis avant toute lecture de géométrie ;
- `commit()` réordonne les ghosts existants selon `orderParentFirst` par
  déplacement DOM, sans création de nœud ;
- les masques de descendants indépendants sont enregistrés pour la frame
  courante, puis retirés avant d'appliquer le nouvel ensemble ;
- un ghost stable reste donc réutilisable sans conserver une relation
  parent/enfant obsolète.

Le test de régression couvre l'ajout tardif du parent, le réordonnancement
parent puis enfant et le retrait du masque après disparition de l'enfant
indépendant. Safari a été vérifié sur les passages `1930 ms`, `7200 ms`,
`9000 ms`, puis retour à `7200 ms`.

### Rebuild des frontières

`init()`, `resize()` et la fermeture d'une capture reconstruisent plusieurs fois
les frontières parce que deux vues sémantiques doivent rester distinctes :

- `replayMotionBoundaries` inclut les faits `persist-only` pour le seek ;
- `presentationMotionBoundaries` décrit la tête de lecture courante et peut
  inclure la remise live `endEmit`.

Ces tableaux ne doivent pas être fusionnés. En revanche, la compilation du
schedule, la capture des frontières et l'affectation au système de mouvement
peuvent être regroupées dans une orchestration commune, avec un paramètre
explicite pour la vue demandée. La capture live FIRST reste un chemin distinct,
car elle provient de la pose visible avant le commit et non de
`resolveSceneBeforeBoundary()`.

### Documentation historique

`projet/notes/2026-08-02-flip-reprise.md` est une archive et ne doit plus être
lu comme un contrat : il conserve des noms supprimés tels que `HtmlFlipRuntime`
et `FlipCapture`. Le contrat courant est celui du présent plan et des README de
`runner`, `motion` et `player`.

### Correction de régression — repère local et descendants Q/K

La présentation locale soustrayait un offset mesuré par rapport au parent DOM
immédiat, alors que sa matrice était calculée par rapport au parent CodPlay.
Avec un wrapper intermédiaire — notamment la grille `transfer-items` — ces deux
repères diffèrent et créent un saut lors du passage d'un descendant local à son
overlay `reparent`. Le snapshot conserve uniquement `localPose`, déjà exprimée
dans le repère du parent CodPlay ; le host réutilise cette origine pour écrire
la matrice locale. Aucun offset DOM intermédiaire n'est exposé ni relu pendant
la présentation.

La présentation reparent ne promeut plus automatiquement tous les enfants
locaux d'un ghost. Les enfants Q/K dont la target reste identique sont animés
dans le descendant correspondant du ghost Q/K. Un enfant qui change lui-même de
parent ou de target conserve son overlay indépendant et son masque dans le ghost
ancêtre. La démo `flip-stress` vérifie ainsi à `FIRST`, `MIDDLE` et `LAST` que
B/C/D restent visibles, que les ghosts indépendants sont limités aux items
reparentés et qu'il n'y a pas de ghost résiduel à `LAST`.

### Optimisation — sortie par trajectoire propriétaire — 2026-08-23

La préparation du graphe distingue maintenant la fermeture de données et la
sortie de présentation. Les ancêtres et descendants inchangés restent présents
dans les `LayoutSnapshot` pour permettre une composition exacte, mais
`MotionGraph.presentationItemIds` ne retient comme sorties que les items qui
possèdent effectivement une trajectoire `move`/reflow/action. Le resolver garde
les poses parent nécessaires dans un cache privé le temps de calculer l'item
demandé ; il ne construit plus d'`ItemPresentation` pour chaque ancêtre ou
chaque élément statique de la scène.

Le host HTML utilise ensuite `LayoutSnapshot` pour les parents statiques absents
de la frame, et ne demande une présentation locale ou overlay qu'aux propriétaires
de trajectoire. Une trajectoire d'ancêtre continue donc de déplacer naturellement
ses enfants via le DOM ou le ghost déjà existant, sans fabriquer des trajectoires
enfants ni des entrées de frame supplémentaires.

Cette optimisation ne remplace pas la composition hiérarchique par une
interpolation monde approximative : si un parent et son enfant ont chacun une
transition, la pose courante de l'enfant continue d'intégrer la trajectoire du
parent, mais cette pose intermédiaire reste une dépendance interne. Les tests
conservent les cas de parents indépendants, de reparentage et de retarget.
