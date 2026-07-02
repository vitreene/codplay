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
}

handle.applyPreset(preset: CapabilityPreset): void
```

Le cs adapte son rendu (poignées visibles, zones interactives) aux capacités actives du preset courant. Les capacités absentes du preset sont visuellement masquées et non interactives.

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

Un drag sur le corps du cs (intérieur du cadre) déplace l'élément. Le delta souris est en espace viewport ; il est converti en espace local via l'inverse de la matrice cumulée (`worldDeltaToLocalDelta`). Le cs émet toujours un **delta pixel local** — il ne connaît pas la sémantique de destination.

### Resize → diff

Les poignées de coin produisent un delta `{ dw, dh }` local via `worldSizeToLocalSize` — même principe : delta brut, sémantique déléguée.

### Adaptateur de transposition (CsValueAdapter)

Le cs émet des deltas bruts. La décision sur la propriété cible appartient à l'éditeur, via une classe dédiée **`CsValueAdapter`** distincte du cs.

```ts
type CsRawMoveDiff = { dx: number; dy: number }
type CsRawSizeDiff = { dw: number; dh: number }

interface CsValueAdapter {
  applyMove(raw: CsRawMoveDiff): void
  applyResize(raw: CsRawSizeDiff): void
}
```

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
- Pointer events sur le corps du cs : drag → `worldDeltaToLocalDelta` → **feedback visuel via `translate: Δx Δy`** (propriété CSS individuelle, pas `left/top`, pas `x`/`y` Anime.js) → `adapter.applyMove(raw)` à chaque delta → reset `translate` à zéro au relâché
- Pointer events sur les poignées de coin : resize → `worldSizeToLocalSize` → preview + `adapter.applyResize(raw)` au relâché
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

### Côtés (milieu de chaque arête)

Par défaut, les poignées de côté redimensionnent sur un seul axe (width ou height). Un **alt-clic sur une poignée de côté** bascule ce point en mode scale sur cet axe — si l'éditeur autorise cette bascule.

### Drag intérieur

Un drag à l'intérieur du cadre déplace l'élément (mode libre). En mode positionnement grid, le même drag sert à déposer l'élément dans une zone du gabarit.

### Aiguille de rotation

Un point central porte une **aiguille** (needle). La rotation est commandée en tirant l'extrémité de l'aiguille. Le point de pivot (base de l'aiguille) est l'axe de rotation ; il est déplaçable.

**Aimantation de l'axe** : l'axe est attiré par les 8 points caractéristiques du cadre (4 coins + 4 milieux d'arêtes). Quand il se pose sur l'un de ces points, la poignée de redimensionnement sous-jacente est désactivée (les deux fonctions ne peuvent pas coexister au même point).

### Contraintes clavier (Shift)

| Action | Effet de Shift |
|---|---|
| Rotation | Pas de 15° |
| Déplacement | Contrainte d'axe (horizontal ou vertical) |
| Scale | Lève la contrainte de ratio — le ratio w/h est maintenu par défaut ; Shift permet un scale non proportionnel |
