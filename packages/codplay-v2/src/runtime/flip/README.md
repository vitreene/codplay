# FLIP HTML V2

Status: En cours  
CodPlay version: V2 foundation

## Rôle

Ce module fournit la capacité FLIP pour une projection HTML. Il calcule et
projette la pose visuelle d'un ensemble d'items avant et après une mutation.

FLIP ne possède pas :

- la politique d'une liste ;
- la politique de déplacement ;
- la décision de parentage logique ;
- un composant ;
- une horloge ou une boucle de frames ;
- une scène ou un player complet.

Un consommateur fournit une mutation et un ensemble stable d'items touchés. FLIP
capture les poses, résout leur évolution et demande au host d'appliquer les poses
résolues.

Le runner HTML associe aussi chaque entrée à ses targets logique FIRST/LAST
(`sourceTargetId` et `destinationTargetId`). FLIP ne décide pas du parentage,
mais cette provenance empêche une mesure de perdre l'ownership entre les deux
états. Une entry `overlay-world` porte en plus le target FIRST de ses descendants
clonés (`overlayTargetByPerso`) : la fin d'une transition enfant ne restaure un
clone que dans le ghost qui possède sa cible LAST.

## Frontières

```text
consommateur HTML
  -> FlipCaptureRequest
  -> capture FIRST / mutation / LAST
  -> FlipCapture numérique
  -> pose graph hiérarchique
  -> HtmlFlipProjection
  -> projection HTML
```

Le consommateur décide quels items sont concernés par la mutation. FLIP ne déduit
pas cet ensemble depuis le DOM.

FLIP ne dépend pas de `codplay` V1. Le host de démo est fourni séparément par
`HtmlDomProjection` ; le package `selection-frame` reste une application V1 qui
peut consommer la démo, mais n'est pas une dépendance du runtime V2.

## Vocabulaire

### Item

Un item est une cible HTML animée par une capture FLIP. Il est identifié par un
`itemId` et peut être associé à une chaîne d'ancêtres.

### Ancêtre

Un ancêtre est un conteneur dont la pose influence celle de l'item. Les
`ancestorIds` d'un item sont ordonnés de la racine vers le parent immédiat.

### Régime d'ancêtre

`FlipAncestorRegime` décrit le comportement géométrique de l'ancêtre. Le terme
`layout` désigne ici un **régime de reflow**, et non le composant
`LayoutComponent`.

| Régime | Résolution |
|---|---|
| `stable` | La pose est considérée comme fixe pendant la capture. |
| `composited` | La pose est composée et interpolée par les matrices. Ce régime couvre notamment `translate`, `rotate` et `scale`. |
| `layout` | La géométrie réelle doit être réalisée et capturée par le host à l'instant demandé. Ce régime couvre notamment les changements de dimensions et les reflows. |

Le host déclare le régime. FLIP ne tente pas de deviner qu'une propriété CSS
produit un reflow.

### Modes d'item

| Mode | Usage |
|---|---|
| `local` | L'item reste dans le même contexte de parentage et sa pose est appliquée dans le repère local de son parent. |
| `overlay-world` | L'item change de conteneur ou doit être projeté indépendamment de son parent pendant la transition. |

## Capture

Une capture est une transaction unique :

1. FLIP capture les poses FIRST de tous les items touchés et des ancêtres déclarés.
2. Le consommateur exécute une seule mutation.
3. FLIP capture les poses LAST.
4. FLIP produit un `FlipCapture` qui ne contient que des valeurs numériques et des
   identifiants.

Une capture persistée ne contient ni node DOM, ni handle, ni closure. Les
templates DOM sont conservés dans un registre runtime séparé, par capture et par
item; ils ne font pas partie de la donnée numérique sérialisable. La capture est
valide uniquement pour son `hostContextId` et sa `projectionEpoch`.

Le template FIRST sert de base à la création et à la réactivation d'un ghost. Une
fois le ghost actif, son contenu n'est pas figé dans cet instant FIRST : le runner
le resynchronise à chaque commit avec les descendants et targets de la scène
logique courante. La pose géométrique reste celle de la capture; seul le subtree
et sa table de références sont reconstruits. Cette distinction est nécessaire
quand un parent continue sa trajectoire tandis que ses enfants changent de liste.

```ts
type FlipCaptureRequest = {
  captureId: string
  hostContextId: string
  projectionEpoch: number
  startAt: number
  duration: number
  ease?: string
  entries: readonly FlipEntry[]
  ancestors?: readonly FlipAncestorEntry[]
  mutate: () => void
}
```

Le runner HTML V2 utilise une frontière transactionnelle unique pour toute
réalisation de capture, que l'appel initial provienne de Play ou de Seek :

```text
HtmlPresentationTransaction
  -> presentation explicite FIRST
  -> read FIRST groupe
  -> capture des templates FIRST world
  -> presentation explicite LAST
  -> read LAST groupe
  -> HtmlMeasurementTree immuable
  -> HtmlFlipRuntime.recordMeasurementTree()
  -> seekCached(capture, timeMs)
```

`FlipCaptureRequest` reste l'API générique de capture/mutation pour les
consommateurs autonomes. Le chemin runner ne transmet pas de callback `mutate` au
coordinateur FLIP et Play/Seek réutilisent le même cache numérique.

Une capture runner groupée peut conserver `sourceCaptureIds`, c'est-à-dire les
identités d'occurrences compilées couvertes par la même mesure. Le cache reconnaît
alors la capture groupée pour chacune de ces occurrences et n'en relance pas une
réalisation froide lors d'une capture descendante suivante.

Le cache est canonique par rapport à ces identités: lorsqu'une capture groupée
arrive après des captures unitaires, elle les remplace; une capture unitaire
arrivée ensuite ne peut pas rétrograder la réalisation groupée. Un index interne
`identité -> capture canonique` évite de rescanner ou d'insérer plusieurs fois le
même groupe, et l'insertion est atomique lorsqu'un downgrade est refusé.
`HtmlFlipRuntime` compare ces identités lors de la réconciliation et conserve le
handle de ghost parent déjà actif au remplacement d'un alias.

Le runtime refuse les captures qui présentent :

- un host ou un epoch différent ;
- un item ou un ancêtre dupliqué ;
- un parent d'ancêtre absent ;
- un cycle d'ancêtres ;
- une chaîne d'ancêtres incohérente ;
- un handle absent au moment de la capture.

## Résolution de pose

La résolution suit une seule pose graph, de la racine vers la feuille :

```text
capture + chaîne d'ancêtres + t
  -> poses des ancêtres
  -> pose locale de l'item
  -> composition parent / enfant
  -> pose finale de l'item
```

La pose d'un item local est calculée dans le repère de son parent puis composée
avec la matrice parent résolue. Un item `overlay-world` ignore cette chaîne locale
pour interpoler directement ses poses FIRST et LAST dans l'espace monde.

### Ownership hiérarchique

La chaîne d'ancêtres décrit le graphe de coordonnées; elle ne confère pas à une
capture enfant le droit d'animer ses conteneurs. Un conteneur devient une entry
animée uniquement lorsqu'il est le mover direct de sa propre capture. Les
captures concurrentes sont résolues de la racine vers la feuille : l'enfant
peut mesurer avec la pose courante du parent, mais ne peut ni remplacer,
réinitialiser ni annuler sa trajectoire.

Dans un groupe `overlay-world`, le mover direct est projeté indépendamment dans
l'espace monde. Les siblings ajoutés pour le reflow (`isDirectMover: false`)
conservent bien un ghost propre, mais leur pose est résolue dans le repère du
ghost parent actif : leurs FIRST/LAST deviennent des poses relatives au parent,
puis la pose relative interpolée est composée avec la pose courante du parent à
chaque commit. Ils ne recalculent donc pas la trajectoire du parent et ne la
subissent pas comme une seconde interpolation monde concurrente. Les ghosts
parents masquent les descendants qui possèdent leur propre overlay afin d'éviter
le double rendu, sans interrompre la projection du parent. Les mesures historiques
FIRST/LAST ne font pas avancer l'horloge logique de présentation. Pour une capture
enfant, les captures parentes actives sont présentées à la phase absolue de FIRST
(`startAt`) puis à celle de LAST (`startAt + duration`); la durée de l'enfant
détermine donc la phase du parent utilisée pour ses bornes, sans transférer
l'ownership au parent.
Lorsqu'une nouvelle capture recouvre une animation existante, sa lecture FIRST
réutilise la pose visuelle du ghost direct déjà actif; elle ne relit pas la pose
logique DOM. Sa lecture LAST reprend la résolution par l'ancêtre actif afin de
mesurer la nouvelle cible dans le repère courant. Cette distinction empêche un
reflow concurrent de remettre un item à son FIRST au milieu de sa trajectoire.
La référence de composition conserve toute la chaîne logique: si le parent
immédiat n'a pas de ghost, le premier ancêtre actif est utilisé, y compris un
ancêtre d'ancêtre, sans créer une entry animée implicite pour cet ancêtre.

La visibilité des descendants est résolue par ownership, pas par une restauration
globale par `itemId`: `excludeOverlayItem(itemId, sourceTargetId)` masque le clone
FIRST correspondant, puis `restoreOverlayItem(itemId, destinationTargetId)` ne le
réaffiche que si le ghost porte ce target. Un enfant Q→K reste donc absent du ghost
FIRST de Q à son LAST, même si la transition du parent Q continue.

À la fin de chaque commit, après résolution complète de la forêt
`OverlayProjectionNode`, le runtime réaffirme aussi `excludeOverlayItem(itemId)`
sans target pour chaque item qui possède encore un ghost `capture` ou `handoff`.
Tous les clones de cet item dans les ghosts parents sont alors masqués; son ghost
propre est l'unique représentation visible. Cette passe est nécessaire pour les
seeks froids: une capture courante peut regrouper des aliases historiques dont le
`sourceTargetId` décrit le dernier état, et non le target FIRST du ghost parent.
La restauration target-par-target reste réservée à la libération de l'ownership.

Si l'enfant atteint son LAST alors que son `destinationParentId` possède encore un
ghost actif, son overlay n'est pas terminé. Le runtime mémorise sa pose relative au
parent à cet instant et la recombine avec la pose courante du parent à chaque commit,
jusqu'au LAST du parent. Les siblings stables (`isDirectMover: false`) ne peuvent pas
reprendre cet ownership. La restitution au DOM n'a lieu qu'après la fin du parent,
ce qui évite tout retour intermédiaire à la pose FIRST.

La réconciliation du contenu parent intervient avant cette passe d'ownership :
elle utilise `HtmlFlipOverlayContentState` pour reconstruire le subtree courant,
y compris les enfants entrés après le FIRST du parent. Le seek froid n'a donc pas
besoin de rejouer les libérations des captures enfants déjà terminées.

Le runtime matérialise cette règle dans une forêt de `OverlayProjectionNode` : un
noeud `capture` possède sa capture directe, un noeud `handoff` possède un
`parentItemId` et une pose relative, et la résolution remonte récursivement jusqu'à
la racine. La fin d'un parent propage donc son handoff à tous ses descendants sans
recalculer ni interrompre leurs poses relatives. La profondeur n'est pas codée en
dur; les cycles sont refusés lors de la résolution. Une régression couvre une chaîne
de cinq niveaux.

La pose contient à la fois :

- une rect visuelle, qui est toujours l'AABB reconstruite de la boîte ;
- l'origine monde de la boîte locale avant sa matrice ;
- une matrice composée ;
- la matrice du parent ;
- les dimensions locales nécessaires à la projection ;
- l'offset de layout immédiat lorsqu'il provient d'un node HTML vivant.

Le host local reconstruit ensuite une matrice affine complète dans le repère du
parent. Il neutralise temporairement les propriétés CSS individuelles
`translate`/`rotate`/`scale` et expose une seule `matrix(...)` dans un slot CSS
transitoire, sans remplacer la déclaration auteur. Les dimensions FLIP sont
exposées séparément via `width`/`height`; elles ne sont jamais converties en
`scaleX`/`scaleY` de la matrice locale. Retirer les slots termine ou annule la
projection sans restaurer un snapshot de `style` potentiellement obsolète. Un
delta écran ne doit jamais être écrit directement comme un delta local lorsque le
parent est tourné ou mis à l'échelle.

## Mesure HTML

Le host HTML V2 calcule les poses locales à partir de :

- l'origine de layout obtenue par les offsets de layout, puis recalée sur la
  translation fractionnaire réellement rendue par le DOM ;
- les dimensions locales calculées ou exposées par le node ;
- les transformations CSS propres du node ;
- la matrice cumulée du parent et des ancêtres ;
- l'AABB reconstruit mathématiquement à partir de cette matrice.

Le pose graph ne soustrait jamais rect.left/top pour dériver un repère local :
il compose et décompose les affines avec origin et la partie linéaire de la
matrice, puis reconstruit la rect à partir des quatre coins transformés. Une
trajectoire déclarée dans l'espace des AABB est convertie en origine avant la
composition. Cette séparation conserve les bonnes cibles pour les rotations,
les échelles et les matrices dont l'AABB ne commence pas à l'origine.

Pendant une mesure historique, si un item garde un ancien ghost direct alors que
son DOM est déjà sous un autre parent animé, l'overlay du parent actuellement
présent dans l'ascendance DOM est résolu en premier. Le ghost direct ne sert de
repli que lorsqu'aucun parent actif ne peut composer la pose ; il ne peut donc
pas figer un enfant reparenté sur la trajectoire de son ancien conteneur.

`getBoundingClientRect()` n'est pas utilisé comme origine affine. Il sert
uniquement à récupérer la translation fractionnaire de la boîte rendue, après
soustraction de l'AABB calculée à partir de la matrice; les offsets entiers
restent le repli pour un host DOM minimal sans mesure exploitable.

L'overlay est un adaptateur ad hoc distinct du chemin local. Il peut utiliser sa
propre mesure d'ancrage HTML, mais cette mesure ne définit pas le contrat de pose
locale du module. Sa couche est créée sous le `root` du host courant et ses poses
sont converties dans le repère de ce root ; elle ne s'étend pas à la page entière.

## Ancêtres en régime `layout`

Le host fournit `captureHistoricalPose` pour un ancêtre `layout`. Cette fonction
doit :

1. réaliser temporairement l'état de l'ancêtre à l'instant demandé ;
2. capturer sa pose numérique ;
3. restaurer l'état courant du host ;
4. retourner la pose capturée.

FLIP conserve la responsabilité de :

- l'ordre racine vers feuille ;
- la sélection des ancêtres `layout` à résoudre ;
- la mise en cache par capture, ancêtre, epoch et instant ;
- l'invalidation du cache ;
- l'annulation d'une correction devenue obsolète.

Le host conserve la responsabilité de la réalisation temporaire et de sa mesure.
Cette séparation évite que FLIP connaisse le modèle temporel ou le cycle de rendu
du consommateur.

## Projection host

`HtmlFlipProjection` est la frontière entre le runtime et le host HTML. Elle
fournit :

- l'identité du host et son epoch de projection ;
- la résolution d'un item vers un handle ;
- la capture d'une pose locale ;
- la capture historique des ancêtres `layout` ;
- l'application, la fin et l'annulation des poses locales ;
- la création, l'application et la fin des overlays ;
- l'exclusion des descendants qui possèdent un overlay indépendant ;
- un `flush` unique par commit.

`HtmlDomProjection` est l'implémentation host autonome utilisée par la démo. La
démo ne réimplémente ni la capture, ni la pose, ni la restauration, ni la
projection.

Lorsqu'un overlay parent est actif, une nouvelle capture overlay est présentée
à son instant FIRST avant de mesurer ses descendants. Le host compose alors la
pose locale du descendant avec la pose projetée du parent. Les descendants qui
possèdent leur propre overlay sont temporairement masqués dans les ghosts
parents pour éviter les doubles rendus, puis restaurés à la fin de leur overlay.
Le template FIRST conserve aussi une `Map` de références vers les clones de ses
descendants connus. Les opérations d'exclusion et de restauration utilisent ces
références, et ne recherchent pas les items par `data-item-id` ou `id` dans un
subtree cloné. `data-codplay-flip-hidden` reste uniquement un marqueur CSS
transitoire de visibilité; il ne porte aucune ownership.

## Intégration `move`

`MoveFlipLayoutProjection` fournit la frontière player entre un snapshot résolu
et `seekCached()`. Il projette d'abord le graphe structurel, puis appelle le
resolver commun si une capture manque. Play, Seek et les frames suivants partagent
exactement cette frontière; aucune phase ne sélectionne un fournisseur de capture
différent.

Le `MoveFlipCaptureBuilder` reste fourni par le host : il connaît les handles,
les ancêtres, le mode `local` ou `overlay-world`, et la forme de transition
consommable par FLIP. La policy de placement ne connaît toujours ni le DOM ni
FLIP.

## Lifecycle et captures concurrentes

`HtmlFlipRuntime` expose les opérations suivantes :

- `capture()` : capture une mutation et met en cache le résultat ;
- `recordMeasurementTree()` : enregistre une capture déjà mesurée par le runner ;
- `prepareCapture()` : reprojette les overlays actifs avant une nouvelle mesure ;
- `run()` : capture et présente le début de la transition ;
- `seek()` : résout une capture à un instant précis ;
- `seekCached()` : résout toutes les captures actives du host à cet instant ;
- `invalidateHost()` : invalide un epoch et annule les projections actives ;
- `cancel()` : termine les overlays et annule les poses locales.
- `destroy()` : annule les poses et supprime les ressources transitoires du host.

Plusieurs captures actives peuvent être résolues ensemble. Le runtime applique
leurs poses dans l'ordre de leur `startAt` et effectue un seul `flush`.

Un changement de scroll ou de resize produit un nouvel epoch de projection. Les
captures de l'ancien epoch ne sont pas réutilisées.

## Erreurs

Les fonctions de capture et de pose peuvent rejeter un invariant interne. À la
frontière `HtmlFlipRuntime`, ces erreurs deviennent un
`FlipOperationResult` contenant un `DiagnosticReport` du `DiagnosticCollector`
V2.

L'application peut fournir un `DiagnosticOutput` sans que FLIP connaisse la
présentation des messages.

## Validation actuelle

La couverture actuelle comprend :

- capture FIRST/mutation/LAST ;
- ancêtres composés et ancêtres `layout` historiques ;
- parent et grand-parent FLIP ;
- item changeant de conteneur ;
- conteneur dont la hauteur change pendant l'insertion, avec interpolation
  explicite `width`/`height` sans scale FLIP indépendant ;
- conversion monde vers repère local ;
- cycles et chaînes d'ancêtres invalides ;
- cancellation, retarget et captures chevauchantes ;
- identité stable des occurrences compilées, resolver froid multi-captures et
  commit unique après mesure transactionnelle ;
- convergence Play/Seek aux bornes et au milieu, seek-back, seeks répétés et
  invalidation d'epoch avec nouvelle réalisation froide ;
- slots auteur/transitoires pour les poses locales et la visibilité des overlays,
  avec conservation d'une écriture auteur concurrente ;
- propagation du mode `overlay-world`, calibration dans le repère du root,
  ghosts imbriqués sans doublon et destruction de la couche overlay ;
- ownership hiérarchique parent/enfant, maintien de la trajectoire parent pendant
  la fin d'une capture enfant, handoff de pose relative jusqu'au LAST du parent et
  fenêtre active déterminée par la fin la plus éloignée, y compris une chaîne de
  handoffs récursive de profondeur 5 ;
- références de descendants conservées dans les templates FIRST et exclusion sans
  recherche d'identité par attribut dans les clones ;
- canonicalisation des captures groupées contre les réalisations unitaires et
  conservation du handle de ghost lors d'un remplacement par alias ;
- déclaration de coupe `layout` côté host, réalisation historique restaurée et
  suspension des poses transitoires pendant la mesure ;
- séparation origin/AABB dans le pose graph, avec régression rotation/échelle ;
- mesure d'un enfant reparenté sous un parent actif malgré un ghost direct
  obsolète, avec cible LAST à la phase absolue de fin de l'enfant ;
- isolation host/epoch ;
- diagnostics runtime.
- compilation de trajectoires SVG normalisées en segments d'arcs et de droites.
- integration DOM deterministe d'une chaine `layout -> container -> item`, avec
  pose milieu, fin, seek-back et invalidation d'epoch.

Vérifications actuelles :

- typecheck V2 réussi ;
- 61 fichiers de test ;
- 367 tests réussis ;
- build de la démo FLIP réussi.

## Limites actuelles

Le module ne possède pas la politique de liste ni le parsing SVG auteur. Le
compilateur de scène transforme le `d` SVG en segments normalisés d'arcs et de
droites ; FLIP ne reçoit qu'une trajectoire préparée. Les valeurs par défaut de
transition et le niveau de correction différée du scrubbing restent des
évolutions du host ; le seek FLIP reste synchrone et déterministe.
