# Plan — Variantes du module SelectionFrame : création d'élément & éditeur de zones

Deux variantes du cadre de sélection (cs) : une **extension création** du module selection-frame lui-même, et un module **éditeur de zones**. Elles reprennent les **mêmes dispositifs** que le module principal : accrochage au player par `subscribeToNode`, positionnement overlay-world (pose + calibration), géométrie de pistes mesurée, machine XState, presets, protocole WAAPI, règles de robustesse des gestes. Le plan de référence du module principal est `docs/plans/2026-06-09-selection-frame-plan.md` ; sa terminologie s'applique ici, complétée ci-dessous.

## Terminologie (complément)

| Terme | Sens dans ce document |
|---|---|
| **mode création** | Extension du module selection-frame (pas un module séparé) : après choix d'un type d'item dans l'éditeur, l'auteur **commence par tracer un cs**, un item est généré depuis cette géométrie, puis le cadre passe en mode sélection régulier. Outil distinct selon le contexte (libre / grille), avec ses contraintes propres |
| **card** | Notion **éditeur** (hors module) : ensemble nommé de zones pré-construites représentant un gabarit non régulier (ex. titre / corps / footer). Les cards sont stockées par l'éditeur et transmises aux modules sous forme de géométries ou de zones — les modules n'ont aucun catalogue propre. « Plein cadre » en est le cas dégénéré (une seule zone couvrant tout) |
| **éditeur de zones** | Module d'édition de la structure interne d'un bloc (capsule) : grille de base + zones nommées |
| **grille de base** | Grille sous-jacente du bloc : `rows`, `cols`, `gap`, `padding` — la résolution de référence de toutes les zones |
| **zone** | Emprise nommée sur la grille de base : `{ name, row, col, rowSpan, colSpan }`. Les zones peuvent se chevaucher |
| **cellule** | Case unitaire de la grille de base ; nommée automatiquement, elle sert de cible de placement sans qu'une zone soit définie |
| **surface** | Réalisation géométrique d'une zone sous une contrainte donnée (ex. orientation portrait/paysage). Une zone peut avoir plusieurs surfaces ; **une seule est active par contrainte** |
| **contrainte** | Règle CSS ou condition d'environnement (orientation, breakpoint) qui sélectionne la surface active — pilotée par l'éditeur, hors du module |
| **grille d'affichage** | Représentation visuelle de la grille de base dans le gabarit ; basse définition quand la grille est fine (ex. 160×90 représentée en 16×9 ou 32×18) |
| **piste réservée** | Rangée/colonne de la grille fine laissée vide entre zones pour jouer le rôle de gap visuel — les grilles fines n'utilisent **pas** de `gap` CSS |
| **faux gap** | Écart conservé entre les parties lors de la **subdivision** d'une zone — toujours un nombre de cellules contiguës de la grille fine |

## Contexte et périmètre

Le système d'accrochage de composants au player (mode `'author'`, `subscribeToNode`, layer overlay) permet de brancher d'autres éditeurs que le cs. Deux variantes :

1. **Mode création** — ajout au module selection-frame : création d'un élément en traçant un cs (ou depuis une géométrie de card), dans le conteneur courant (scène ou capsule grid), puis bascule en sélection régulière.
2. **Éditeur de zones** — module distinct : division d'un bloc (capsule) en zones sur une grille de base ; c'est le « module complémentaire » annoncé en fin de plan cs (édition des zones dans le gabarit).

Les deux variantes sont des outils d'édition : elles ne mutent pas la scène elles-mêmes. Elles **émettent des intentions structurées à l'éditeur** (géométrie de création, définition de zones), qui décide de la répercussion data (création de perso, mise à jour de l'`AutoCapsuleDefinition`) et de la reconstruction de scène — même séparation que cs → `CsValueAdapter` → data.

## Dispositifs communs repris du module principal

| Dispositif | Origine (module cs) | Usage dans les variantes |
|---|---|---|
| Accrochage au nœud | `authorApi.subscribeToNode(persoId, cb)` — apparition/disparition, suspension | mode création : conteneur cible puis item créé ; éditeur de zones : nœud de la capsule |
| Pose overlay | `captureOverlayPose`, `captureCombinedMatrixWithIndividualTransforms`, `calibrateGhostToWorldSnapshot`, `ensureOverlayLayer` (overlay-pose.ts) | positionnement des calques des deux modules — jamais de gBCR hors overlay-pose |
| Gabarit matrice complète | gabarit du cs : matrice rotation+scale, dims locales, templates copiés du conteneur réel | l'éditeur de zones EST un gabarit enrichi ; la création en contexte grid affiche le même gabarit |
| Géométrie de pistes mesurée | `grid-geometry.ts` : `measureGridTracks`, `trackIndexAtPx`, `nearestTrackAnchor/Span` | aimantation du tracé, résolution des emprises — jamais d'hypothèse uniforme |
| Référence pointAt | zones `data-cs-zone` résolues par `elementsFromPoint` — la zone dessinée fait foi | survol, tracé, drop, affichage pleine résolution au survol |
| Contrat « ce que l'auteur a vu » | `applyCellDrop`/`applyCellArea` : la prévisualisation est la source de vérité, cible recalculée au relâché | l'emprise tracée émise = l'emprise prévisualisée, recalcul aux coordonnées du `pointerup` |
| Robustesse des gestes | bouton primaire seul, matrices figées en début de session, fin sur `pointercancel`/`lostpointercapture`/`buttons===0`, libération avant appel risqué | tous les gestes de tracé/redimensionnement de zone |
| Machine XState | `machine.ts` du cs, pattern séquenceur | une machine par module, états logiques sans DOM |
| Presets | `CapabilityPreset` + `HandleBehavior` (résolution poignée > groupe > défauts) | même mécanique pour configurer poignées et capacités des variantes |
| Protocole animation | **`waapi.animate` uniquement** — jamais `animate`/`engine` d'anime.js en authoring | animations de prévisualisation (projection du tracé, surlignage) |
| Émission arrondie | deltas pixel entier, emprises en indices de pistes | idem |

## Variante A — Création d'élément (extension du module selection-frame)

### Rôle

La création n'est **pas un module séparé** : c'est un **ajout au module selection** (décision utilisateur). C'est une action qui permet de **commencer par tracer un cs** — le rectangle tracé est le cadre de sélection en train de naître — de **générer un item** depuis cette géométrie, puis de **passer en mode sélection régulier** avec le même cadre. L'éditeur a préalablement sélectionné un type d'item (texte, image, layout…) ; ce type reste une donnée éditeur, le cs ne connaît que la géométrie.

Comme pour la modification, la création d'une surface est **fonction du contexte — grille ou libre — et emploie un outil distinct, avec ses contraintes propres** : symétrie exacte avec les adaptateurs de modification (le contexte est décidé par l'éditeur, qui active l'outil de création correspondant en fournissant ou non `containerGrid`).

### Deux outils de création selon le contexte

**Tracé libre** — un drag sur la surface du conteneur cible fait naître le cadre sous le geste (nœuds du cs régulier, poignées inertes pendant le tracé) :
- le rect suit le pointeur ; à l'émission, les coordonnées viewport sont converties en espace local du conteneur via l'inverse de sa matrice cumulée (`worldDeltaToLocalDelta` sur la matrice du conteneur — même règle affine que le cs, jamais de fraction calculée sur l'AABB). Shift contraint au carré.
- résultat : `{ kind: 'rect' }` en px locaux entiers.

**Tracé grid** — même geste, contraintes de la grille :
- le rect est **aimanté aux pistes mesurées** (mêmes helpers `grid-geometry`, gaps compris) ; la prévisualisation montre l'emprise cellulaire complète (comme le clone multi-cellules du cs). La cellule de départ est celle sous le `pointerdown` (résolution pointAt sur les zones du gabarit), l'emprise s'étend vers la cellule courante dans les deux sens (origine = min, span = étendue).
- résultat : `{ kind: 'cell-area', { row, col, rowSpan, colSpan } }` — pas de pixels.

**Géométrie fournie (card)** — création sans tracé. Le catalogue de géométries est une donnée **éditeur** (notion de card) ; le module ne stocke rien, il reçoit la géométrie à appliquer :

```ts
type CreationGeometry =
  // contexte libre : rect en fractions du conteneur (0..1)
  | { rect: { fx: number; fy: number; fw: number; fh: number } }
  // contexte grid : emprise cellulaire (indices 1-based, valeurs négatives = depuis la fin)
  | { cellArea: { row: number; col: number; rowSpan: number; colSpan: number } }
```

« Plein cadre » = `rect {0,0,1,1}` en libre, `cellArea {1,1,-1,-1}` (toutes pistes) en grid — côté éditeur, c'est une card à zone unique. `applyCreationGeometry(geometry)` pose le cadre et émet `onCreate` immédiatement ; si une confirmation est souhaitée, elle relève de l'éditeur (qui tient le catalogue et déclenche l'application).

### Contrat API — extension de `createSelectionFrame`

Le mode création est activé quand `options.creation` est fourni. `itemId` et `adapter` sont alors absents à la construction (l'item n'existe pas encore) et arrivent après coup par `attachItem` :

```ts
type SelectionFrameCreationOptions = {
  onCreate(result: CreationResult): void   // émission unique, au relâché du tracé
  minTraceSizePx?: number                  // en dessous, le tracé est abandonné (clic parasite)
}

type CreationResult =
  | { kind: 'rect'; rect: { x: number; y: number; width: number; height: number } }  // px locaux au conteneur, entiers
  | { kind: 'cell-area'; area: { row: number; col: number; rowSpan: number; colSpan: number } }

type SelectionFrameOptions = {
  // … existant ; deviennent optionnels quand creation est fourni :
  itemId?: string
  adapter?: CsValueAdapter
  creation?: SelectionFrameCreationOptions
}

type SelectionFrameHandle = {
  // … existant, plus :
  applyCreationGeometry(geometry: CreationGeometry): void   // géométrie issue d'une card éditeur
  attachItem(input: { itemId: string; adapter: CsValueAdapter }): void
    // après onCreate : lie le cadre à l'item créé et bascule en sélection régulière
}
```

### Machine — branche création

La machine du cs (existante) gagne une branche : `creating.armed` (conteneur présent, capture du tracé active) → `creating.tracing` (session de tracé) → `creating.awaitingItem` (géométrie émise, cadre affiché, en attente de l'item) → `ITEM_ATTACHED` → flux régulier (`idle` → `active` via `subscribeToNode`). `suspended` s'applique aussi pendant la création si le nœud conteneur disparaît (seek). Événements ajoutés : `TRACE_START`, `TRACE_MOVE`, `TRACE_END`, `TRACE_ABORT`, `CREATION_GEOMETRY_APPLIED`, `ITEM_ATTACHED`.

### Cycle : du tracé à la sélection régulière

1. **Tracé** — le cadre naît sous le geste (ou est posé par `applyCreationGeometry`). Poignées et capacités inactives : c'est un cs en gestation.
2. **Relâché** — `onCreate(result)`, émission **unique** (pas d'émission continue : il n'y a pas encore d'élément à faire suivre). Le cadre **reste affiché** : il tient la place visuellement pendant que l'éditeur travaille.
3. **L'éditeur crée le perso** (type d'item + géométrie reçue), reconstruit la scène, puis appelle `attachItem({ itemId, adapter })`.
4. **Bascule en sélection régulière** — `subscribeToNode(itemId)` ; à l'apparition du nœud, recalage de pose standard. Continuité visuelle : le même cadre passe du tracé à la sélection, sans disparition/réapparition.

Si l'éditeur renonce (pas de création), `destroy()` — ou un nouveau tracé — retire le cadre en attente. L'orchestration (créer le perso, choisir l'adaptateur, appliquer le preset du contexte) reste dans l'éditeur. La démo doit montrer l'enchaînement complet.

## Variante B — Éditeur de zones (grid)

### Rôle

Un bloc (capsule) est divisé en zones. Le module s'accroche au nœud de la capsule (`subscribeToNode(containerId)`) et affiche un **gabarit éditable** : la grille de base en filigrane, les zones existantes par-dessus, et des gestes pour tracer, redimensionner, subdiviser, fusionner. Toute modification est émise à l'éditeur, qui la répercute dans la définition data (capsule-automation) et décide des reconstructions.

### Modèle de données

```ts
type ZoneGridModel = {
  rows: number
  cols: number
  gap?: { row: number; col: number }      // gap CSS — grilles grossières uniquement (voir ci-dessous)
  padding?: { top: number; right: number; bottom: number; left: number }
  fakeGapUnits?: number                    // faux gap par défaut à la subdivision, en cellules contiguës
}

type ZoneDef = {
  name: string                             // défaut auto, éditable par l'éditeur
  row: number; col: number                 // origine 1-based
  rowSpan: number; colSpan: number
}

type ZoneEditorState = {
  grid: ZoneGridModel
  zones: ZoneDef[]                         // chevauchements permis
}
```

**Zones = classes CSS à placement par lignes — jamais `grid-template-areas`** (décision utilisateur : les areas ne peuvent pas se chevaucher). Chaque zone est définie par une **classe CSS qui détermine `row`, `col`, `rowSpan`, `colSpan`** (`grid-row: <row> / span <rowSpan>` ; `grid-column: <col> / span <colSpan>`), générée par capsule-automation. **Aucune extension capsule-automation n'est nécessaire** (décision utilisateur — le projet a déjà été prototypé) : la génération de classes de placement par lignes existe (`AutoCapsuleChildPlacementInput {row, col, rowSpan, colSpan}` → `AutoCapsuleResolvedChildPlacement.cssRules` / `gridRow` / `gridColumn`). Le module émet des `ZoneDef` ; l'éditeur les transpose vers capsule-automation avec l'existant.

**Cards.** L'éditeur peut poser d'un coup un ensemble de zones pré-construites (notion éditeur de **card** — ex. titre / corps / footer, gabarit non régulier). Rien de spécial dans le module : les zones d'une card arrivent par le canal d'état normal (`initialState` ou `setState`), au même titre que des zones tracées à la main.

**Presets de composition de grille.** Même principe pour la grille de base : l'éditeur aura des presets de composition (10×5, 16×9, …), mais c'est un réglage éditeur que ce module n'a pas à connaître — il reçoit simplement une valeur de grille (`ZoneGridModel` via `initialState` / `setGrid`). Règle générale : **tout catalogue (cards, compositions de grille) vit dans l'éditeur ; les modules ne reçoivent que des valeurs.**

**Pas de `gap` CSS sur les grilles fines** (décision utilisateur : il compliquerait le rendu sans avantage réel). Au-delà du seuil de finesse, `gap` est interdit par le modèle (validation) ; les gaps visuels sont des **pistes réservées** — rangées/colonnes de la grille fine laissées vides entre zones, qui jouent ce rôle. `gap` CSS reste permis sur les grilles grossières (sous le seuil).

**Cellules auto-nommées.** À la création d'une grille, chaque cellule est adressable sans zone : convention `r{row}c{col}` (ex. `r2c3`). Ce nommage est implicite (dérivé, jamais stocké) ; seul le placement sur une **zone** est stocké. Le `GridPlacementAdapter` existant produit déjà des placements par cellule — inchangé.

**Surfaces et contraintes.** Une zone logique peut avoir plusieurs réalisations géométriques selon une contrainte (ex. orientation). Le module **édite une surface à la fois** : l'éditeur choisit la contrainte active et fournit le `ZoneEditorState` correspondant ; à la bascule de contrainte, il remplace l'état (`setState`). Le module n'a aucune connaissance des contraintes — il ne voit qu'une grille et des zones. L'association `zone → { contrainte: surface }` vit dans la data éditeur. Une seule surface est active par contrainte, par définition.

### Affichage de la grille — finesse et échelle

Deux régimes, choisis par le module selon la densité. **Le seuil de passage est une valeur de config** (`fineDisplayThreshold`), à ajuster en conditions réelles :

1. **Normal** (sous le seuil) : une zone d'affichage `data-cs-zone` par cellule — dispositif existant du gabarit cs.
2. **Basse définition + survol pleine résolution** (au-delà) : la grille fine (ordre de grandeur indicatif : jusqu'à **160×90 cellules**) est représentée par une grille de macro-cellules à pas régulier — 160×90 affichée en 16×9 (pas 10) ou 32×18 (pas 5), le pas étant choisi pour rester lisible. Quand le pointeur entre dans une macro-cellule (résolution pointAt sur son nœud), ses sous-cellules sont **matérialisées à la volée** (pas² nœuds au plus) et détruites quand le pointeur en sort. Le nombre de nœuds vivants reste borné : macro-cellules + une macro-cellule développée, au lieu de `pistes²`. Le calcul par pistes mesurées reste le repli quand le point ne touche aucune zone.

**Pistes réservées dans la grille simplifiée.** Quand des gaps visuels sont demandés sur une grille fine, ils sont des pistes réservées de la grille fine — la grille simplifiée doit en tenir compte : les macro-cellules représentent les blocs utiles et les pistes réservées apparaissent entre elles. **Ajustement numérique de la précision** : la somme ne tombe pas juste en général (ex. 16 macro-cellules de pas 10 + 15 pistes de gap = 175 > 160 cellules). Si un gap est demandé, le module **réajuste le nombre de rangées/colonnes de la grille fine au plus près** pour que `n × pas + (n − 1) × gapUnits` tombe juste — l'ajustement est calculé par `zone-model.ts` (fonction pure, testée) et remonté à l'éditeur via `onZonesChange` (la grille de base est corrigée dans l'état).

**Grille ultra-fine = mode zone imposé.** Une grille fine sert de trame de construction, pas de cible de placement : en dessous d'une taille de cellule rendue (seuil en px, configurable — même esprit que `minSizePx` du cs), le placement par cellule est désactivé ; seules les zones sont des cibles valides. Le module expose cet état (`isCellPlacementAvailable`) pour que l'éditeur adapte son UI.

**Faux gap = paramètre de subdivision, uniquement.** Le faux gap sert exclusivement au moment de la **division d'une zone en plusieurs parties** : conserver un écart entre chaque subdivision. Il représente toujours un **nombre de cellules contiguës** de la grille fine. Il n'intervient ni au tracé ni au redimensionnement (pas d'aimantation) ; la donnée émise est toujours l'emprise réelle en cellules.

### Gestes d'édition

Tous appliqués sur les nœuds du gabarit (résolution pointAt), avec les règles de robustesse du cs :

- **Tracer une zone** : drag sur le gabarit — même geste que le traceur en contexte grid (emprise min/max entre cellule de départ et cellule courante, prévisualisation animée waapi). Au relâché : zone créée avec nom par défaut (`z1`, `z2`, … premier libre), émission `onZonesChange`.
- **Sélectionner** : clic sur une zone ; Shift+clic pour la multi-sélection. La zone sélectionnée affiche des poignées d'emprise (8 poignées, comportement `HandleBehavior` avec `ratio: 'free'` — vocabulaire preset du cs réutilisé).
- **Redimensionner / déplacer une zone** : poignées → emprise atomique (même contrat que `applyCellArea` : le bord tiré suit la piste sous le pointeur, nord/ouest déplacent l'origine) ; drag intérieur → déplacement d'emprise (cellule d'empoignement, clamp aux bords — dispositif multi-cellules du cs repris tel quel).
- **Subdiviser** : une zone est divisible en parts égales sur chaque axe. Sans faux gap : les **diviseurs entiers du span** (zone de 6 pistes → 2×3, 3×2, 6×1). Avec faux gap `g` (cellules contiguës conservées entre chaque part) : les nombres de parts `n` tels que `(span − (n−1)×g)` soit divisible par `n` — les parts restent égales, l'écart est constant. Le module calcule et expose les divisions valides (`getSplitOptions(name)`), l'éditeur les propose. Geste : commande (menu éditeur ou API) — pas de geste graphique en v1. Les zones filles remplacent la mère, noms dérivés (`z3-1`, `z3-2`, …).
- **Fusionner** : multi-sélection → `merge` = une zone unique sur l'**emprise englobante** (min/max des origines et extrémités en indices de pistes). Les zones sources sont supprimées, la fusion prend le nom de la première sélectionnée.
- **Renommer** : responsabilité éditeur (champ de son UI) via `renameZone` ; le module affiche le nom en étiquette dans la zone.

### Commandes programmatiques

Chaque geste a son équivalent commande — les zones « peuvent être créées visuellement comme générées par des commandes de l'éditeur » :

```ts
type ZoneEditorHandle = {
  destroy(): void
  sync(): void
  setState(state: ZoneEditorState): void          // remplace grille + zones (bascule de contrainte)
  setGrid(grid: ZoneGridModel): void              // change la grille de base (re-projette l'affichage)
  addZone(area: { row: number; col: number; rowSpan: number; colSpan: number }, name?: string): string
  removeZone(name: string): void
  renameZone(name: string, next: string): void
  getSplitOptions(name: string): { rows: number[]; cols: number[] }  // parts valides, faux gap compris
  splitZone(name: string, div: { rows?: number; cols?: number; gapUnits?: number }): string[]
    // gapUnits : faux gap entre les parts (cellules contiguës) ; défaut = grid.fakeGapUnits ?? 0
  mergeZones(names: string[], name?: string): string
  select(names: string[]): void
  getState(): ZoneEditorState
  setPartVisibility(part: 'grid' | 'zones', visible: boolean): void
}

type ZoneEditorOptions = {
  authorApi: AuthorApi
  sceneRoot: Element
  containerId: string                    // persoId de la capsule éditée
  initialState: ZoneEditorState
  onZonesChange(state: ZoneEditorState): void   // après chaque mutation (geste ou commande)
  onSelectionChange(names: string[]): void
  fineDisplayThreshold?: number          // pistes/axe au-delà desquelles on passe en basse définition — valeur de config, à ajuster en réel
  minCellSizePx?: number                 // en dessous, placement par cellule désactivé
}

function createZoneEditor(options: ZoneEditorOptions): ZoneEditorHandle
```

Les commandes passent par le **même chemin de mutation** que les gestes (une seule voie d'écriture sur l'état interne → une seule émission `onZonesChange`) — pas de logique dupliquée.

### Machine

États : `idle` → `active` (nœud capsule présent, gabarit affiché) avec sous-états `still` / `tracing` / `resizing` / `moving` ; `suspended` quand le nœud disparaît. Événements analogues au cs plus `ZONE_ADDED`, `ZONE_REMOVED`, `SELECTION_CHANGED`, `STATE_REPLACED`.

### Lien avec le cs

L'éditeur de zones produit la structure ; le cs (contexte positionnement grid) consomme cette structure pour placer des items. Le canal existant `onPlacement` du cs + `applyCellDrop`/`applyCellArea` reste inchangé : quand des zones existent, l'éditeur peut restreindre les cibles de drop du cs aux zones (au lieu des cellules) — évolution du gabarit du cs à prévoir en étape finale (surlignage de zone entière, drop = `{ area: name }` dans `AutoCapsuleChildPlacementInput`, champ déjà présent).

## Localisation du code

Même package **`packages/authoring/selection-frame/`** : les deux variantes partagent overlay-pose, grid-geometry, la mécanique de session de geste et le vocabulaire preset — un package séparé n'apporterait qu'une frontière artificielle et des ré-exports. Nouveaux fichiers :

```
src/creation-tool.ts           // variante A : outils de tracé de création (libre / grid), branché dans selection-frame.ts
src/zone-editor.ts             // variante B
src/zone-model.ts              // état zones + opérations pures (split avec faux gap, merge, noms, ajustement numérique des pistes réservées)
src/zone-machine.ts            // machine de l'éditeur de zones
src/gesture-session.ts         // ← extraction : mécanique de session partagée cs/création/zones
```

La variante A n'a **pas de module ni de machine propres** : `machine.ts` du cs gagne la branche `creating`, `selection-frame.ts` accueille les options `creation`/`attachItem`, et `creation-tool.ts` isole les deux outils de tracé (testables à part). L'extraction `gesture-session.ts` (bouton primaire, capture, fin sur cancel/lost/buttons===0, matrices figées) est un préalable : la logique existe dans `selection-frame.ts` et ne doit pas être dupliquée.

## Étapes d'implémentation

**Le mode création (variante A) est réalisé et validé en premier ; l'éditeur de zones (variante B) ne démarre qu'après validation** (décision utilisateur). Chaque étape livre ses tests avec elle (specs vitest du package) et se conclut par le lancement des specs touchées.

**Phase 1 — mode création du cs — Fait et validé (2026-07-09)**

1. **Extraction `gesture-session.ts`** — fait, `packages/authoring/selection-frame/src/gesture-session.ts`, utilisé par `selection-frame.ts`.
2. **Mode création** : branche `creating` de la machine (`machine.ts`, états `creating.armed`/`.tracing`/`.awaitingItem`), `applyCreationGeometry`/`onCreate`/`attachItem` implémentés dans `selection-frame.ts` — **écart mineur au plan** : pas de `creation-tool.ts` séparé, la logique de tracé libre/grid reste inline dans `selection-frame.ts` (jugé non bloquant, pas repris).
3. **Démo** : pas de route dédiée `?demo=selection-frame-create` — le cycle complet (tracé → `onCreate` → création perso → `attachItem` → sélection régulière, y compris bascule grille/libre) est exercé dans `?demo=selection-frame-grid` existante (`packages/demos/src/codplay/selection-frame-grid-demo.ts`), qui couvre le même besoin sous une route déjà en place.
4. **Validation utilisateur** — confirmée (« http://localhost:5173/?demo=selection-frame-grid propose le mode "création d'item" »).

**Phase 2 — éditeur de zones**

5. ~~**`zone-model.ts`**~~ **Fait (2026-07-09)** — `packages/authoring/selection-frame/src/zone-model.ts` : état + opérations pures, aucune dépendance DOM. `ZoneDef{name,row,col,rowSpan,colSpan}` transpose directement en `AutoCapsuleChildPlacementInput` (vérifié champ à champ dans capsule-automation — même vocabulaire, aucune couche de traduction, conforme au plan). Couvert : `addZone`/`removeZone`/`renameZone` (nommage auto `z{n}` premier libre, chevauchement autorisé, collision de nom rejetée) ; `getSplitOptions`/`splitZone` (formule exacte du plan `(span−(n−1)×g) % n === 0`, noms `${name}-1`/`${name}-2`/…) ; `mergeZones` (emprise englobante min/max, nom = première zone sélectionnée par défaut) ; `adjustFineGridForReservedTracks` (réajustement du nombre de pistes fines pour que `macroCount×pas + (macroCount−1)×gapUnits` tombe dans la limite) ; `validateZoneGridModel` (interdit `gap` CSS au-delà de `MAX_GAP_ROWS_COLS_FOR_CSS_GAP`). 20 tests (`tests/zone-model.spec.ts`), incluant les deux exemples chiffrés donnés littéralement par le plan (split 6 pistes → 2×3, et l'ajustement 160/16/pas-10) comme cas de non-régression contre le texte normatif lui-même. 94 tests `selection-frame` au total (74+20), typecheck propre.
6. ~~**`createZoneEditor` — affichage**~~ **Fait (2026-07-09)** — `packages/authoring/selection-frame/src/zone-editor.ts`. Réutilise les mêmes dispositifs bas niveau que le gabarit du cs (`captureOverlayPose`/`calibrateGhostToWorldSnapshot` d'`overlay-pose.ts`, `ensureOverlayLayer`, `authorApi.subscribeToNode`), mais un rendu propre — vérifié avant d'écrire que le gabarit du cs existant (`renderGabaritZones`, `selection-frame.ts`) n'implémente PAS le régime basse-définition/survol pleine résolution que la spec de l'éditeur de zones exige (il se contente d'échantillonner à pas fixe, jamais de matérialiser au survol) — pas réutilisable tel quel pour cette étape.
   - **Régime normal** : un nœud `[data-zone-editor-cell]` par cellule réelle, identique en esprit au gabarit existant.
   - **Régime basse définition** (au-delà de `fineDisplayThreshold`, config ajustable — plan §Affichage de la grille) : macro-cellules à pas dérivé de la taille de grille (`Math.ceil(fineTrackCount / threshold)`, jamais un pas fixe indépendant de la taille réelle) ; sous-cellules fines matérialisées à la volée sur `pointerenter` d'une macro-cellule (au plus `pas²` nœuds vivants), détruites sur `pointerleave` — testé explicitement (budget de nœuds, destruction, un seul groupe matérialisé à la fois même en survolant deux macro-cellules successivement).
   - **Rendu des zones** : un nœud `[data-zone-editor-zone="{name}"]` par `ZoneDef`, placé directement via `gridRow`/`gridColumn` (même vocabulaire que `AutoCapsuleChildPlacementInput`, aucune traduction).
   - `isCellPlacementAvailable()` exposé (plan : « grille ultra-fine = mode zone imposé... le module expose cet état pour que l'éditeur adapte son UI ») — pas encore raccordé à une vraie mesure de taille de cellule rendue en environnement réel (jsdom ne résout pas les templates grid, retombe sur `true` par défaut, testé explicitement).
   - Aucun geste (tracé/sélection/poignées) dans cette étape — volontairement hors périmètre, réservé à l'étape 7.
   - 12 tests (`tests/zone-editor.spec.ts`), 106 tests `selection-frame` au total (94+12), typecheck propre.
7. ~~**`createZoneEditor` — gestes**~~ **Fait (2026-07-09)**. `zone-machine.ts` créé (prévu par le plan mais pas encore écrit) : `idle → active(still/tracing/resizing/moving) → suspended`, même discipline que `csMachine` (pure, ne touche jamais au DOM). Les commandes programmatiques (`addZone`/`removeZone`/`renameZone`/`getSplitOptions`/`splitZone`/`mergeZones`/`select`/`setGrid`/`setState`) et les gestes passent tous par un même point d'écriture (`applyState`) — une seule émission `onZonesChange` par mutation, pas de logique dupliquée (plan §Commandes programmatiques).
   - **Tracer une zone** : drag sur le gabarit, même pattern que le tracé grid du cs (`min(startCell,currentCell)`/`abs(diff)+1`) — relu directement dans `selection-frame.ts` avant d'écrire, pas reconstruit de mémoire. Nom par défaut `z{n}` premier libre (`zoneModel.addZone` sans nom).
   - **Sélectionner** : clic = sélection seule ; Shift+clic = bascule dans la multi-sélection sans l'effacer. La zone sélectionnée affiche 8 poignées (`data-zone-editor-handle`), les autres aucune.
   - **Redimensionner** : poignées → emprise atomique, coin opposé à la poignée tirée reste fixe (vérifié par un test dédié au coin nw) ; jamais de span sous 1 (clampé, testé explicitement avec un drag délibérément inversé).
   - **Déplacer** : drag du corps de la zone → déplacement d'emprise avec cellule d'empoignement (offset entre le point de saisie et l'origine de la zone, comme le drag multi-cellules du cs) ; clampé aux bords de la grille ; un clic sans mouvement réel ne déclenche PAS `onZonesChange` (rien n'a changé), seulement une sélection — testé explicitement pour ne pas confondre les deux gestes.
   - **Bug trouvé en testant, corrigé avant livraison** : `applySelection()` appelait `renderZones()` seul (sans vider `zonesRoot` au préalable, contrairement à `renderAll()`) — chaque sélection empilait un second lot de nœuds de zone par-dessus l'ancien au lieu de le remplacer, cassant silencieusement `querySelector` (premier nœud trouvé = le mauvais, sans les poignées à jour) et provoquant une cascade d'échecs de test sans rapport apparent (DOM orphelin d'un test précédent jamais détruit polluant le suivant, `document.querySelector` prenant le premier match global). Cause unique, diagnostiquée avant de corriger — pas un correctif au hasard sur chaque symptôme.
   - `getSplitOptions`/`splitZone`/`mergeZones` réutilisent directement `zone-model.ts` (étape 5) — aucune logique redondante, ces commandes ne sont qu'un branchement.
   - 17 tests (`tests/zone-editor-gestures.spec.ts`), utilisant un conteneur de test dimensionné par style inline (jsdom résout `getComputedStyle().width/height` pour un style explicite, contrairement à `offsetWidth`/`clientWidth` toujours à 0 sans layout réel) — même repli que `uniformTrackGeometry` documente déjà, réappliqué ici dans `containerTrackGeometry()` du module. 123 tests `selection-frame` au total (106+17), typecheck propre.
8. ~~**Démo `?demo=zone-editor`**~~ **Fait (2026-07-09)** — `packages/demos/src/scenes/zone-editor-scene.ts` (capsule grid 90×160, structure fournie par `AutoCapsule.resolve()`, même pattern que `selection-frame-grid-scene.ts` : capsule-automation reste la seule source de vérité du CSS de la grille) + `packages/demos/src/codplay/zone-editor-demo.ts`. Contrôles : outillage éditeur externe (`onControlsReady`/`makeButton`, même pattern que `selection-frame-grid-demo.ts` — confirmé comme exception explicite déjà actée, pas des persos layout+emit) : poser la card titre/corps/footer (`setState`, un remplacement d'état ordinaire — rien de spécial côté module, conforme au plan « les zones d'une card arrivent par le canal d'état normal »), diviser la sélection en 2 avec faux gap, fusionner la sélection, tout supprimer ; le tracé/la sélection/le redimensionnement/le déplacement sont les gestes natifs du module (souris directement sur le gabarit, pas de bouton). Enregistré dans `demo-registry.ts` et `main.ts` (`?demo=zone-editor`). `curl` confirme 200 sur la route et sur `main.ts` (le module qui importe la démo, donc toute erreur de compilation TS/import y serait remontée par Vite) ; typecheck `tsc --noEmit` du package `demos` propre. **Reste à confirmer visuellement par l'utilisateur** — je ne pilote aucun navigateur (cf [[reference-no-browser-automation]]).
9. **Intégration cs ↔ zones** : cibles de drop du cs restreintes aux zones quand elles existent (drop par référence de zone).

## Points arbitrés (réponses utilisateur, 2026-07-03)

1. **Contrat de zones** : pas de `grid-template-areas` — chaque zone est une classe CSS déterminant `row`, `col`, `rowSpan`, `colSpan`, générée par capsule-automation.
2. **Faux gap** : sert uniquement à la subdivision d'une zone en plusieurs parties (écart conservé entre chaque part) ; représente toujours un nombre de cellules contiguës. Pas d'aimantation au tracé.
3. **Gap CSS** : retiré pour les grilles fines (complication de rendu sans avantage) ; les gaps visuels sont des rangées/colonnes réservées, dont la grille simplifiée tient compte.
4. **Échelle et seuil** : grille jusqu'à ~160×90 (indicatif), représentée en 16×9 ou 32×18 ; si un gap est demandé et que la somme ne tombe pas juste (16 macro-cellules + 15 gaps > 160), réajuster le nombre de cols/rows au plus près. Le seuil de passage en basse définition est une valeur de config, à ajuster en réel.
5. **Ordre** : mode création d'abord, validé avant l'éditeur de zones ; à la création, le cadre passe en sélection régulière.
6. **Création = ajout au module selection, pas un module séparé** : une action qui permet de commencer par tracer un cs et de générer un item, avant de passer en mode sélection régulier. Comme pour la modification, la création est fonction du contexte (grille ou libre) — un outil distinct par contexte, avec ses contraintes propres.
7. **Pas d'extension capsule-automation** : le projet a déjà été prototypé, capsule-automation contient ce qu'il faut pour générer les zones (placement par lignes existant) — rien de spécial à créer.
8. **Presets = cards** : la notion recouverte par « preset » est la **card**, une notion éditeur — ensemble de zones pré-construites représentant un gabarit non régulier (ex. titre / corps / footer), stocké par l'éditeur et transmis au module. Les modules n'ont aucun catalogue propre ; la confirmation éventuelle avant application relève de l'éditeur.
9. **Presets de composition de grille** (10×5, 16×9, …) : également un réglage éditeur que le module n'a pas à connaître — il reçoit simplement une valeur de grille. Règle générale : tout catalogue vit dans l'éditeur, les modules ne reçoivent que des valeurs.

## Sujet reporté — unités adaptatives (cqw/cqh)

Lire et écrire les positions et dimensions **en pixels** est le choix le plus simple pour les modules, mais il a un défaut : il n'est **pas adaptatif** si la dimension du conteneur du player change. Le positionnement grid existe précisément pour cela — il est **adaptatif par nature** (emprises en pistes, pas en px). Pour le mode libre, des unités liées au conteneur existent désormais (`cqw`, `cqh` — container query units).

La **transformation des valeurs pixel et leur consolidation en `cq*`** est un sujet distinct du présent plan. Deux localisations possibles : un **middleware** entre ces modules et capsule-automation, ou **directement dans capsule-automation**. Décision utilisateur : ce sujet est mis de côté, à reprendre **après l'intégration des modules**. Conséquence pour l'implémentation : les modules continuent d'émettre des pixels entiers (contexte libre) et des emprises de pistes (contexte grid) — rien à anticiper dans leurs contrats, la consolidation se fera en aval.

## Points ouverts restants

Aucun point bloquant. La phase 1 (mode création) peut démarrer.
