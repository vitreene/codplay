# Dedit — éditeur de décor : spécification

**Périmètre** : module `decor-editor` (« dedit ») dans `packages/editor`

---

## 1. Définition du projet

### 1.1 Ce que c'est

Dedit est le module d'édition directe du **décor** d'un item sélectionné. Il se présente
comme une palette flottante qui apparaît à la sélection d'un item et regroupe, par panneaux,
les propriétés d'apparence et de fonction de l'item :

- propriétés CSS, filtrées et regroupées par la configuration de palette selon le type d'item ;
- classes CSS et style libre (mini-éditeur de code pour l'utilisateur avancé) ;
- propriétés fonctionnelles : position d'appui (attache-flex), zone d'ancrage dans une
  capsule (§ 3.4, § 7), comportement du contenu d'une capsule (§ 8) ;
- application de presets de décor (§ 9).

Dedit est conçu pour un **utilisateur grand public**, pas spécialiste : les paramètres exposés
sont ceux que l'on retrouve dans les éditeurs de texte courants. L'ensemble des autres
propriétés CSS passe par le mini-éditeur de code, réservé de fait à l'utilisateur connaisseur.

### 1.2 Place dans l'éditeur

Trois modules d'édition directe se complètent :

| Module | Rôle |
|---|---|
| Cadre de sélection (`selection-frame`) | Géométrie par geste (move/resize/rotate/scale, placement grid, attache-flex) |
| Timeline (`sequence-editor`) | Association décor ↔ instant via keyframes, distribution capsule |
| **Dedit** | Édition du **décor complet** de l'item courant : contenu, style, offset et transform |

L'éditeur visuel de position (cadre de sélection inséré dans le player) est **sous la
responsabilité de dedit** : dedit pilote son activation et coordonne ses valeurs en temps réel
avec ses propres champs (§ 6).

### 1.3 Périmètre

Dedit produit un décor. **Hors périmètre** :

- la transformation décor → scène codplay (builder temps réel ; il a la charge de résoudre
  les propriétés non interpolables) ;
- le texte auto-adapté à son bloc et le scroll lent pour texte long — spec dans
  `2026-07-07-text-auto-size-spec.md`, package autonome structuré de façon identique
  à `capsule-automation` ;
- multi-story et straps : non accessibles à l'utilisateur — l'éditeur produit **une story**
  avec ses persos ;
- les collections de presets et l'enregistrement de presets de décor par l'utilisateur ;
- l'import de texte (seule la saisie dans une zone dédiée de dedit est retenue) ;
- la coopération des modules dans l'application éditeur complète (builder, sélecteur d'item,
  chutier, barre de menu, télécommande).

---

## 2. Vocabulaire

| Terme | Définition |
|---|---|
| **item** | Entité éditeur ; devient un perso codplay après build. Une **capsule** est un item conteneur (perso `list` ou `layout` côté codplay — « capsule » est une notion inconnue de codplay) |
| **décor** | État visuel et fonctionnel d'un item à un instant. Concrètement : un **écart** stocké + une chaîne d'héritage |
| **écart** (`DecorPatch`) | Ensemble des propriétés effectivement modifiées par rapport à la base héritée — c'est ce que dedit produit et ce qui est stocké |
| **décor résolu** (`ResolvedDecor`) | Résultat du repli de la chaîne : défauts de l'item ⊕ écart₁ ⊕ … ⊕ écartₙ |
| **défauts** | Valeurs par défaut configurées, attribuées à tout nouvel item ; elles font partie des presets disponibles pour un item |
| **preset** | Écart nommé, réutilisable hors de tout item, appliqué en une opération (fusion). Porte l'apparence uniquement — jamais position/zone |
| **zone** | Région nommée prédéfinie dans une capsule ; les items enfants s'y placent par décor, par référence au **nom** |
| **card** | Table de zones enregistrée comme preset (ex. titre/corps/footer), applicable à une capsule en une opération. Le nom « card » est réservé à cet usage |
| **contexte d'orientation** | Orientation *ressentie* du conteneur-root, déduite de son rapport largeur/hauteur (pas de media/container query CSS) : `horizontal` ou `vertical` |
| **panneau** (`PalettePanel`) | Regroupement d'affichage dans la palette (ex. « Forme », « Typo ») — indépendant de la structure interne du décor, configuré par l'hôte, jamais câblé en dur dans dedit (§ 4 bis) |

Convention de nommage : la prose du projet est en français, **tous les identifiants de code
(types, propriétés, événements) sont en anglais informatique**.

---

## 3. Modèle de données

### 3.1 Écart et héritage

Un décor **hérite d'un autre** — le plus souvent du décor précédent sur la timeline.
Le tout premier décor d'un item n'a pas d'héritage : il part des défauts configurés.
Tout écart saisi par l'utilisateur est ajouté dans le décor ; les propriétés non touchées
restent héritées.

```
décor résolu (kf n) = défauts ⊕ écart(kf 1) ⊕ écart(kf 2) ⊕ … ⊕ écart(kf n)
```

La fusion `⊕` est une fusion profonde par propriété feuille.

Sémantique du patch :

- **propriété absente** de l'écart → héritée ;
- **propriété présente** → écart explicite, même si la valeur saisie est numériquement égale
  à la valeur héritée (l'intention prime — pas de normalisation silencieuse) ;
- **`null`** → neutralisation explicite : retour au défaut de l'item pour cette propriété,
  en court-circuitant l'héritage (ex. `zone: null` = abandon de toute zone, l'item occupe
  la surface de la capsule).

**Contrôle « hériter »** — par propriété :

- chaque champ affiche son état : valeur héritée (rendu atténué) ou écart (rendu plein +
  marqueur d'écart). Le marqueur est cliquable et retire l'écart de la propriété : le champ
  raffiche la valeur héritée ;
- **vider un champ équivaut à retirer l'écart** : la valeur héritée réapparaît. Cela vaut
  aussi pour `custom` — effacer le contenu du mini-éditeur affiche le CSS custom hérité
  (rendu atténué) ;
- masqué en multi-sélection (§ 7 bis) : le marqueur n'a pas de sens à agréger, puisque les
  items peuvent avoir des chaînes d'héritage différentes ;
- fonction de domaine : `stripInherited(patch, path)`, où `path` désigne une propriété
  feuille (ex. `"style.font-size"`).

**Révision de la chaîne d'héritage** : le déplacement d'un keyframe sur la timeline peut
réordonner la chaîne. Aucun calcul spécial ni incrémental : l'hôte re-fournit la nouvelle
chaîne (`setChain`, § 4.3) et dedit refait le repli complet (`resolveDecor`) sur le nouveau
flux — les valeurs héritées affichées se rafraîchissent, l'écart en cours d'édition est
inchangé, l'état de la palette (panneau actif, etc.) n'est pas réinitialisé.

Dedit **ne connaît pas la timeline** : l'hôte décide quel écart est en cours d'édition et
fournit la chaîne d'héritage. La résolution est une fonction pure du domaine dedit,
exportée pour être réutilisée par le futur builder :

```typescript
resolveDecor(defaults: ResolvedDecor, patches: DecorPatch[]): ResolvedDecor
```

### 3.2 Structure de l'écart

Le décor regroupe des informations de nature différente : des propriétés CSS éditables,
d'autres non couvertes par une interface, des classes CSS nommées, des réglages de fonction
propres à l'item (capsule…), et un module de position dont les données ne sont pas
elles-mêmes des valeurs CSS mais en produisent en aval (transposées en styles/classes).

**CSS est un groupe unique et plat.** Il n'existe aucune sous-catégorie CSS dans le domaine :
il y a plus de 900 propriétés CSS, l'interface n'en couvrira jamais qu'une fraction
croissante, et cette couverture est une question d'**interface**, pas de modèle de données.
Le filtrage/regroupement thématique (quel onglet, quel ordre, quel type de contrôle) est
**entièrement** la responsabilité de la palette (§ 4 bis) — rien de cet ordre n'existe
au-delà du domaine.

```typescript
type OrientationContext = 'horizontal' | 'vertical'

interface FlexAnchor {
  alignSelf: 'start' | 'center' | 'end' | 'stretch'
  justifySelf: 'start' | 'center' | 'end' | 'stretch'
}

interface CapsulePatch {
  behavior?: string
  defaultTransition?: string
  sequencing?: 'sequential' | 'stagger'
  staggerMs?: number
  grid?: { rows: number; cols: number } | { preset: string }
}

/** Module non-CSS transposé en aval (styles/classes) — premier exemple d'une famille
 *  de modules (bordures par côté, clip-path…) chaque fois qu'une interface intermédiaire
 *  est nécessaire pour éditer confortablement une notion géométrique. */
interface OffsetPatch {
  x?: number; y?: number; width?: number; height?: number   // cqw
  ratio?: number | null          // contrainte l/h ; null = libre
  anchor?: FlexAnchor            // position d'appui, résolue par l'attache-flex
  translate?: { x: number; y: number }   // cqw
  rotate?: number                 // degrés
  scale?: { x: number; y: number }
}

interface DecorPatch {
  /** Carte OUVERTE : clé = nom de propriété CSS, valeur = chaîne CSS DÉJÀ FINALE
   *  (jamais de valeur intermédiaire à convertir en aval). Aucune propriété
   *  nommée en dur dans le domaine. */
  style?: Record<string, string>
  /** Même modèle que le runtime codplay (`ClassNameValue`, cf perso-shared-types) :
   *  remplacement total via une chaîne, ou patch { add?, remove? } sur tokens espacés. */
  classes?: string | { add?: string; remove?: string }
  offset?: OffsetPatch            // transform et dimensions ; le placement de grille reste séparé
  zone?: string | null           // référence PAR NOM ; null = surface de la capsule
  capsule?: CapsulePatch          // items capsule uniquement (§ 8)
  text?: string                   // contenu textuel (saisie dans dedit)
  custom?: string                 // mini-éditeur de code : CSS libre, responsabilité auteur
}
```

Notes :

- **`style`** : chaque valeur est produite par la palette **avant** d'être écrite ici — un
  contrôle convivial (nombre sans unité affichée, curseur 0–100…) résout immédiatement sa
  saisie en valeur CSS finale (ex. `"4cqw"`, `"oklch(0.7 0.15 240)"`, `"bold"`) ; aucun format
  intermédiaire n'est stocké dans le décor. La couleur suit cette même règle — pas de type
  structuré dédié dans le domaine ; elle pourra devenir un module à part (comme `position`)
  si son édition a besoin d'un état structuré propre (roue teinte/chroma, dégradés à
  plusieurs arrêts…).
- **`classes`** : réutilise le modèle du runtime codplay (`ClassNameValue`,
  `packages/codplay/src/runtime/perso-shared-types.ts`) — un seul modèle de classes CSS dans
  tout le projet. La fusion d'écarts successifs suit le même algorithme que
  `applyClassNamePatch` (add/remove sur `Set<string>`), en pur (sans DOM) puisqu'on compose
  des patches, pas un élément réel.
- **`text`** : la saisie du contenu textuel se fait dans une zone dédiée de dedit ;
  l'adaptation automatique au bloc (coche « auto », module `textAutoSize`) relève du projet
  texte (`2026-07-07-text-auto-size-spec.md`), hors périmètre — seul l'emplacement de la coche
  dans la palette est réservé.
- **`custom`** : aucune validation bloquante. L'auteur y met ce qu'il veut, unités
  comprises ; si ça casse, c'est sa responsabilité. Le contenu est stocké tel quel dans
  l'écart et prime sur `style` (dernier appliqué).
- **`offset.ratio`** : quand il est posé, largeur et hauteur sont liées dans les champs de
  dedit ; la contrainte est aussi communiquée au cadre de sélection (politique de poignées).

### 3.3 Unités : cqw exclusif

Principe fort du player : **jamais de scale global** pour adapter le rendu à son conteneur —
les propriétés CSS sont utilisées pleinement. Les scènes sont distribuées en diffusion ;
le player ne connaît jamais à l'avance les contraintes d'affichage, le pixel est donc inapte.

- Une **seule unité, `cqw`** (proportionnelle à la largeur du conteneur), pour toutes les
  grandeurs — y compris verticales : homothétie maintenue mécaniquement, repère d'échelle
  univoque.
- Les unités **ne s'affichent jamais** dans dedit : elles restent abstraites pour
  l'utilisateur — la palette les ajoute au moment de produire la chaîne CSS finale (config
  centralisée `css-value-format.ts` : certaines propriétés comme `order`/`z-index`/`opacity`/
  `font-weight`/`line-height` acceptent un nombre nu, sans unité). Seul `custom` expose des
  unités, choisies par l'auteur.
- Un **facteur d'échelle** par propriété (même config centralisée) ajuste la granularité
  perçue de la saisie : une valeur tapée n'est pas nécessairement écrite telle quelle en cqw
  — pour des grandeurs fines (épaisseur de bord, rayon, padding), un facteur inférieur à 1
  rapproche l'unité saisie du rendu visuel réel. Ce facteur est une évaluation empirique,
  ajustable sans toucher au reste du code.
- Le cadre de sélection émet et reçoit des valeurs en px locaux : la **conversion
  px ↔ cqw est localisée dans l'intégration V2 de decor-editor** (§ 6), jamais dans le cadre de sélection
  ni dans le modèle de décor.

### 3.4 Zones et contexte d'orientation

Les zones appartiennent à l'**item capsule** (données d'item, pas de décor). Les décors des
enfants les référencent par nom uniquement — ils sont donc insensibles au contexte.

```typescript
type ZoneCoords = { x: number; y: number; width: number; height: number }  // cqw, relatif à la capsule

type ZoneDef =
  | { name: string; coords: ZoneCoords }                                  // partagée entre contextes
  | { name: string; contexts: Record<OrientationContext, ZoneCoords> }   // explicite par contexte

type ZoneTable = ZoneDef[]

/** Table de zones enregistrée comme preset. */
interface ZoneCard {
  name: string
  zones: ZoneTable
}
```

- L'orientation CSS native opère au niveau fenêtre/appareil ; le scope étant le
  conteneur-root, l'orientation **ressentie** est déduite du rapport largeur/hauteur du
  conteneur et propagée par l'hôte à dedit (pas de règle CSS à proprement parler). Seuil :
  ratio largeur/hauteur ≥ 1 → `horizontal`, sinon `vertical` ; pas d'hystérésis.
- Une zone définie une seule fois garde ses coordonnées dans tous les contextes.
  Dès qu'elle est **modifiée dans un contexte distinct**, elle bascule en forme explicite :
  toutes ses coordonnées doivent alors être définies par contexte (la forme partagée est
  copiée comme base des deux contextes, puis la modification s'applique au contexte actif).
- Seules les zones varient par contexte. Le reste du décor est invariant d'orientation.
- La zone par défaut est la surface de la capsule ; un enfant peut changer de zone ou
  abandonner toute zone (`zone: null`).
- Au build (hors périmètre), la relation zones ↔ enfants est réalisée par des classes CSS
  générées via `capsule-automation` à partir des informations de dedit.

---

## 4. Architecture

Même architecture en couches que `sequence-editor` et `selection-frame` :

```
domaine (pur) → machine XState → contrôleur → rendu
```

Emplacement : `packages/editor/src/decor-editor/` (même package que sequence-editor, dedit
est un module d'UI éditeur ; l'intégration applicative du cadre est composée dans
`packages/editor/src/app/bridges/`, avec `packages/authoring/selection-frame` comme outil bas niveau).

### 4.1 Domaine (pur, testable sans DOM)

- Types du modèle (§ 3) ;
- `resolveDecor(defaults, patches)` — repli d'héritage ;
- `mergePatch(patch, addition)` — fusion profonde (saisie utilisateur, application de preset) ;
- `stripInherited(patch, path)` — retrait d'un écart par propriété feuille (contrôle « hériter ») ;
- conversions px ↔ cqw (fonctions pures, la référence de largeur est un paramètre).

Le domaine ne connaît **aucune notion de regroupement d'affichage** (pas de « panneau ») —
cf § 4 bis pour la séparation stricte contrat/rendu.

### 4.2 Machine XState

```
inactive
active(items[])
  activePanelId : string           (identifiant opaque, résolu par PaletteConfig côté rendu)
  visualPosition : off | on        (bascule ; on = cadre de sélection actif, § 6)
  zoneMode : off | on              (item capsule uniquement, § 7)
```

Les événements de la machine sont indépendants de la modalité d'entrée (souris/tactile),
comme pour le sequence-editor. `activePanelId` est une chaîne libre — la machine ne valide
pas son appartenance à une configuration de panneaux, c'est le rôle du contrôleur/rendu.

### 4.3 Contrôleur — API publique

```typescript
interface DecorEditorOptions {
  mountTarget: HTMLElement                 // hôte de la palette flottante
  catalogs: {
    presets: DecorPreset[]                 // fichier de règles en dur
    cards: ZoneCard[]                      // presets de zones (§ 7)
    palette: PaletteConfig                 // panneaux + visibilité par type (§ 4 bis)
  }
}

interface DecorEditorApi {
  attachItems(inputs: {                    // item unique = tableau à 1 élément (§ 7 bis)
    itemId: string
    itemType: ItemType
    defaults: ResolvedDecor
    chain: DecorPatch[]         // écarts antérieurs (chaîne d'héritage)
    patch: DecorPatch           // écart en cours d'édition
    zones: ZoneTable            // zones du conteneur capsule de l'item
    context: OrientationContext
  }[]): void
  detach(): void
  setContext(ctx: OrientationContext): void
  setChain(itemId: string, chain: DecorPatch[]): void   // révision d'héritage (déplacement de kf) :
                                                         // repli complet, sans réinitialiser l'état de la palette
  selectPanel(panelId: string): void
  getPanelsForCurrentItems(): string[]     // intersection par type (§ 7 bis)

  onDecorChange(cb: (entries: { itemId: string; patch: DecorPatch }[]) => void): Unsubscribe
  onZonesChange(cb: (zones: ZoneTable) => void): Unsubscribe   // mode zones (§ 7)

  getPresets(): DecorPreset[]              // catalogue, pour le panneau preset-list (§ 9)
  applyPreset(name: string): void
  destroy(): void
}
```

Point d'entrée : `createDecorEditor(options): DecorEditorApi` (le surnom « dedit » reste
documentaire).

Règles :

- dedit ne stocke rien durablement : l'hôte est propriétaire des données d'item et de la
  chaîne d'héritage ; dedit édite l'écart courant et l'émet ;
- `onDecorChange` émet l'écart **complet** de chaque item affecté à chaque modification
  (pas de deltas à réassembler côté hôte) — émission continue pour les contrôles continus
  (curseurs, palette de couleur, gestes du pont position), émission au change pour les
  champs texte ;
- les catalogues sont des **valeurs** fournies à la construction (tout catalogue vit dans
  l'éditeur, les modules ne reçoivent que des valeurs). Le fichier de presets en dur vit
  côté éditeur et est passé dans `catalogs.presets` ; la configuration de panneaux dans
  `catalogs.palette` (§ 4 bis).

### 4.4 Rendu

Couche remplaçable, consommant `PaletteConfig` — cf § 4 bis. Palette flottante ; un panneau
par entrée de `panelsByItemType`, seuls les panneaux pertinents pour le(s) type(s) d'item
attaché(s) sont visibles. Champs numériques sans unité affichée. Prévoir les cibles tactiles
(mêmes contraintes iPad que le sequence-editor : `LayoutProfile`).

**Palette de couleur** : composant propre à dedit, orienté oklch ; les conversions et
manipulations de couleur s'appuient sur le package npm `color` (^5.0.3), dépendance de
`packages/editor`. Le package sert uniquement aux conversions hex↔oklch du sélecteur
(`<input type="color">` natif) — jamais à reparser une chaîne oklch déjà stockée dans le
décor : c'est le **navigateur** qui fait autorité sur l'interprétation CSS au rendu final.

**Plans d'affichage (z-index)** : plusieurs composants « demandent » le premier plan et
peuvent entrer en conflit — un pop-up d'un côté, l'éditeur de position de l'autre, le player
avec ses overlays… Règle : **aucun module ne code de z-index absolu**. L'application hôte
définit une échelle de plans unique sous forme de tokens (ex. variables CSS
`--layer-player-overlay` < `--layer-position-editor` < `--layer-palette` < `--layer-popup`)
et chaque module consomme le sien. Dedit reçoit son plan via le style de son `mountTarget` ;
ses propres pop-ups internes (palette de couleur dépliée, liste de presets) se placent un
cran au-dessus de son plan de base, jamais au-dessus du plan `popup` de l'hôte.

---

## 4 bis. Moteur de panneaux de palette — séparation contrat/rendu

Le module se scinde en deux couches strictement séparées :

1. **Contrat** — le décor (§ 3), la résolution d'héritage, la fusion de patch, la
   multi-sélection au niveau valeur (`resolveField`, `hasOwnPatch`) : rien de tout cela ne
   connaît la notion de panneau ou d'onglet.
2. **Rendu** — dupliquable/adaptable sans toucher au contrat, piloté par une configuration
   fournie par l'hôte (`PaletteConfig`), jamais câblée en dur dans dedit.

```typescript
type PanelId = string
type PanelFieldKind = 'color' | 'number' | 'slider' | 'boolean' | 'select' | 'icon-select' | 'text'

/** Nom d'icône du catalogue de glyphes du rendu (ex. "bold", "align-left") — pas un chemin de fichier. */
type IconName = string

interface IconOption { value: string; icon: IconName }

interface PanelField {
  path: string          // chemin dans DecorPatch : "style.background-color", "style.border-width"…
  kind: PanelFieldKind
  label: string
  options?: string[]      // pour kind: 'select'
  iconOptions?: IconOption[]  // pour kind: 'icon-select' — boutons icônes sans label
  trueValue?: string | boolean   // pour kind: 'boolean' — valeur si actif : CSS pour un champ
                                  // sous style.* (ex. "bold"), vrai booléen pour un module hors
                                  // style (ex. textAutoSize.enabled) — défaut `true` si omis
  falseValue?: string | boolean  // symétrique, défaut `false` si omis
  icon?: IconName         // pour kind: 'boolean' — icône affichée à la place du label texte
  min?: number; max?: number; step?: number   // pour kind: 'slider' — bornes (valeurs saisies, avant échelle)
}

type PalettePanel =
  | { id: PanelId; label: string; fields: PanelField[] }
  | { id: PanelId; label: string; kind: 'custom-code' }   // mini-éditeur, cas spécial (§ 9)
  | { id: PanelId; label: string; kind: 'preset-list' }   // liste de presets, cas spécial (§ 9)

interface PaletteConfig {
  panels: PalettePanel[]
  panelsByItemType: Record<ItemType, PanelId[]>   // visibilité par PANNEAU entier, pas par champ
}
```

- Un panneau lit des champs de **n'importe quelle propriété CSS de `style`**, plus
  éventuellement `custom`/`classes`/`offset.*` — ex. un panneau « Forme » peut regrouper
  `style.background-color`, `style.border-color`, `style.border-width`,
  `style.border-radius`, `style.padding` : un regroupement purement thématique, sans rapport
  avec une structure du décor (`style` est un groupe plat unique, § 3.2).
- Deux panneaux spéciaux ne portent pas de liste de champs, chacun un seul contrôle par
  nature : `custom-code` (mini-éditeur, § 9) et `preset-list` (liste des presets du
  catalogue, chaque clic fusionne le patch du preset dans l'écart courant — § 9). Un preset
  est une **action** (fusion d'un patch complet), pas une propriété éditable ; il ne rentre
  donc pas dans le modèle `PanelField`.
- `panelsForType`/`panelsForTypes` (domaine) calculent la visibilité/intersection sur des
  ids de string configurés — aucune liste figée dans dedit.
- Le rendu (`render.ts`) dispatch un unique `renderField(field)` par `field.kind` — aucune
  fonction dédiée par nom de panneau.
- **dedit ne fournit aucun panneau par défaut câblé en dur.** La configuration de panneaux
  est fournie par l'hôte à la construction — celle utilisée par la démo de référence
  (`dedit-demo.ts`) est un exemple d'usage du moteur, pas une norme imposée par dedit.

---

## 5. Panneaux visibles par type d'item (exemple de référence)

Configuration de la démo de référence (`dedit-demo.ts`) — un exemple parmi d'autres
possibles qu'un hôte peut fournir (§ 4 bis) :

| Type d'item | Forme | Typo | Dimensions | Custom | Presets |
|---|---|---|---|---|---|
| texte | ✓ | ✓ | ✓ | ✓ | ✓ |
| media (image, vidéo…) | ✓ | — | ✓ | ✓ | ✓ |
| capsule | ✓ | — | ✓ | ✓ | ✓ |

La zone d'ancrage (choix de la zone) apparaît sur tout item enfant d'une capsule qui
possède des zones définies — à intégrer à une configuration de panneaux dédiée (§ 7).

---

## 6. Cadre de sélection — interface V2 de `decor-editor`

Le cadre de sélection est une surface d'interaction de `decor-editor`. Le package
`selection-frame` fournit le mécanisme bas niveau de l'overlay et des gestes ; il ne
connaît ni le player, ni `instance.snapshot`, ni le document, ni la conversion d'unités.
L'intégration applicative est portée par `decor-editor-bridge`.

La première verticale V2 manipule la valeur suivante dans le repère local px de la racine
de scène :

```typescript
interface SelectionFrameValue {
  x: number
  y: number
  width: number
  height: number
  rotate?: number       // degrés, sans conversion d'unité
  scaleX?: number       // facteur, sans conversion d'unité
  scaleY?: number       // facteur, sans conversion d'unité
}

type SelectionFrameDelta =
  | { kind: 'move'; dx: number; dy: number }
  | { kind: 'resize'; handle: string; dx: number; dy: number }
```

Le circuit est déterministe :

1. à la sélection, `decor-editor-bridge` lit `instance.snapshot.get()` via le bridge de
   coordination et résout l'état logique de l'item au temps présenté ;
2. il convertit `x/y/width/height` en px avec la largeur de la racine de scène et remet
   cette valeur au cadre ; le cadre n'effectue aucune lecture du node rendu ;
3. pendant un geste, le cadre émet des deltas px. Le bridge conserve la base du geste,
   calcule la valeur candidate en px et convertit cette valeur en nombres `unitless` dans
   `offset.translate`, `offset.width` et `offset.height` ;
4. le même patch de décor peut contenir des changements de style. Il est envoyé
   atomiquement à `instance.snapshot.set()` pour la preview ; `snapshot.get()` n'est pas
   utilisé pour relire cette preview ;
5. un commit appelle `snapshot.clear()`, persiste le `DecorPatch` par la commande xState
   historique, puis le rebuild V2 relit le snapshot ; un abandon appelle `snapshot.clear()`
   sans mutation documentaire ;
6. en lecture, le cadre est suspendu. Un seek, un rebuild, une nouvelle sélection ou un
   redimensionnement de la racine déclenche une nouvelle projection depuis la base logique.

### 6.1 Édition à un temps interpolé (contrat V2)

Entre deux keyframes, `decor-editor-bridge` peut résoudre une cible avec
`isTemporary: true`. Ce statut signifie uniquement qu'aucun décor documentaire
ne correspond encore à l'instant ; il ne rend pas le cadre ni les panneaux
en lecture seule.

- Un geste du cadre ou une modification de palette est accepté comme preview
  par `instance.snapshot.set()`, avec le même `DecorPatch` candidat pour le
  cadre et les panneaux.
- Le candidat est conservé dans le port de coordination, séparément de
  `snapshot.get()` qui exclut la preview active. Un seek, un rebuild ou une
  reselection à ce même temps peut donc réafficher ce candidat.
- Aucune commande documentaire n'est émise pour cette cible temporaire.
  La persistance intervient seulement lorsqu'un keyframe est créé à cet
  instant : la coordination transmet le candidat, crée un décor frais et le
  remplit dans la même transaction xState. Le nouveau keyframe devient alors
  la cible documentaire des éditions suivantes.
- Le temps auteur du candidat est rapproché du temps de création arrondi de
  la timeline dans une tolérance d'un demi-pas (`50 ms` pour le pas V2 de
  `100 ms`) ; cette tolérance ne change jamais le `timeMs` enregistré du
  keyframe.
- Un abandon explicite efface la preview et le candidat sans mutation du
  document.

Le bridge est une composition de l'application, pas une option du contrôleur `dedit` et
pas une API CodPlay. Cette verticale n'expose aucune façade publique de géométrie,
de pose ou d'accès au node du player.
Les notions de placement de grille et d'attache-flex restent des extensions séparées ;
elles ne doivent pas réintroduire une lecture de node dans le circuit position/taille.

---

## 7. Zones — mode « zones » et cards

Un item capsule sélectionné (y compris l'item root de la scène), le mode zones s'active
depuis dedit :

- le **tracé et la géométrie** des zones relèvent de l'éditeur visuel de zones
  (`createZoneEditor`, module distinct, même package que selection-frame) ;
- côté dedit, une **palette de zones** permet de nommer, sélectionner et supprimer chaque
  zone ; dedit émet la table à jour via `onZonesChange` ;
- la bascule de forme partagée → forme par contexte (§ 3.4) est opérée par le domaine dedit
  au moment où une zone est modifiée dans un contexte distinct de celui de sa définition.

**Cards** : une table de zones peut être enregistrée comme preset — une *card*
(ex. titre/corps/footer). Le catalogue de cards vit côté éditeur (`catalogs.cards`) ;
appliquer une card installe sa table de zones dans la capsule (même logique de fusion-écrasement
que les presets de décor : jamais prioritaire sur une modification postérieure).

Contrat dedit ↔ éditeur de zones : même philosophie que le pont position — dedit reçoit et
émet des **valeurs** (`ZoneTable`), l'éditeur visuel reçoit la géométrie à afficher et émet
les géométries tracées/modifiées.

---

## 7 bis. Multi-sélection

Le cadre de sélection possède un mode multi-item (`createMultiSelectionFrame`) : un cadre
unique sur la boîte englobante, qui diffuse le même diff brut à chaque adaptateur. Ce
modèle ne se transpose pas tel quel à dedit — un décor n'est pas un geste homogène mais un
ensemble de propriétés hétérogènes, potentiellement différentes d'un item à l'autre.

**Principe** : l'édition multiple n'a de sens que pour des items **structurellement
proches** (ex. plusieurs items texte auxquels on veut donner la même couleur) — dedit ne
prétend pas éditer un mélange arbitraire de types.

- **Panneaux visibles = intersection** des panneaux pertinents pour chaque type d'item
  sélectionné (`panelsForType` appliqué à chaque item, puis intersection — § 4 bis). Un
  mélange de types ne montre que les panneaux communs à toutes leurs configurations.
- **Affichage d'un champ** : si tous les items sélectionnés résolvent la même valeur pour
  cette propriété, le champ l'affiche normalement. Si les valeurs **divergent**, le champ
  affiche un **état mixte** (vide/indéterminé, à l'image des éditeurs de texte usuels face à
  des styles hétérogènes) — jamais une valeur arbitrairement choisie parmi elles.
- **Saisie sur un champ mixte ou non** : la valeur saisie est appliquée en écart
  (`PATCH.APPLY`) à **chaque item** de la sélection, identiquement — c'est un patch appliqué
  N fois, jamais un patch partagé ou une moyenne.
- **Contrôle « hériter » masqué en multi-sélection** : le marqueur d'écart par propriété n'a
  pas de sens à agréger (les items peuvent avoir des chaînes d'héritage différentes, donc des
  valeurs héritées différentes après retrait). Le contrôle disparaît de la palette tant que
  plus d'un item est sélectionné ; l'utilisateur revient en sélection simple pour gérer
  l'héritage précisément item par item.
- **Zones, capsule, position** : hors périmètre de l'édition groupée dedit (comme pour
  `createMultiSelectionFrame`, où grid/preset/adapter/creation restent inertes en
  multi-item) — ces panneaux ne sont édités qu'en sélection simple.

### API — extension du domaine et du contrôleur

```typescript
/** Résout l'état d'un champ à travers plusieurs décors résolus : valeur commune ou mixte. */
type FieldState<T> = { kind: 'uniform'; value: T } | { kind: 'mixed' }

function resolveFieldAcrossItems<T>(decors: ResolvedDecor[], path: string): FieldState<T>
```

Contrôleur : `attachItems(inputs: AttachItemInput[])` couvre la sélection simple et
multiple (item unique = tableau à un élément, pas une API séparée). `applyPatch` s'applique
alors à chaque item attaché ; `stripInherited` est un no-op tant que `items.length > 1`
(garde-fou explicite, cf règle « hériter masqué » ci-dessus).

---

## 8. Capsule — module contenu

Pour un item capsule, dedit expose le paramétrage du comportement dynamique des enfants,
en s'adossant aux specs existantes (`2026-06-12-capsule-distribution-spec.md`,
`2026-06-11-sequence-editor-grid-spec.md`) :

```typescript
interface CapsulePatch {
  behavior?: string                // preset de comportement, ex. "carousel"
  defaultTransition?: string       // transition d'apparition/disparition par défaut
  sequencing?: 'sequential' | 'stagger'
  staggerMs?: number
  grid?: { rows: number; cols: number } | { preset: string }   // presets de grilles non régulières
}
```

- Ces réglages sont les **défauts de la capsule** : ils sont overridés par les choix
  individuels posés sur un item particulier (kf réels de la timeline, cf spec distribution).
- Dedit édite les valeurs ; la résolution temporelle (kf virtuels, slots…) reste du ressort
  du module de distribution.
- La grille CSS de la capsule (rows/cols, presets de grilles non régulières) est éditée
  ici ; sa matérialisation (classes, inlineStyle) passe par `capsule-automation` au build.
  Le nom « cards » n'est **pas** employé pour les presets de grille : il est réservé aux
  presets de zones (§ 7).

---

## 9. Presets de décor

Un preset est un écart nommé, enregistré hors de tout lien à un item :

```typescript
interface DecorPreset {
  name: string
  patch: DecorPatch    // jamais position, zone, capsule
}
```

- **Fichier de règles en dur** côté éditeur, accessible via un panneau dédié de la palette
  (`kind: 'preset-list'`, § 4 bis) — pas un widget externe à la palette. Contenu typique :
  étiquettes texte (taille typo + fond de couleur). Des réglages fins (ex. box-shadow)
  peuvent y figurer via `custom`, sans éditeur dédié.
- **Application = fusion** dans l'écart courant (`mergePatch`) : le preset écrase les
  propriétés qu'il porte, laisse le reste intact, et **aucun lien vivant n'est conservé** —
  un preset n'est donc jamais prioritaire sur un choix utilisateur postérieur, par
  construction.
- Les presets ne portent **jamais** de notion de position (ni zone) : ce n'est pas leur but ;
  le décor, lui, en tient compte.
- Les défauts d'un nouvel item font partie des presets disponibles pour cet item.
- Au build (hors périmètre), un preset se matérialise en classe CSS.
- Enregistrement de presets par l'utilisateur, regroupement en collections : hors périmètre.
