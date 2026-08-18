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

Une capture persistée ne contient ni node DOM, ni handle, ni closure. Elle est
valide uniquement pour son `hostContextId` et sa `projectionEpoch`.

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

La pose contient à la fois :

- une ancre visuelle et ses dimensions ;
- l'origine monde de la boîte locale ;
- une matrice composée ;
- la matrice du parent ;
- les dimensions locales nécessaires à la projection ;
- l'offset de layout immédiat lorsqu'il provient d'un node HTML vivant.

Le host local reconstruit ensuite une matrice affine complète dans le repère du
parent. Il neutralise temporairement les propriétés CSS individuelles
`translate`/`rotate`/`scale` et écrit une seule `matrix(...)`, avant de restaurer
le style auteur exact. Un delta écran ne doit jamais être écrit directement
comme un delta local lorsque le parent est tourné ou mis à l'échelle.

## Mesure HTML

Le host HTML V2 calcule les poses locales à partir de :

- l'origine de layout obtenue par les offsets de layout ;
- les dimensions locales calculées ou exposées par le node ;
- les transformations CSS propres du node ;
- la matrice cumulée du parent et des ancêtres ;
- l'AABB reconstruit mathématiquement à partir de cette matrice.

`getBoundingClientRect()` n'est pas utilisé comme source de position pour la
mesure locale FLIP.

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

## Intégration `move`

`MoveFlipLayoutProjection` fournit la frontière player entre un `MoveStateDelta`
et une capture FLIP. Il capture avant la projection structurelle, délègue la
mutation au `LayoutProjection` de base, puis avance la capture avec le temps du
`RuntimePlayer`.

Le `MoveFlipCaptureBuilder` reste fourni par le host : il connaît les handles,
les ancêtres, le mode `local` ou `overlay-world`, et la forme de transition
consommable par FLIP. La policy de placement ne connaît toujours ni le DOM ni
FLIP.

## Lifecycle et captures concurrentes

`HtmlFlipRuntime` expose les opérations suivantes :

- `capture()` : capture une mutation et met en cache le résultat ;
- `run()` : capture et présente le début de la transition ;
- `seek()` : résout une capture à un instant précis ;
- `seekCached()` : résout toutes les captures actives du host à cet instant ;
- `invalidateHost()` : invalide un epoch et annule les projections actives ;
- `cancel()` : termine les overlays et annule les poses locales.

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
- conversion monde vers repère local ;
- cycles et chaînes d'ancêtres invalides ;
- cancellation, retarget et captures chevauchantes ;
- isolation host/epoch ;
- diagnostics runtime.
- compilation de trajectoires SVG normalisées en segments d'arcs et de droites.

Vérifications actuelles :

- typecheck V2 réussi ;
- 50 fichiers de test ;
- 306 tests réussis ;
- build de la démo FLIP réussi.

## Limites actuelles

Le module ne possède pas la politique de liste ni le parsing SVG auteur. Le
compilateur de scène transforme le `d` SVG en segments normalisés d'arcs et de
droites ; FLIP ne reçoit qu'une trajectoire préparée. Les valeurs par défaut de
transition et le niveau de correction différée du scrubbing restent des
évolutions du host ; le seek FLIP reste synchrone et déterministe.
