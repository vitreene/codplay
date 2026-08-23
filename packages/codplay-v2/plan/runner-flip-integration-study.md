# CodPlay V2 — architecture du mouvement hiérarchique HTML

> Status: En cours — refonte de la capture géométrique
> CodPlay version: V2 foundation
> Review: le contrat du graphe reste conservé ; la mesure par DOM dupliqué est retirée

## Objet unique

Cette tranche fournit le déplacement d'un élément entre des sources et cibles
arbitraires dans une hiérarchie d'éléments imbriqués, chacun pouvant suivre sa
propre animation à une phase temporelle indépendante.

Les positions FIRST et LAST sont les conséquences directes de l'événement :

- FIRST est le layout exact juste avant la frontière ;
- l'événement est inclus ;
- LAST est le layout naturel immédiatement après cette frontière ;
- la durée anime entre ces deux layouts, mais ne choisit jamais un état futur.

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
item à une même frontière et produit les intentions directes :

```ts
type ScheduledMotionIntent = {
  id: string
  itemId: string
  startAt: number
  duration: number
  ease: string
  presentationMode: 'local' | 'reparent'
  path?: Path
}
```

Le player logique ne connaît ni ce calendrier, ni les overlays, ni leurs
ressources HTML.

### 3. Capture géométrique sur les materialisations auteur

Fichiers :

- `src/runtime/runner/html-layout-snapshot.ts` ;
- `src/runtime/runner/html-player-runner.ts`.

La capture géométrique lit les nodes auteur persistants du root visible. Elle ne
crée ni root hors écran, ni `RuntimePlayer`, ni `RuntimeEngine`, ni
`RuntimeComponentMaterializer` auxiliaire. Pour chaque frontière `t`, une phase
de capture présente successivement les états purs `before(t)` et `after(t)` sur
les mêmes materialisations, puis ne conserve que leurs données géométriques.

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
les ancêtres nécessaires à la composition et les descendants nécessaires lorsqu'un
parent les entraîne. Les branches sans rapport ne sont pas capturées.

La géométrie du navigateur reste nécessaire : une simple position logique ne
remplace pas les dimensions, matrices, transforms hérités, flex/grid, contenus
intrinsèques ou pourcentages calculés par le materializer HTML.

La capture peut lire le DOM visible pendant cette phase explicite ; le DOM reste
une source de géométrie uniquement. `SolvedGraph` reste l'unique source de
structure, parentage, target et ordre.

### 3 bis. Activation conditionnelle

Le runner compile d'abord le calendrier des transitions `move`. S'il ne contient
aucune transition, il n'instancie ni système motion, ni capture géométrique, ni
overlay FLIP. Un `move` purement structurel sans transition ne demande pas de
graphe motion.

Un move ajouté par un événement runtime active le même circuit avant sa mutation :
la position FIRST est capturée au point pré-commit, puis la position LAST après
la mutation. Il ne peut pas être découvert après coup sans perdre la source du
mouvement.

### 4. Graphe temporel par item

Fichiers :

- `src/runtime/motion/types.ts` ;
- `src/runtime/motion/motion-graph.ts` ;
- `src/runtime/motion/motion-pose.ts`.

`buildMotionGraph()` compare les deux snapshots sélectionnés de chaque frontière. Il
crée un segment lorsque l'attachement local d'un item change : parent, target,
origine, matrice ou dimensions.

Chaque segment appartient à exactement un item :

```ts
type MotionSegment = {
  itemId: string
  startAt: number
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

Les endpoints ne sont pas des coordonnées monde figées. Un
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

### 7. Résolveur absolu unique

`resolvePresentationFrame(graph, currentLayout, t)` est pur. Son résultat ne
dépend pas des temps précédemment visités.

Le layout courant apporte les mouvements auteur continus et le reflow naturel au
temps `t`; il est capturé sur les nodes visibles uniquement lorsqu'une
présentation motion active en a besoin. Avant cette capture, les slots locaux et
les ressources overlay de la frame précédente sont retirés afin que le layout
lu soit naturel. Le graphe apporte les segments structurels à partir des
snapshots déjà capturés. Les parents sont résolus récursivement avant leurs
descendants.

`MotionMaterializer` appelle ce même resolver après chaque materialisation
structurelle. Play et Seek ne sélectionnent aucune stratégie différente.

### 8. Présentation locale

Le host local écrit uniquement des slots CSS réservés sur les sources réelles.

Pour une frame complète :

1. retirer les anciennes contributions locales ;
2. écrire toutes les dimensions actives ;
3. laisser le layout se stabiliser synchroniquement ;
4. résoudre les matrices parent-first ;
5. écrire les transforms ;
6. retirer les slots à LAST.

Cette transaction évite de calculer un sibling contre un layout seulement
partiellement mis à jour.

### 9. Présentation reparent par overlay

Le host reparent indexe les ressources par `itemId`, jamais par capture. Il masque
la source, clone son contenu auteur courant, applique la pose résolue dans la
couche overlay puis restaure la source à LAST.

La pose est localisée contre la géométrie mesurée de la couche overlay elle-même,
pas contre une hypothèse sur le root. Les bordures et transforms du root ne
créent donc pas de saut source/overlay.

Un descendant qui possède une trajectoire indépendante est masqué dans le clone
de son ancêtre. Un segment local situé sous un ancêtre overlay est présenté par
une ressource overlay propre, car son nœud réel est contenu dans une source
masquée. Seule la représentation change ; le segment reste local dans le graphe.

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

1. Un événement définit FIRST et LAST ; la durée ne sélectionne pas LAST.
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
14. Sans transition `move`, aucune capture géométrique FLIP n'est initialisée.

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
`1200…6700 ms` avec un espacement de `500 ms`. Avec un viewport plus haut, la
continuité `8990→9000 ms` de Q/K reste inférieure à `0,002 px`, sans débordement
des transferts et avec overlay vide après LAST. Les transitions de Q/K utilisent
un arc orienté vers le centre de la page ; chaque enfant utilise deux arcs
pseudo-aléatoires générés par son identifiant, donc stables entre Play et Seek.
Le contrôle `Ke` autour de `6200 ms` couvre aussi une frontière simultanée : son
chemin reste continu lorsque `Qf` provoque le reflow de la liste. Les arcs
quantifiés de Q/K restent également à moins de `0,002 px` de leur cible à
`8999,9 ms`, avant la libération exacte des overlays à `9000 ms`.

Le stage de stress remplit désormais exactement la zone de présentation
responsive (`100%` en largeur et en hauteur). Les conteneurs A–D utilisent des
ancres et des déplacements verticaux en pourcentage du root, tout en conservant
leur taille de stress fixe pour préserver les deux rangées Q/K. Un
`ResizeObserver` invalide le graphe mesuré après chaque changement de taille du
stage, au temps logique courant ; avant cette invalidation, le runner retire les
slots motion et les ghosts afin de ne jamais capturer une ancienne frame comme
une nouvelle géométrie.
Safari a vérifié un redimensionnement au milieu de la scène (`t=5000 ms`) entre
les viewports `900×656`, `850×578` et `1024×786` : les 13 représentations
actives restent présentes, aucune racine de mesure n'est créée, et les
checkpoints `BOUNDARY` et `LAST` restent navigables.

## État de revue

Le graphe, ses frontières et son résolveur restent le contrat conservé. La
mesure par second arbre DOM est proscrite et doit être remplacée par la capture
géométrique transactionnelle décrite ci-dessus. Les tests de Play, Seek, resize,
reparent et événements runtime devront être rejoués avant de repasser ce module
à `Fixe`.

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

La séparation est maintenant :

1. une préparation explicite de capture naturelle, appelée avant les captures
   FIRST/LAST et après un resize ;
2. un commit normal qui conserve et réconcilie les ressources locales et overlay
   déjà actives ;
3. un nettoyage complet réservé à la destruction ou à une libération de mode.

Cette séparation préserve le nettoyage complet lors d'un changement de mode ou
d'une destruction et évite toute création DOM dans la boucle de présentation
normale.

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
sont maintenant isolées dans `html-transient-flip.ts`, afin d'être partagées
par les previews HTML sans dupliquer leur algorithme. La décision de cible et le
cycle de capture restent dans la capacité `list`/preview.

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
