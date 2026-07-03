# Plan — Cadre de sélection (SelectionFrame)

## Terminologie

| Terme | Sens dans ce document |
|---|---|
| **item** | Entité sélectionnée dans l'éditeur — son type codplay n'est pas forcément défini |
| **élément** | Le nœud DOM rendu par le player correspondant à cet item |
| **perso** | La partie data codplay (définition, actions) — distinct de l'élément DOM |
| **cs** | Cadre de sélection, placé devant l'élément dans le layer overlay |
| **gabarit** | Overlay qui reproduit le placement visuel du conteneur parent (grid) et en expose la structure — actif en contexte positionnement |
| **preset** | Ensemble nommé de capacités du cs, activé par l'éditeur selon le contexte d'édition |
| **attache-flex** | Outil distinct du cs : contrôle le placement de l'élément dans son conteneur flex/grid via `align-self`/`justify-self` |
| **capsule** | Concept propre à un éditeur particulier (absent de codplay) : relation parent-enfant entre un item et son conteneur grid. Mentionné ici pour expliquer l'origine du `containerId` fourni au cs ; le présent module n'en connaît pas l'implémentation. |

Dans ce plan, "élément" désigne toujours la partie DOM. "Perso" n'est utilisé que quand la distinction data/DOM est pertinente (ex. `subscribeToNode(persoId, ...)`).

## Contexte

Le player est initialisé en mode `'author'` dans l'éditeur. Tant que le player n'est pas en cours de lecture (`is-playing`), un clic sur un élément le place en mode édition. Un clic sur un autre élément, ailleurs dans la scène, ou une commande explicite de déselection ramène à l'état sans sélection.

Un élément sélectionné expose un artefact visuel **devant lui** : le cadre de sélection (ci-après **cs**) qui permet les manipulations drag/resize. Selon le contexte actif, des artefacts supplémentaires apparaissent derrière l'élément : le **gabarit** en contexte positionnement grid, le clone temporaire pendant un drag en mode grid libre (voir section Composition visuelle).

## Architecture du mode édition

### États de sélection

```
aucune sélection
  → clic sur élément → sélectionné + cs actif
      → seek / élément absent du DOM → sélectionné + cs suspendu
      → élément de retour dans le DOM → sélectionné + cs actif
      → déselection → aucune sélection
```

La sélection est une propriété de l'éditeur (contexte externe au player). Le cs est l'artefact visuel qui l'exprime dans le rendu ; il peut être suspendu sans que la sélection soit perdue.

**cs actif** : l'élément DOM est présent et le cs est positionné dessus.

**cs suspendu** : l'élément DOM est absent (seek sur une position où cet item n'est pas monté, re-init en cours). Le cs se retire visuellement. L'éditeur conserve la sélection — si l'élément réapparaît (nouveau seek, reconstruction scène), le cs se réattache automatiquement.

### Sélection multiple

Plusieurs éléments peuvent être sélectionnés simultanément (ex. shift+clic, lasso). Le cs représente alors l'ensemble.

**Géométrie du cs en sélection multiple**

Le cs englobe l'union des `getBoundingClientRect()` de tous les éléments sélectionnés — leur bounding rect en espace viewport, axis-aligned.

Rotation du cs :
- Si tous les éléments partagent la **même rotation** (angle extrait de leur matrice cumulée via `Math.atan2(M.b, M.a)`, comparé à ±1° de tolérance) → le cs applique cette rotation commune.
- Sinon → le cs est à 0° (bounding rect axis-aligned).

```
angle commun ?   oui → cs tourné à cet angle
                 non → cs à 0°
```

**Valeurs appliquées aux éléments**

Les diffs produits par le cs (drag, resize) sont **relatifs** : chaque élément sélectionné reçoit le même delta `{ x, y }` ou `{ width, height }`. Le cs ne calcule pas de position absolue cible.

**Précision**

Toutes les valeurs produites par le cs (deltas, dimensions, coordonnées d'ancrage) sont arrondies à l'entier le plus proche (pixel entier). Cela vaut pour la sélection simple comme pour la sélection multiple.

**Opérations désactivées**

Les opérations suivantes sont indisponibles en sélection multiple : le positionnement grid et le mode flex (`FlexAdapter`) — ces deux contextes n'ont de sens que pour un item individuel. Le cs expose une capacité de désactivation par opération ; l'éditeur la pilote selon le contexte.

```ts
handle.setOperationEnabled(op: string, enabled: boolean): void
```

**Suspension partielle**

Le cs est unique et commun à tous les éléments sélectionnés. Si l'un d'eux disparaît du DOM (seek partiel), il passe en suspendu individuellement ; le cs se recalcule sur les éléments restants.

### Sélection cyclique par ALT+clic

Quand plusieurs éléments se superposent, un clic normal sélectionne le plus haut dans l'ordre de peinture. Un ALT+clic fait défiler les éléments sélectionnables superposés un par un, en boucle.

```
Superposition : [A (haut), B, C (bas)]

clic        → sélectionne A
alt+clic    → sélectionne B
alt+clic    → sélectionne C
alt+clic    → sélectionne A  (boucle)
clic normal → sélectionne A  (reset, reprend depuis le haut)
```

**Détection des éléments à un point** : `document.elementsFromPoint(x, y)` renvoie tous les nœuds à la position du clic dans l'ordre de peinture (le plus haut en premier). La liste est filtrée pour ne conserver que les nœuds connus du player (racines de persos, identifiables via `subscribeToNode` ou via la map interne de l'orchestrateur). Les nœuds du layer overlay (clone, cs) sont exclus du filtre même s'ils apparaissent dans le résultat.

**État du cycle** : l'éditeur maintient un indice courant dans la liste des éléments superposés au dernier point de clic. Cet indice est incrémenté à chaque ALT+clic. Il se réinitialise si :
- un clic normal intervient (retour à l'élément du haut) ;
- le point de clic change (distance > seuil) ;
- la scène est reconstruite.

**Responsabilité** : ce mécanisme appartient à la couche éditeur, pas au cs. Le cs est notifié du résultat (quel élément est sélectionné) via le chemin normal de sélection.

### Capacités, presets et contextes d'édition

Le cs est configuré par l'éditeur via un système de presets. Un preset est un ensemble nommé de capacités actives. L'éditeur applique le preset approprié quand une édition commence.

**Catalogue des capacités**

| Capacité | Description |
|---|---|
| `move` | Déplacement (translate x/y) |
| `rotate` | Rotation de l'élément |
| `rotation-origin` | Axe / point de pivot de la rotation |
| `resize` | Redimensionnement width/height |
| `scale` | Mise à l'échelle |
| `positioning` | Assignation à une zone grid dans le conteneur parent |

Hors champ pour l'instant : skew, transformations 3D.

L'**attache-flex** (flex-start/end, align-top/bottom) est un outil distinct, indépendant du cs — il n'est pas dans ce catalogue.

**Système de presets**

```ts
type CapabilityPreset = {
  name: string
  capabilities: Array<'move' | 'rotate' | 'rotation-origin' | 'resize' | 'scale' | 'positioning'>
  handles?: Partial<Record<'corners' | 'sides' | CsHandleId, HandleBehavior>>  // voir section Poignées
}

handle.applyPreset(preset: CapabilityPreset): void
```

Le cs adapte son rendu (poignées visibles, zones interactives) aux capacités actives du preset courant. Les capacités absentes du preset sont visuellement masquées et non interactives. Le champ `handles` configure le comportement individuel des poignées (fonction assignée, bascule resize/scale) — détaillé dans la section Poignées.

**Trois contextes d'édition connus**

1. **Édition géométrique** — move, rotate, rotation-origin, resize, scale. Contexte par défaut pour toute sélection.

2. **Ancrage-conteneur** — outil distinct du cs, non décrit ici. Contrôle le placement de l'élément dans son conteneur flex (start/end, top/bottom). Activé séparément par l'éditeur.

3. **Positionnement grid** — l'élément est assigné à une zone prédéfinie d'un conteneur grid parent, ou la zone est définie interactivement à partir des contraintes de la grille. Dans ce contexte :
   - Le cs ne produit pas de delta x/y mais une référence de zone grid.
   - Le **gabarit** est affiché derrière l'élément : il représente la structure grid du conteneur parent et met en évidence les zones disponibles où l'élément peut être placé.
   - Détails à spécifier séparément.

D'autres contextes pourront s'ajouter. La structure preset est conçue pour les accueillir sans modifier le cs.

### Contrôle programmatique des parties

L'éditeur peut piloter indépendamment la visibilité et l'état actif de l'élément et du cs.

```ts
handle.setPartVisibility('element', visible: boolean)
handle.setPartVisibility('cs',      visible: boolean)

handle.setPartActive('cs', active: boolean)  // active/désactive pointer events
```

Ces bascules sont indépendantes de l'état de suspension (suspendu = élément absent du DOM ; visibilité = décision éditoriale).

**Cas d'usage typique de `setPartVisibility('cs', false)`** : l'éditeur bascule sur un panneau de travail non spatial (couleur, contenu, typographie). Le cs gêne visuellement sans apporter d'interaction utile. Il est masqué le temps du travail, puis rétabli quand l'auteur revient en mode édition visuelle. L'élément reste sélectionné.

### Resynchronisation depuis l'extérieur

L'éditeur peut modifier la position ou les dimensions de l'élément sélectionné par d'autres moyens que le cs : champ numérique, raccourci clavier, commande programmatique. Ces modifications sont appliquées directement sur l'élément (ou déclenchent une reconstruction de scène). Dans les deux cas, le cs doit se recaler sur la nouvelle géométrie de l'élément.

Deux mécanismes complémentaires :

- **Observation passive** : un `ResizeObserver` sur l'élément détecte les changements de dimensions rendues. Le cs se repositionne automatiquement.
- **Notification explicite** : si l'éditeur sait qu'il vient de modifier position/dimensions (sans reconstruction), il peut appeler `handle.sync()` pour forcer un recalage immédiat.

```ts
handle.sync(): void   // force un recalibrage ancrage + matrice
```

Après une reconstruction de scène complète, `subscribeToNode` notifie le nouveau nœud — le cs se repositionne via le chemin normal d'attache.

### Scroll, resize et changements d'environnement

Le player et le cs vivent dans la même page web, soumise à des événements environnementaux qui peuvent désynchroniser les coordonnées du cs : resize de la fenêtre, scroll non voulu, ouverture/fermeture d'un panneau d'édition modifiant les dimensions du player.

**Stratégie** : la meilleure réponse à ces événements est un recalcul intégral déclenché par l'éditeur — équivalent du recalage au seek. L'éditeur écoute `resize` (via `ResizeObserver` sur le conteneur du player) et `scroll`, et appelle `handle.sync()` en réponse. Le recalage est immédiat et complet : ancrage, matrice, gabarit, clone.

**Inhibition sous seuil** : si après recalcul les dimensions du cs sont trop réduites (trop proches de la taille des poignées), le cs peut être automatiquement masqué. Un paramètre configurable fixe ce seuil minimum.

```ts
type SelectionFrameOptions = {
  ...
  minSizePx?: number   // seuil en dessous duquel le cs est masqué (défaut : libre à l'éditeur)
}
```

**Masquage partiel** : le player et le cs partagent le même espace de rendu. Si le player est partiellement masqué (panneau superposé, overflow caché), le cs l'est aussi naturellement — aucun traitement spécifique requis de la part du cs.

### Zoom du player

Codplay n'a pas actuellement de notion de zoom d'affichage. Dans un contexte éditeur, un scale pourrait être appliqué au wrapper du player (ex. `transform: scale(0.5)` pour voir la scène entière dans un espace réduit).

Si ce scale est présent, `captureCombinedMatrixForNode` le capte dans la matrice cumulée — le cs en tient compte automatiquement pour son positionnement et ses calculs de conversion delta. Aucun traitement spécifique n'est a priori nécessaire, mais ce cas doit être validé lors de l'implémentation.

### Propagation des modifications

Quand l'auteur manipule le cs (drag, resize) :

1. **Immédiat** — feedback visuel (via `translate` du cs) + appel à `adapter.applyMove()` ou `adapter.applyResize()` avec le delta brut.
2. **Différé** — répercussion dans la définition de l'item (data). La scène n'est pas reconstruite à chaque geste : de nombreuses manipulations peuvent se succéder sans impact immédiat sur l'ensemble du projet.

La reconstruction de la scène (et donc la mise à jour de l'élément dans le player) est déclenchée par :
- un seek de l'auteur ;
- une décision de l'éditeur (période d'inactivité, sauvegarde explicite, etc.).

Après reconstruction, l'élément DOM est recréé. Le cs se repositionne automatiquement sur ce nouvel élément (via `subscribeToNode`).

**Le cs est sensible à deux sources de changement :**
- les éditions qu'il déclenche lui-même (drag/resize) ;
- les reconstructions de scène initiées par l'éditeur ou le seek.

## Récapitulatif de la problématique

### Composition visuelle

Quand un item est sélectionné, la pile de rendu est (du bas vers le haut) :

```
[ gabarit  ]  ← calque du conteneur parent (mode grid uniquement)
[ clone temporaire   ]  ← destination aimantée pendant un drag grid (mode grid libre uniquement)
[ élément (DOM)      ]  ← rendu normal par le player
[ cs                 ]  ← devant l'élément, dans le layer overlay
```

Le **cs** est un nœud `position: fixed` indépendant du flux de la scène.

Le **gabarit** est actif uniquement quand la capacité `positioning` est active et qu'un `containerId` a été fourni au cs. Le cs souscrit au nœud de ce conteneur via `subscribeToNode(containerId, cb)` — exactement le même mécanisme que pour l'élément édité. À l'apparition du nœud conteneur, le cs applique le même pattern de positionnement overlay-world : `captureCombinedMatrixForNode` pour capturer la matrice cumulée du conteneur (transforms inclus), puis `calibrateOverlayGhostToWorldSnapshot` pour calibrer l'ancrage `left/top`. Le gabarit reproduit ainsi fidèlement le placement visuel du conteneur, transforms compris. À l'intérieur, il visualise la structure grid fournie via `handle.setContainerGrid(grid)` :

- Si la propriété CSS `gap-decoration` est disponible dans le navigateur : l'utiliser pour afficher les zones.
- Sinon : générer autant de `div` fils que de cellules (`rows × cols`), positionnées via CSS grid, avec un `outline` visible.
- Pour les grilles très denses (> 50 colonnes ou > 50 lignes) : diviser le pas d'affichage par 10 (afficher une division sur 10).

Ces `div` de zones sont les **cibles de drop** : quand l'auteur déplace l'élément, la zone survolée est mise en évidence et constitue la cible du `GridPlacementAdapter`.

**Mode placement libre dans la grille** : quand aucune zone prédéfinie n'existe, l'interaction est visuellement identique au mode libre — drag et resize pixel — mais le cs et le clone sont **aimantés par les contraintes de la grille sous-jacente** (lignes de colonnes, lignes de rangées, en tenant compte des gaps). L'éditeur (`GridPlacementAdapter`) convertit la position aimantée en placement grid (`row`, `col`, `rowSpan`, `colSpan`). La grille reste affichée en filigrane dans le gabarit pendant le drag.

**Contrat du drop : l'élément se place là où l'auteur l'a vu.** La cellule surlignée pendant le drag est l'**unique source de vérité** du drop — jamais un second calcul (delta pixel arrondi) qui pourrait diverger de la prévisualisation. Le canal : `CsValueAdapter.applyCellDrop?(cell)` (optionnel, contexte grid) ; au relâché, le cs le déclenche avec la cellule cible. Le delta pixel (`applyMove`) n'est que le repli quand l'adaptateur n'expose pas ce canal.

**Cible recalculée au relâché** : les navigateurs coalescent les `pointermove` sur le rythme des frames, mais pas le `pointerup` — sur un drop rapide, la dernière cellule prévisualisée peut être en retard d'une frame sur le point réel de relâché (raté « aléatoire », dépendant de la vitesse du geste). La cellule cible est donc recalculée aux coordonnées du `pointerup` ; la dernière cellule surlignée sert de repli si le relâché sort du conteneur.

**Cellules de taille irrégulière** : aucune hypothèse de pistes uniformes. La géométrie des pistes est **mesurée** sur le conteneur réel via `getComputedStyle().gridTemplateColumns/Rows` (le navigateur y résout les tailles en pixels) plus `columnGap`/`rowGap`. Cette géométrie mesurée alimente :
- la détection de cellule sous le pointeur (parcours des frontières cumulées, pas de division) ;
- l'ancrage du clone temporaire sur le coin réel de la piste ;
- le `GridPlacementAdapter`, qui résout placement et spans **au plus proche** (la piste dont l'ancre — ou l'emprise — est la plus proche de la position accumulée), et non par arrondi de stride ;
- le gabarit, qui copie les templates résolus du conteneur réel — jamais un template théorique qui pourrait diverger.

Repli : si les templates résolus ne sont pas disponibles (environnement sans layout), division uniforme depuis `rows`/`cols` du contexte.

**Gabarit et matrice complète** : contrairement au cs (qui refuse le scale dans son transform pour ne pas déformer ses poignées), le gabarit n'a pas de poignées — il porte la **matrice complète** (rotation + scale, translation à zéro) avec les dimensions locales du conteneur. Les templates mesurés en px locaux s'y appliquent alors à l'identique, ce qui garantit l'alignement exact des zones sur les vraies cellules.

**Poignées en contexte grid — emprise atomique** : le resize n'émet pas de deltas pixel mais une **emprise cellulaire complète** via `CsValueAdapter.applyCellArea?({ row, col, rowSpan, colSpan })`. Le bord tiré suit le pointeur jusqu'à la piste mesurée qui le contient ; le bord opposé reste fixe. Les poignées nord/ouest **déplacent l'origine** (et ajustent le span en conséquence) — un span seul ne peut étendre l'emprise que vers le bas/droite, ce qui faisait rater les poignées hautes quand le span et une correction pixel concurrente (verrouillage d'ancre) se disputaient le placement. En contexte grid, le chemin pixel (`applyResize` + verrouillage d'ancre mesuré) est court-circuité : l'emprise est la seule unité. `applyResize` par accumulation reste le canal des adaptateurs sans `applyCellArea`.

**Signal de placement pour l'éditeur** : chaque changement de placement (drop, spans) est notifié via `onPlacement({ row, col, rowSpan, colSpan })` — c'est par ce signal que l'éditeur peut, ensuite, déclarer une **zone** à partir de l'emprise ajustée par l'auteur. Ce principe vaut pour tout placement, pas seulement le mode grid.

**Clone temporaire** : il reproduit la taille rendue de l'élément (dimensions explicites posées à la création — en `position: fixed` il perdrait sa taille de grille) et s'ancre sur la cellule survolée, gaps compris. Il porte la **matrice visuelle de l'élément** (rotation/scale hérités, `transform-origin: 0 0`) : dans un conteneur tourné, la prévisualisation est tournée comme le sera l'élément. L'ancrage `left/top` sur le coin de cellule reste exact car la rotation autour de l'origine locale laisse ce coin fixe. À la création, l'ancrage initial est le **coin d'origine locale** de l'élément (mapping affine), jamais le coin de son AABB — pour un élément tourné les deux diffèrent, et un ancrage AABB fausse la trajectoire initiale de la projection animée.

**Référence `pointAt` — la zone dessinée fait foi** : la cellule sous la souris est résolue par `elementsFromPoint` sur les **zones du gabarit** (`data-cs-zone`) — l'élément qui dessine la cellule est la référence, pas un calcul de coordonnées parallèle. Surlignage, ancrage du clone et drop dérivent tous du même nœud de zone : aucune divergence possible entre ce que l'auteur voit et ce qui est appliqué. Le calcul par pistes mesurées reste le repli (zone absente du point, grilles denses affichées au pas de 10).

**Éléments multi-cellules — cellule d'empoignement** : un élément couvrant plusieurs cellules conserve son système de cellules au drop (un 2×2 reste un 2×2, grille équivalente). La référence de placement est la **cellule d'empoignement**, mesurée **dans la boîte locale de l'élément** : le pointeur est inverse-transformé via la matrice de l'élément, sa fraction dans la boîte (0..1) multipliée par les spans donne la cellule empoignée de l'emprise. Ce calcul est insensible à la rotation — empoigner le quadrant visuel bas-droit d'un élément tourné désigne toujours sa cellule locale bas-droite. (Une soustraction cellule-pointée − cellule-d'origine mélangerait l'espace visuel et l'espace layout : la rotation y injecte un offset parasite qui clampe l'origine cible sur place — placements erronés ou gestes sans effet.) Au survol comme au drop, la cellule visée reçoit la cellule d'empoignement : `origine cible = cellule survolée − offset`. Si ce placement ferait sortir l'emprise de la grille, l'origine est **recalée depuis le bord vers l'intérieur** (clamp aux bornes, emprise préservée). Le clone prévisualise l'emprise complète (origine + spans) sur les pistes mesurées de la cible.

**Éléments transformés — décomposition layout/transform** : les cellules d'un élément sont celles de sa **boîte layout** (pré-transform), pas de sa boîte visuelle — un élément décalé par `translate` appartient toujours à ses cellules layout. Le coin layout se déduit du coin visuel en soustrayant le déplacement du transform propre : `d = t + (I − M)·O` (t = translate, M = matrice propre rotate·scale·transform, O = transform-origin en px), toutes valeurs lues en computed styles. L'emprise (origine, spans, empoignement) se mesure sur cette boîte layout.

**Ghost fidèle au rendu final** : quand l'élément porte un transform, le placement grid ne change que sa position layout — le transform reste appliqué par-dessus. Le ghost doit donc prévisualiser **le rendu final réel** : coin layout à la cellule cible + déplacement du transform propre recalculé aux dimensions cibles (le transform-origin en % suit la boîte, dont la taille change avec les pistes de destination), dimensions futures = emprise sur les pistes cibles × scale visuel. Ghost et placement final coïncident alors par construction — c'est le contrat du drop appliqué aux éléments transformés.

*Option en réserve (si l'empoignement ne suffit pas)* : pour chaque coin de l'élément, chercher le coin de cellule le plus proche afin de conserver la surface la plus approchante — non implémentée.

**Projection animée du clone** : quand la cellule cible change, le clone est **animé** (interpolation 0,5 s) vers la position et les dimensions de la zone cible — il vient occuper tout l'espace de la cellule au lieu de sauter. L'animation en cours est annulée à chaque nouvelle cible et au relâché.

**Protocole anime.js** : le moteur JS d'anime est une ressource interne de codplay — `useDefaultMainLoop` désactivé, `engine.update()` appelé par le ticker du player, `engine.speed` couplé au rate. Un `animate()` classique depuis un module authoring serait **gelé hors lecture** et subirait le rate. Les modules authoring utilisent exclusivement **`waapi.animate`** (module WAAPI d'anime v4) : les animations sont pilotées par la timeline native du navigateur, indépendantes du moteur JS partagé. Ne jamais importer `animate`/`engine` d'anime.js dans un module authoring.

**Systèmes de coordonnées en mode grid libre**

Trois systèmes coexistent pendant un drag :

| Artefact | Coordonnées | Rôle pendant le drag |
|---|---|---|
| Élément (DOM) | flux grid du conteneur | reste en place ; mis à jour seulement à la validation |
| Clone temporaire | `position: fixed`, espace viewport | suit la position aimantée — montre la destination |
| cs | `position: fixed`, espace viewport | suit la position brute de la souris (non aimanté) |

Le cs et le clone évoluent donc indépendamment pendant le drag : le cs montre où la souris est, le clone montre où l'élément va atterrir. À la validation (relâché), l'éditeur applique le placement grid et l'élément rejoint la position du clone.

L'éditeur sait si le conteneur est un grid (le player ne le sait pas). C'est lui qui active le gabarit et lui fournit la structure grid (`AutoCapsuleGridArtifact.context`).

Tous les artefacts vivent dans un layer overlay fixe commun (`position: fixed; left: 0; top: 0; pointer-events: none` sauf les zones de drop du gabarit et les poignées du cs).

### Positionnement

`getBoundingClientRect()` seul est insuffisant : il donne une boîte axis-aligned et ne préserve pas la rotation. Le modèle retenu pour le cadre est celui d'`overlay-world` :

| Propriété CSS | Rôle |
|---|---|
| `position: fixed` | Sortie du flux |
| `left / top` | **Ancrage monde initial** — position viewport du coin supérieur gauche au moment de l'attache |
| `transform: matrix(a, b, c, d, 0, 0)` | **Matrice visuelle** — rotation/scale hérités de la hiérarchie parent |
| `translate: Δx Δy` (propriété individuelle) | **Delta de déplacement** — feedback visuel pendant le drag ; jamais `x`/`y` Anime.js |

`left/top` ne sont pas animés : ils fixent l'ancrage, puis ne bougent plus. Tout déplacement (preview drag, animation) passe par la propriété CSS individuelle `translate`. Cette séparation est la même que dans l'implémentation `overlay-world` (commit `d789865` — "trajectoires flip") où `x`/`y` Anime.js ont été remplacés par `translate` pour ne pas entrer en conflit avec le `transform: matrix(...)` déjà en place.

**Calibration de l'ancrage** : appliquer `left = rect.left; top = rect.top` directement ne suffit pas. Le navigateur peut introduire des résidus subpixel entre la valeur CSS assignée et la position viewport réelle mesurée par `getBoundingClientRect()`. L'implémentation de référence (`calibrateOverlayGhostToWorldSnapshot` dans `create-list-flip-module.ts`) corrige ces résidus par une boucle itérative : on mesure, on calcule le résidu, on ajuste `left/top`, jusqu'à convergence dans un seuil de tolérance. Cette calibration n'a lieu qu'à l'attache ou au rebranchement, pas pendant le drag.

### Scale : traitement séparé

Le scale de l'élément ne doit pas être appliqué comme transform sur le cadre. Si le scale était dans le transform, les bordures et poignées du cadre seraient elles-mêmes déformées visuellement. Le scale est absorbé dans les dimensions `width` et `height` du cadre :

```
scaleX = sqrt(M.a² + M.b²)
scaleY = sqrt(M.c² + M.d²)

frameWidth  = localWidth  × scaleX   // = worldWidth rendu
frameHeight = localHeight × scaleY   // = worldHeight rendu

rotationOnly = matrix(M.a/scaleX,  M.b/scaleX,
                      M.c/scaleY,  M.d/scaleY,  0, 0)
```

Le cadre reçoit `width: frameWidth`, `height: frameHeight`, `transform: rotationOnly`. Il enveloppe l'élément à sa taille rendue, orienté correctement, sans déformation de ses propres bordures et poignées.

Cette opération est implémentée par `extractRotationMatrix(matrix)` dans `dom-matrix.ts` (export public depuis juin 2026).

### Drag → diff

Un drag sur le corps du cs (intérieur du cadre) déplace l'élément. Le delta souris est en espace viewport ; il est converti via l'inverse de la **matrice cumulée du parent** (`worldDeltaToLocalDelta` sur la matrice du parent, pas celle de l'élément). Raison : la propriété CSS `translate` s'applique avant la rotation propre de l'élément, donc dans l'espace de coordonnées du parent — convertir via la matrice de l'élément appliquerait sa rotation deux fois. Le cs émet toujours un **delta pixel local** — il ne connaît pas la sémantique de destination.

L'émission est **continue** : l'adaptateur reçoit un diff incrémental à chaque déplacement du pointeur (arrondi au pixel, cumul exact), pas au relâché. L'élément suit le geste en direct.

**Correction par mesure avant repaint** : le cs ne fait pas confiance au delta théorique pour son propre feedback. Après chaque émission, il mesure la position réelle de l'élément (`getBoundingClientRect`, synchrone donc avant repaint) et cale son `translate` sur le déplacement mesuré. Toute interférence de layout (marges auto, contraintes min/max, propriétés non anticipées) est ainsi absorbée sans qu'il faille l'énumérer : l'élément est la vérité, le cs suit. Les gestes resize/rotate/scale appliquent le même principe via une recapture de pose complète à chaque émission.

### Resize → diff

Les poignées produisent un delta `{ dw, dh }` local en projetant le delta souris sur les **axes locaux de l'élément** via `worldDeltaToLocalDelta` (matrice complète de l'élément, rotation incluse), puis en appliquant le signe de la poignée. La poignée tirée reste ainsi exactement sous le pointeur, quelle que soit la rotation.

`worldSizeToLocalSize` ne convient **pas** pour ce geste : elle convertit des dimensions (non négatives, clampées à 0) — un delta négatif y serait écrasé et la réduction bloquée.

Même règle d'émission continue que le drag : diff incrémental à chaque déplacement du pointeur, l'élément se met à jour en direct.

### Adaptateur de transposition (CsValueAdapter)

Le cs émet des deltas bruts. La décision sur la propriété cible appartient à l'éditeur, via une classe dédiée **`CsValueAdapter`** distincte du cs.

```ts
type CsRawMoveDiff = { dx: number; dy: number }
type CsRawSizeDiff = { dw: number; dh: number }
type CsRawRotateDiff = {
  dr: number                                   // degrés, arrondis à l'entier
  origin?: { fx: number; fy: number }          // pivot en fractions de la boîte de l'élément (0..1)
}
type CsRawScaleDiff = { fx: number; fy: number } // facteurs multiplicatifs (1 = inchangé)

interface CsValueAdapter {
  applyMove(raw: CsRawMoveDiff): void
  applyResize(raw: CsRawSizeDiff): void
  applyRotate(raw: CsRawRotateDiff): void
  applyScale(raw: CsRawScaleDiff): void
}
```

Rotation et scale empruntent le même canal que move/resize : le cs émet des deltas bruts, l'adaptateur décide de la propriété cible. La rotation est émise en degrés entiers incrémentaux ; le scale en facteurs multiplicatifs (précision 0.01). Les adaptateurs pour lesquels rotation/scale n'ont pas de sens (`FlexAdapter`, `GridPlacementAdapter`) les implémentent comme no-op.

**L'origine de rotation fait partie du canal `applyRotate`** : le pivot placé via l'aiguille (capacité `rotation-origin`) est émis dans chaque `CsRawRotateDiff` sous forme de fractions de la boîte de l'élément. `LibreAdapter` le transpose en `transform-origin` avant d'appliquer la rotation. Pas de canal séparé pour le pivot.

**Compensation au changement d'origine** : changer `transform-origin` sur un élément déjà transformé ré-applique la transformation existante autour du nouveau point — l'élément saute. `LibreAdapter` compense au moment du changement : `delta = (I − M)·(O_ancien − O_nouveau)`, où M est la partie linéaire courante (rotate·scale·transform composés) et O les origines en pixels locaux ; le delta s'ajoute à `translate` (même espace). La pose visuelle est ainsi strictement conservée à l'instant du changement d'origine.

L'éditeur instancie l'adaptateur approprié au contexte courant et peut en changer sans détruire la sélection (ex. : grid → libre pour un affinage de position).

| Contexte | Adaptateur | Propriétés cibles |
|---|---|---|
| Mode libre | `LibreAdapter` | `translate` (privilégié) ou `top/left` selon config de l'élément |
| Ancrage-conteneur | `FlexAdapter` | `align-self`, `justify-self` (flex-start/end, top/bottom) |
| Positionnement grid | `GridPlacementAdapter` | `row`, `col` (→ `AutoCapsuleChildPlacementInput`) |

**`LibreAdapter`** : applique le delta en `translate` par défaut. Bascule sur `top/left` uniquement si l'élément est en `position: absolute` et que l'éditeur a choisi ce mode explicitement. `translate` reste l'approche privilégiée car elle n'affecte pas le layout.

**`FlexAdapter`** : dans ce contexte, le cs ne produit pas un delta x/y mais une cible d'alignement cliquée. Le conteneur parent est affiché avec **11 points d'interaction** :

```
┌─────┬─────┬─────┐
│ TL  │ TC  │ TR  │   ← 3 points haut
├─────┼─────┼─────┤
│ ML  │  C  │ MR  │   ← milieu gauche, centre (9e), milieu droit
├─────┼─────┼─────┤
│ BL  │ BC  │ BR  │   ← 3 points bas
└─────┴─────┴─────┘
         ↕↔            ← 2 points sur l'élément lui-même (stretch)
```

- **8 points sur les côtés du conteneur** (coins + milieux d'arêtes, à l'intérieur) : cliquer l'un d'eux assigne `align-self` + `justify-self` correspondants.
- **1 point central** (9e) : centre sur les deux axes (`align-self: center; justify-self: center`).
- **2 points sur l'élément** : contraintes stretch, représentées par une double flèche opposée — `↔` pour `justify-self: stretch` (horizontal), `↕` pour `align-self: stretch` (vertical).

| Point | `align-self` | `justify-self` |
|---|---|---|
| TL / TC / TR | start | start / center / end |
| ML / C / MR | center | start / center / end |
| BL / BC / BR | end | start / center / end |
| ↔ (sur élément) | — | stretch |
| ↕ (sur élément) | stretch | — |

Ces propriétés (`align-self`, `justify-self`) sont valables dans un conteneur flex comme dans un conteneur grid — le `FlexAdapter` s'applique aux deux contextes.

**`GridPlacementAdapter`** : convertit le delta pixel en déplacement de cellule dans la grille parente. La structure de la grille est fournie par `capsule-automation` (`AutoCapsuleGridArtifact.context` : `rows`, `cols`, `areas`). L'adaptateur produit un `AutoCapsuleChildPlacementInput` (`{ row?, col?, rowSpan?, colSpan?, area? }`) que l'éditeur applique à la définition de l'enfant.

`capsule-automation` (`packages/authoring/capsule-automation/`) est la source de vérité pour la structure grid du conteneur parent. Il génère les classes CSS et styles inline à partir d'une `AutoCapsuleDefinition`. C'est depuis son `AutoCapsuleGridArtifact` que le `GridPlacementAdapter` tire le nombre de lignes/colonnes et les zones nommées.

### Nœud instable

Le player peut détruire et recréer le nœud DOM (seek, re-init). Le cs se rebranche via `subscribeToNode`, pas via une référence DOM directe. Pendant l'absence du nœud, le cs est suspendu (caché) ; la sélection reste active côté éditeur.

## Ce qui existe déjà (à réutiliser)

| Besoin | Code existant |
|---|---|
| Matrice cumulée du nœud | `captureCombinedMatrixForNode` — export public de `list-flip/engine/dom-matrix.ts` |
| Conversion delta viewport → local | `worldDeltaToLocalDelta` — idem |
| Conversion size viewport → local | `worldSizeToLocalSize` — idem |
| Extraction rotation seule (sans scale) | `extractRotationMatrix` — idem |
| Positionnement overlay world + calibration | pattern `setupClone` + `calibrateOverlayGhostToWorldSnapshot` dans `create-list-flip-module.ts` |
| Layer overlay fixe | créé dans `setupClone` (`overlayLayer.style.position = 'fixed'`) |
| Noms de propriétés x/y/width/height | `FlipTransitionState` dans `list-flip/engine/types.ts` |
| Mode auteur player | `player.init({ mode: 'author' })` — déjà supporté |
| Structure grid pour GridPlacementAdapter | `AutoCapsuleGridArtifact.context` de `capsule-automation` |
| Types de placement grid | `AutoCapsuleChildPlacementInput` de `capsule-automation` |

## Localisation du module

`SelectionFrame`, `CsValueAdapter` et ses variantes (`LibreAdapter`, `FlexAdapter`, `GridPlacementAdapter`) vivent dans **`packages/authoring/`**, pas dans `codplay`.

Raisons :
- `GridPlacementAdapter` dépend de `capsule-automation` (déjà dans `authoring`) — faire l'inverse créerait une dépendance circulaire.
- Le cs est un outil d'édition : il n'a pas à figurer dans le bundle d'un consommateur qui n'utilise pas l'éditeur.
- La direction de dépendance naturelle dans le monorepo est `authoring → codplay`, pas l'inverse.

**Points de contact avec codplay** (les seuls) :
- `player.subscribeToNode(persoId, cb)` — API publique à ajouter sur `PlayerApi` dans codplay.
- Utilitaires `dom-matrix.ts` — déjà exports publics de codplay, importables depuis authoring.
- `player.init({ mode: 'author' })` — déjà supporté, reste dans codplay.

## Architecture interne du module

### Machine d'état (XState)

La logique interne de `SelectionFrame` est portée par une machine XState, sur le même modèle que la machine du séquenceur (`packages/editor/src/sequence-editor/machine.ts`).

États principaux :
- `idle` — aucun nœud attaché
- `active` — nœud présent, cs affiché ; sous-états : `still` / `dragging` / `resizing` / `rotating`
- `suspended` — nœud absent (seek, re-init) ; cs masqué, sélection conservée

Événements-machine : `NODE_APPEARED`, `NODE_DISAPPEARED`, `DRAG_START`, `DRAG_MOVE`, `DRAG_END`, `RESIZE_START`, `RESIZE_END`, `ROTATE_START`, `ROTATE_END`, `SYNC`, `PRESET_APPLIED`, `ADAPTER_CHANGED`, `VISIBILITY_CHANGED`.

La machine ne connaît pas le DOM — elle tient l'état logique et délègue les effets à des actions XState (side-effects déclarés, testables indépendamment).

### Intégration authoring ↔ codplay (`AuthorApi`)

Les modules authoring dépendent d'une interface `AuthorApi`, pas directement de `PlayerApi`. `AuthorApi` est un objet léger qui enveloppe le player et n'expose que la surface nécessaire aux outils d'édition :

```ts
// surface minimale anticipée — à affiner dans la spec dédiée
type AuthorApi = {
  subscribeToNode(persoId: string, cb: (node: Element | null) => void): () => void
  getPlayerState(): { isPlaying: boolean }
  // à compléter dans la spec
}

function createAuthorApi(player: PlayerApi): AuthorApi
```

`createAuthorApi` vit dans `packages/authoring/` et wrape `PlayerApi` sans que codplay sache qu'authoring existe. La direction de dépendance reste `authoring → codplay`.

**Note :** le système de modules existant dans codplay (`RuntimeModule` — `init / start / update / render`) est orienté cycle de rendu player. Il ne convient pas aux modules authoring qui observent le player sans participer à son cycle. `AuthorApi` est le contrat d'interface complémentaire, distinct de `RuntimeModule`.

**Spec dédiée à élaborer :** `docs/formalisation/v1-author-api-spec.md` — définira la surface complète d'`AuthorApi`, les garanties de codplay en mode auteur, et la convention d'instanciation des modules authoring.

## Plan d'implémentation

### Étape 1 — Extraire les utilitaires matrix ✓ FAIT

`packages/codplay/src/runtime/modules/list-flip/engine/dom-matrix.ts` existe et exporte publiquement :

- `captureCombinedMatrixForNode(node: Element): Matrix2D`
- `worldDeltaToLocalDelta(matrix: Matrix2D, dx: number, dy: number): { x: number; y: number }`
- `worldSizeToLocalSize(matrix: Matrix2D, w: number, h: number): { width: number; height: number }`
- `extractRotationMatrix(matrix: Matrix2D): Matrix2D` ← ajout non prévu initialement

`create-list-flip-module.ts` importe depuis ce module.

### Étape 2 — Exposer `subscribeToNode` sur le player

Ajout à `PlayerApi` (voir `v1-author-api-spec.md`) :

```ts
subscribeToNode(persoId: string, cb: (node: Element | null) => void): () => void
```

Le callback reçoit `null` quand le nœud est retiré du DOM (seek, re-init) — c'est le signal pour passer le cs en état suspendu. Il reçoit le nouveau nœud quand l'élément est (re)monté — c'est le signal pour repositionner et réactiver le cs.

**Contexte d'implémentation**

Le nœud DOM d'un perso n'a aucun attribut `data-perso-id` — il n'est pas interrogeable depuis le DOM. La seule source de vérité est `nodeByPersoId : Map<string, unknown>` dans `RuntimeComponentOrchestrator` (ligne ~95). Le persoId est la clé stable, le nœud est la valeur.

Ce nœud est écrit à l'initialisation du perso via `storeLoadedRuntimeComponent` (ligne ~553 : `nodeByPersoId.set(perso.id, rootNode)`) et peut être remplacé lors d'un re-init (seek profond, destroy partiel). La map est vidée entièrement au `clear()` (ligne ~579).

**Modification à apporter à l'orchestrateur**

Ajouter un `Map<string, Set<(node: Element | null) => void>>` de subscribers dans `RuntimeComponentOrchestrator`. Chaque appel existant à `nodeByPersoId.set(persoId, node)` notifie les abonnés avec le nouveau nœud. Le `clear()` notifie tous les abonnés avec `null`. Le player délègue `subscribeToNode` à l'orchestrateur.

Aucun attribut DOM n'est ajouté — la résolution reste entièrement dans le runtime.

### Étape 3 — Implémenter `SelectionFrame`

```ts
// src/authoring/selection-frame.ts

type SelectionFrameOptions = {
  itemId: string              // identifiant de l'item dans l'éditeur (= persoId dans le player)
  authorApi: AuthorApi        // surface d'accès au player (subscribeToNode, état lecture)
  sceneRoot: Element          // conteneur d'exécution de la scène (= mountTarget du player) — référence pour le layer overlay
  adapter: CsValueAdapter     // transposition des deltas bruts en mutations CSS
  containerId?: string        // persoId du conteneur parent (capsule) — identifié via subscribeToNode, même mécanisme que l'élément édité
  minSizePx?: number          // seuil en dessous duquel le cs est masqué automatiquement
}

type SelectionFrameHandle = {
  destroy: () => void
  setPartVisibility(part: 'element' | 'cs', visible: boolean): void
  setPartActive(part: 'cs', active: boolean): void          // active/désactive pointer events
  sync(): void                                               // recalibrage forcé ancrage + matrice
  setOperationEnabled(op: string, enabled: boolean): void   // désactive des opérations selon contexte
  applyPreset(preset: CapabilityPreset): void               // applique un preset de capacités
  setAdapter(adapter: CsValueAdapter): void                 // change d'adaptateur sans détruire la sélection (ex. grid → libre)
  setContainerGrid(grid: AutoCapsuleGridArtifact | null): void  // fournit la structure grid pour le gabarit
}

function createSelectionFrame(options: SelectionFrameOptions): SelectionFrameHandle
```

Responsabilités :
- S'abonner au nœud de l'élément édité via `authorApi.subscribeToNode(itemId, ...)` pour détecter apparition/disparition
- Si `containerId` est fourni, s'abonner également au nœud du conteneur via `authorApi.subscribeToNode(containerId, ...)` — même mécanisme, même cycle de vie
- À l'apparition du nœud élément (callback non-null) :
  - Créer ou réactiver le layer overlay fixe
  - Capturer `{ rect, matrix, localWidth, localHeight }` du nœud cible
  - Positionner le cs : `position: fixed`, `left/top` calibrés (pattern `calibrateOverlayGhostToWorldSnapshot`), `width/height` depuis `localWidth × scaleX` / `localHeight × scaleY`, `transform: matrix(...)` via `extractRotationMatrix`, `translate: 0px 0px`
- À l'apparition du nœud conteneur ET si la capacité `positioning` est active : positionner le gabarit sur le nœud conteneur (même pattern overlay-world : `captureCombinedMatrixForNode` + `calibrateOverlayGhostToWorldSnapshot`), puis afficher les zones si `setContainerGrid` a fourni une structure
- Pointer events sur le corps du cs : drag → `worldDeltaToLocalDelta` (matrice du parent) → **feedback visuel via `translate: Δx Δy`** (propriété CSS individuelle, pas `left/top`, pas `x`/`y` Anime.js) → `adapter.applyMove(raw)` à chaque delta → reset `translate` à zéro au relâché
- Pointer events sur les poignées de coin : resize → `worldSizeToLocalSize` → `adapter.applyResize(raw)` à chaque delta (émission continue, comme le drag)
- À la disparition du nœud (callback null) : masquer cs et clone sans les détruire (suspension)
- `setPartVisibility` / `setPartActive` : bascules programmatiques indépendantes de l'état de suspension
- `sync()` : recalibrage forcé de l'ancrage et de la matrice (appelé par l'éditeur après une modification externe de position/dimensions ne passant pas par une reconstruction de nœud)
- Observer passif : `ResizeObserver` sur l'élément pour détecter les changements de géométrie sans appel explicite
- `destroy()` : désabonnement, suppression du layer

### Sélection multiple — `createMultiSelectionFrame`

```ts
type MultiSelectionFrameOptions = {
  items: Array<{ itemId: string; adapter: CsValueAdapter }>
  authorApi: AuthorApi
  sceneRoot: Element
  minSizePx?: number
}

function createMultiSelectionFrame(opts: MultiSelectionFrameOptions): SelectionFrameHandle
```

`createMultiSelectionFrame` expose la même interface `SelectionFrameHandle` que la sélection simple.

Comportement interne :
- Souscrit à chaque item via `subscribeToNode`. Si l'un disparaît (seek partiel), le cs se recalcule sur les éléments présents.
- Calcule l'union des `getBoundingClientRect()` de tous les éléments présents — le cs est unique, positionné sur cet union rect.
- Détecte la rotation commune (même `Math.atan2(M.b, M.a)` à ±1° sur tous les items) : applique cette rotation au cs si commune, sinon cs à 0°.
- Sur drag/resize : émet le même `CsRawMoveDiff` / `CsRawSizeDiff` à l'adaptateur de chaque item de la liste.
- Désactive d'office `positioning` (GridPlacementAdapter) et le mode FlexAdapter — ces deux contextes n'ont de sens que pour un item individuel. `setOperationEnabled` peut être utilisé par l'éditeur pour désactiver des opérations supplémentaires.

`applyPreset` et `setAdapter` ne s'appliquent pas à `createMultiSelectionFrame` (un preset et un adaptateur individuel par item). Ces méthodes sont présentes sur le handle retourné mais sans effet.

### Étape 4 — Scène de démo

Une scène avec un seul élément `layout` (une div avec `transform: rotate(20deg)` pour valider le cadre sur un élément tourné). Le player en mode auteur. Un `SelectionFrame` branché sur cet élément avec un `LibreAdapter` minimal qui logue les deltas en console et applique le translate.

Fichiers :
- `src/demos/scenes/selection-frame-scene.ts`
- `src/demos/codplay/selection-frame-demo.ts`

## Module complémentaire à venir

Le mécanisme d'accroche (`containerId` → `subscribeToNode` → overlay positionné sur le conteneur) est identique à celui de `SelectionFrame`. Un second module authoring sera spécifié ultérieurement ; il utilisera la même infrastructure pour créer et éditer les zones dans le gabarit (définition interactive des colonnes, rangées, zones nommées). Ce module n'est pas dans le périmètre du présent plan.

## Poignées

### Coins

Selon la config active, les coins servent à **redimensionner** (width/height) ou à **rescaler** (scale) l'élément. En mode rescale, le cs lui-même n'est pas rescalé — seul l'élément l'est.

**Bascule resize ↔ scale (alt-clic)** : chaque poignée porte un **mode courant** persistant. Un **alt-clic** sur la poignée fait basculer son mode (resize ↔ scale) sans démarrer de geste. Le mode est visualisé : en mode scale, **le bord de la poignée devient plus épais**. Un Alt maintenu pendant le drag n'a pas d'effet — la bascule est un état, pas un modificateur (un modificateur maintenu est trop peu visuel pour comprendre ce qui se passe).

**Configuration par preset** : le comportement des poignées est configurable par l'éditeur. Valeurs par défaut : mode `resize` si la capacité est active (sinon `scale`), bascule autorisée si les deux capacités sont actives. Le preset peut :
- assigner une fonction fixe à une poignée ou un groupe (`mode`) ;
- autoriser ou interdire la bascule (`allowSwap`).

```ts
type CsHandleId = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w'

type HandleBehavior = {
  mode?: 'resize' | 'scale'   // fonction assignée ; défaut : selon les capacités
  allowSwap?: boolean         // alt-clic autorisé ; défaut : les deux capacités actives
  ratio?: 'locked' | 'free'   // politique de ratio des coins ; défaut : 'locked'
}

type CapabilityPreset = {
  name: string
  capabilities: CsCapability[]
  handles?: Partial<Record<'corners' | 'sides' | CsHandleId, HandleBehavior>>
}
```

Résolution par poignée : config de la poignée précise > config du groupe (`corners`/`sides`) > défauts. L'application d'un preset réinitialise les modes courants.

**Conservation du ratio — politique configurable** : le comportement du ratio sur les coins est une **configuration de poignée** (`HandleBehavior.ratio`), jamais un cas particulier codé selon le contexte :

- `ratio: 'locked'` (défaut) : le ratio w/h est maintenu, **Shift le lève** — adapté au mode libre.
- `ratio: 'free'` : le geste est libre, **Shift verrouille le ratio** — adapté au contexte grid (où l'emprise en cellules est la norme et le ratio l'exception).

C'est l'éditeur qui choisit la politique via le preset (ex. le preset de positionnement grid déclare `handles: { corners: { ratio: 'free' } }`). Dans les deux politiques, l'axe dominant du geste pilote et l'autre suit le ratio de départ quand la contrainte est active.

### Côtés (milieu de chaque arête)

Les poignées de côté agissent sur un seul axe (width ou height). En mode scale, l'axe tiré pilote un scale uniforme par défaut ; Shift le restreint à cet axe seul.

### Ancrage par poignée — verrouillage mesuré

Le point opposé à la poignée tirée est l'**ancre** : il doit rester visuellement immobile pendant tout le geste. Seul l'angle (ou le bord) tiré bouge.

Une compensation théorique par poignée (ex. `dx = -dw` pour les poignées ouest) est insuffisante : elle n'anticipe pas les effets du `transform-origin` (une rotation autour du centre répartit toute croissance symétriquement des deux côtés), des marges automatiques, ou d'autres propriétés de layout. Le mécanisme retenu est le **verrouillage mesuré**, application du principe « mesure avant repaint » :

1. Au début du geste, la position viewport de l'ancre est mesurée et mémorisée. La position viewport d'un point local `(fx, fy)` de la boîte se calcule depuis le rect mesuré et la partie linéaire de la matrice (les coins transformés donnent le décalage AABB ↔ origine locale).
2. Après chaque émission `applyResize`/`applyScale`, la position de l'ancre est re-mesurée.
3. L'écart mesuré (viewport) est converti en espace parent (`worldDeltaToLocalDelta` sur la matrice du parent) et émis en `applyMove` correctif arrondi au pixel.

La boucle est auto-correctrice : chaque correction part de l'erreur *mesurée* après les corrections précédentes — pas d'accumulation de dérive. Le cs se recale sur l'élément (recapture de pose) à chaque émission.

### Robustesse des gestes

Les sessions de geste (drag, resize, rotation, pivot) obéissent aux règles suivantes :

- Seul le **bouton primaire** démarre une session.
- Les matrices de conversion sont **figées au début de la session** — la recapture de pose en cours de geste ne perturbe pas les calculs de delta.
- Une session se termine sur `pointerup`, mais aussi sur `pointercancel`, `lostpointercapture`, ou quand un `pointermove` arrive avec `buttons === 0` (relâché manqué). Sans cela, une session fantôme survit et transforme un simple survol en geste — la libération de session précède tout appel susceptible de lever une exception.
- **Un `pointermove` avec `buttons === 0` vaut relâché, pas abandon** : la session se termine en **appliquant** au point courant. Les navigateurs coalescent les pointermove — sur un relâché rapide, un dernier move avec `buttons` déjà à 0 peut précéder le `pointerup` ; le traiter en abandon avalerait le drop (symptôme : le drop échoue quand on relâche avant la fin de l'animation du clone, l'animation n'étant qu'un indice visuel, jamais une obligation). Seuls `pointercancel` et `lostpointercapture` sont des abandons.

### Drag intérieur

Un drag à l'intérieur du cadre déplace l'élément (mode libre). En mode positionnement grid, le même drag sert à déposer l'élément dans une zone du gabarit.

### Aiguille de rotation

Un point central porte une **aiguille** (needle). La rotation est commandée en tirant l'extrémité de l'aiguille. Le point de pivot (base de l'aiguille) est l'axe de rotation ; il est déplaçable.

**Suivi de la souris et précision** : pendant le drag, la pointe de l'aiguille reste exactement sous le pointeur (position inverse-transformée dans l'espace local du cs — même règle affine que le pivot). L'aiguille **s'allonge avec le drag** : plus le rayon pivot–pointeur est grand, plus la précision angulaire est fine. Au repos, l'aiguille reprend sa longueur fixe. L'angle émis est calculé en espace viewport autour du pivot figé en début de geste (le pivot est le centre de rotation : il ne bouge pas pendant le geste).

**Aimantation de l'axe** : l'axe est attiré par les 8 points caractéristiques du cadre (4 coins + 4 milieux d'arêtes). Quand il se pose sur l'un de ces points, la poignée de redimensionnement sous-jacente est désactivée (les deux fonctions ne peuvent pas coexister au même point).

**Retour à la position par défaut** : un double-clic sur l'axe de rotation le ramène au centre de l'élément (position par défaut). La poignée éventuellement désactivée par aimantation est réactivée.

**Transposition affine du pivot** : le pivot vit dans la boîte locale de l'élément (fractions 0..1). Le pointeur souris doit être transformé inversement via la matrice de l'élément pour obtenir ces fractions — diviser les coordonnées souris par le `getBoundingClientRect()` (boîte englobante axis-aligned) est faux dès que l'élément est tourné. Symétriquement, la position viewport du pivot (base du calcul d'angle) passe par le mapping affine, pas par le rect englobant.

**Émission** : la rotation émet `CsRawRotateDiff { dr, origin }` — degrés entiers incrémentaux plus le pivot en fractions. `LibreAdapter` transpose `origin` en `transform-origin` avant d'appliquer la rotation.

**Propriétés individuelles et matrice** : les adaptateurs mutent les propriétés CSS individuelles (`rotate`, `scale`, `translate`), qui ne figurent **pas** dans la valeur computed `transform`. La capture de matrice du module (`captureCombinedMatrixWithIndividualTransforms`) compose `rotate · scale · transform` (ordre spec) sur toute l'ascendance — l'utilitaire codplay `captureCombinedMatrixForNode`, qui ne lit que `transform`, ne suffit pas ici.

### Contraintes clavier (Shift)

| Action | Effet de Shift |
|---|---|
| Rotation | Pas de 15° |
| Déplacement | Contrainte d'axe (horizontal ou vertical) |
| Resize / scale par les coins | Lève la conservation du ratio — le ratio w/h est maintenu par défaut ; Shift permet un geste non proportionnel |
| Scale par les côtés | Restreint le scale à l'axe tiré (uniforme par défaut) |
