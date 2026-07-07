# Texte auto-adapté — spécification

**Périmètre** : package autonome `packages/authoring/text-auto-size/`, structuré comme
`packages/authoring/capsule-automation/` (composant TypeScript pur, sans dépendance DOM
persistante, déplaçable). Consommé par dedit (`packages/editor/src/decor-editor/`) ; référencé
depuis `2026-07-07-dedit-spec.md` §1.3 et §3.2 (hors périmètre de dedit v1).

Remplace `2026-07-07-dedit-texte-auto-size-hypothese.md`, dont les points ouverts sont
tranchés ci-dessous.

---

## 1. Objectif

CSS n'offre pas nativement la capacité qu'un texte s'adapte à son propre bloc. Pour un bloc
de dimensions données, il faut chercher la taille optimale du texte, sans jamais déborder du
bloc. Cette fonctionnalité est activable par une coche « auto » dans dedit — l'emplacement de
la coche dans la palette est réservé par la spec dedit principale (`2026-07-07-dedit-spec.md`
§3.2).

Le calcul tient compte des réglages typo en vigueur (fonte, graisse, etc.) et est **figé au
build** : la taille résultante devient une valeur `cqw` fixe dans le décor, au même titre que
les autres propriétés `style` — aucun recalcul au runtime, cohérent avec le principe « jamais
de scale global » (`2026-07-07-dedit-spec.md` §3.3).

## 2. Deux modes, selon la longueur du texte

### 2.1 Texte court

Le texte tente d'être mono-ligne. S'il est plus long que ce que permet le bloc à la taille
courante, il passe sur plusieurs lignes. Dans tous les cas, le texte ne peut pas descendre
en dessous de la **taille limite de lisibilité** (§ 4).

**Seuil de longueur** : au-delà d'un nombre de caractères donné, le mono-ligne n'est même
pas tenté — quelle que soit la largeur du bloc, un texte trop long sur une seule ligne n'est
pas souhaitable visuellement, même si un calcul purement géométrique le permettrait à une
taille suffisamment petite. **Config par défaut : 30 caractères**
(`DEFAULT_SINGLE_LINE_MAX_CHARS`) — valeur arbitraire de départ, ajustée empiriquement selon
la pertinence perçue à l'usage.

Règles de clamp :

- si le texte est sous le seuil de longueur, rechercher la taille maximale qui tient en une
  seule ligne dans la largeur du bloc ;
- au-delà du seuil, ou si le mono-ligne ne tient pas même à la taille limite de lisibilité,
  passer en multi-ligne (retour à la ligne standard), toujours borné par la hauteur du bloc.

### 2.2 Texte long (plusieurs phrases, un paragraphe)

Un mode distinct, adapté aux textes trop volumineux pour le clamp mono/multi-ligne du § 2.1 :

- le texte est réduit à sa taille de clamp minimal (limite de lisibilité) ;
- si le texte est encore trop volumineux pour le bloc à cette taille minimale, un **scroll**
  est activé.

Le scroll est résolu par le **player** (pas par ce module) : une animation lente, verticale,
de haut en bas puis l'inverse, indéfiniment. Les paramètres précis de cette animation
(vitesse, easing, pause en haut/bas) restent un **point ouvert** — à trancher à l'ouverture
du chantier player correspondant, probablement configurables par preset comme le reste des
comportements de capsule (`2026-07-07-dedit-spec.md` § 8).

### 2.3 Élargissement de l'axe width (police variable)

Une fois la taille de police figée (§ 2.1, § 2.2 — mono-ligne ou multi-ligne uniquement, pas
en mode `scroll`), un second passage **élargit** l'axe `wdth` d'une police variable
(`font-stretch`) pour occuper davantage l'espace disponible en largeur, quand il en reste —
typiquement quand c'est la **hauteur**, pas la largeur, qui a borné la taille de police (bloc
large et peu haut, texte court). Objectif : remplir la largeur autorisée, pas simplement
éviter le débordement.

**Priorité — taille d'abord, largeur en dernier** : la recherche de taille (§ 2.1, § 2.2) se
fait toujours à `font-stretch: normal`, sans jamais la modifier. L'élargissement n'intervient
qu'**après**, sur le résultat déjà figé — jamais en concurrence avec la recherche de taille,
jamais pour rescaper un texte qui ne tiendrait pas (ce rôle reste au seuil de lisibilité et au
mode scroll).

**Granularité — 9 paliers fixes, pas un pourcentage continu.** Vérifié directement (pas une
supposition) : la propriété `fontStretch` du canvas 2D (mesure, § 3.1) n'accepte que les 9
mots-clés CSS standard, jamais une valeur `font-stretch` libre en pourcentage — seule
granularité mesurable de façon fiable :

| Mot-clé | % |
|---|---|
| `ultra-condensed` | 50 |
| `extra-condensed` | 62.5 |
| `condensed` | 75 |
| `semi-condensed` | 87.5 |
| `normal` | 100 |
| `semi-expanded` | 112.5 |
| `expanded` | 125 |
| `extra-expanded` | 150 |
| `ultra-expanded` | 200 |

L'élargissement ne teste que le sens expansif (`normal` → `ultra-expanded`), dans cet ordre :
le premier palier qui ne tient plus arrête la recherche, le dernier qui tenait est retenu.

**Lignes fixes.** Les retours à la ligne (mono-ligne : la ligne unique ; multi-ligne : le
résultat de § 2.1 à la taille retenue) ne sont **jamais recalculés** à un palier plus large —
seulement revérifiés à chaque palier testé. Un réajustement des coupures de ligne en fonction
de l'élargissement serait plus exact mais complexifierait la recherche pour un bénéfice
marginal — approximation documentée, cohérente avec § 3.2.

## 3. Mesure et conversion cqw

### 3.1 Environnement de mesure

La mesure ne se fait **pas** dans le DOM visible de dedit : un environnement de mesure séparé
([`OffscreenCanvas`](https://developer.mozilla.org/fr/docs/Web/API/OffscreenCanvas), jamais
rattaché au DOM — pas même un `<canvas>` détaché) reçoit fonte, graisse, taille candidate et
texte en entrée, et renvoie les dimensions résultantes (`measureText`, largeur ; hauteur de
ligne dérivée de la taille de police et du `line-height` forcé, § 5.1).

Ce choix isole le module de tout DOM monté, le garde réutilisable côté build futur (contexte
headless/Node avec implémentation canvas), et l'aligne sur la pureté de
`capsule-automation` (aucune dépendance DOM affichée, résultat déterministe à entrée
identique).

### 3.2 Recherche de la taille optimale

Recherche de la taille de police maximale qui satisfait la contrainte de bloc (§ 2), par
essais successifs dans l'environnement de mesure (§ 3.1) — algorithme de recherche
(dichotomie ou incrémentation) laissé à l'implémentation, sans contrainte normative ici.

Des **approximations sont tolérées** dans la mesure elle-même : la mise à l'échelle ultérieure
(cqw, § 3.3) absorbe les petits écarts entre la mesure canvas hors-écran et le rendu réel du
navigateur — la priorité est d'éviter les erreurs de mise à l'échelle, pas d'obtenir un
pixel-perfect au moment de la mesure.

**Marge de sécurité.** La mesure hors-écran (canvas, moteur de shaping/anti-aliasing propre)
et le rendu réel du DOM ne produisent jamais une largeur/hauteur rigoureusement identique
pour un même texte à une même taille — un écart de rendu, même infime, suffit à faire
basculer le texte d'un côté ou de l'autre de la frontière si la recherche s'arrête pile à la
taille mesurée comme tenant tout juste. La recherche (§ 3.2) est donc menée contre un bloc
réduit d'une **marge de sécurité** : `effectiveSize = blockSize × (1 - fitSafetyMargin)`,
appliquée à la largeur et à la hauteur avant tout essai de clamp. **Config par défaut :
`fitSafetyMargin = 0.02`** (2 % — `DEFAULT_FIT_SAFETY_MARGIN`), une fraction arbitraire de
départ, ajustée empiriquement à l'usage — même esprit que le seuil de lisibilité (§ 4) et le
seuil de longueur (§ 2.1) : une constante de config, pas un calcul.

### 3.3 Conversion en cqw

La mesure est nécessairement faite à une largeur de conteneur de référence, en pixels (dedit
édite dans un viewport concret). Conversion par règle de 3 simple, même principe que la
conversion px ↔ cqw déjà prévue pour le pont position (`2026-07-07-dedit-spec.md` § 3.3, § 6) :

```
fontSizeCqw = fontSizePx (mesuré) / largeurConteneurPx (au moment de la mesure) × 100
```

Pas de nouvelle mécanique de conversion : réutilisation du principe existant.

## 4. Seuil de la limite de lisibilité

Le seuil est une limite **physiologique**, donc exprimée en **px réels** — indépendante de la
fonte/graisse choisie — et non une constante `cqw` choisie a priori : `cqw` est par nature une
unité contextuelle (relative à la largeur du conteneur), inapte à représenter une limite
physique absolue.

**Config par défaut : 9px.** Valeur de départ, configurable (même esprit que le facteur
d'échelle centralisé de `css-value-format.ts`, `2026-07-07-dedit-spec.md` § 3.3) — ajustable
sans toucher au reste du code, affinée empiriquement par la suite.

Conversion en `cqw` pour une mesure donnée : même mécanique que § 3.3, avec la même
`referenceWidthPx` contextuelle (largeur réelle du conteneur au moment du calcul) — pas de
largeur de référence séparée à choisir :

```
minReadableSizeCqw = minReadableSizePx (config, 9 par défaut) / referenceWidthPx × 100
```

La valeur `cqw` qui en résulte est donc **contextuelle** (elle dépend du conteneur en cours
d'édition) ; elle ne doit jamais être franchie vers le bas par le calcul de clamp (§ 2), quel
que soit le contexte.

## 5. Emplacement dans `DecorPatch` — module `textAutoSize`

La coche « auto » ne peut pas vivre dans `style` (qui ne porte que des valeurs CSS finales,
`2026-07-07-dedit-spec.md` § 3.2). Elle vit dans un **nouveau module à part**, `textAutoSize`,
suivant le même principe que `position` — un module non-CSS transposé en aval :

```typescript
interface TextAutoSizePatch {
  enabled: boolean
}

interface DecorPatch {
  // ... (cf 2026-07-07-dedit-spec.md § 3.2)
  textAutoSize?: TextAutoSizePatch
}
```

- Réservé aux items de type texte (visibilité de panneau, cf `2026-07-07-dedit-spec.md` § 4 bis).
- Suit les mêmes règles d'héritage/écart que le reste du décor (§ 3.1 de la spec dedit) :
  propriété absente → héritée ; présente → écart explicite ; pas de valeur `null` distincte
  requise ici (`enabled: false` couvre la désactivation explicite).
- Quand `enabled: true`, le calcul (§ 2, § 3) produit un `style["font-size"]` résolu, écrit
  dans le décor résolu au build — pas dans l'écart brut de dedit. Il produit également
  `style["line-height"]` (§ 5.1) et `style["font-stretch"]` (§ 2.3) dans les mêmes conditions
  — ce dernier reste `"normal"` sauf en mono/multi-ligne avec de la largeur inoccupée.

### 5.1 Line-height forcé

Le calcul multi-ligne (nombre de lignes × hauteur de ligne ≤ hauteur du bloc, § 2.1, § 2.2)
a besoin d'une hauteur de ligne. Tant qu'`enabled: true`, le module impose une valeur fixe
**`line-height: 1.2`** (sans unité) — non lue depuis un éventuel réglage existant, non
éditable par l'utilisateur (hors champ pour l'instant ; dedit n'expose aujourd'hui aucun champ
`line-height` dédié, cf § 8). Cette valeur fait partie du résultat produit par
`computeTextAutoSize` (§ 8), au même titre que `font-size`.

## 6. Interaction avec `custom`

`custom` **prime toujours** sur le calcul de `textAutoSize`, cohérent avec la règle générale
du domaine dedit (`custom` prime sur `style`, dernier appliqué — `2026-07-07-dedit-spec.md`
§ 3.2). Si l'utilisateur pose une règle `font-size` (ou `line-height`, ou `font-stretch`) dans
le mini-éditeur de code alors que `auto` est coché, la valeur `custom` écrase le résultat du
calcul — même si ici le clamp est un calcul et non une simple valeur statique, la règle reste
uniforme et simple à expliquer à l'utilisateur : `custom` est toujours la dernière main, pour
les trois propriétés produites par `textAutoSize`.

## 7. Déclenchement du calcul et intégration avec `resolveDecor`

Le calcul est **continu** : recalculé à chaque frappe dans la zone de texte (`text`) et à
chaque changement de taille du bloc (`position.width`/`position.height`). Le coût des appels
répétés à l'environnement de mesure (§ 3.1) est accepté à ce stade ; une optimisation
(debounce, etc.) reste possible en implémentation sans être normative ici.

Le module `text-auto-size` ne connaît **aucun type de dedit** (`ResolvedDecor`, `DecorPatch`) —
même indépendance que `capsule-automation` vis-à-vis du domaine dedit. Deux consommateurs
distincts invoquent `computeTextAutoSize` (§ 8), avec la **même composition** (appeler
`resolveDecor` puis, si `enabled`, appeler `computeTextAutoSize` et écraser les deux champs de
style résultants) — aucun wrapper commun n'est requis autour de `resolveDecor`, cette
composition est de la responsabilité de chaque appelant, pas du module :

- **dedit**, en édition — le résultat est **renvoyé en direct à l'item affiché**, appliqué au
  décor résolu qui pilote son rendu réel pendant que l'utilisateur tape ou redimensionne le
  bloc (pas un aperçu détaché : l'item édité affiche réellement la taille calculée). Il n'est
  en revanche **jamais persisté** dans l'écart (`DecorPatch.textAutoSize` ne contient que
  `enabled`) — il est recalculé à chaque frappe/resize (continu, cf ci-dessus) ;
- le **builder** (hors périmètre ici, `2026-07-07-dedit-spec.md` § 1.3), pour la même fusion
  au moment de la transformation décor → scène codplay.

**Exception — mode `scroll` (§ 2.2)** : l'animation de défilement ne requiert **aucune
matérialisation pendant l'édition**. dedit applique la taille de clamp minimale
(`fontSizeCqw`/`lineHeight` du résultat), affichée figée, sans faire tourner le mouvement de
scroll sur l'item édité. Seul le pipeline builder → player matérialise l'animation réelle
(§ 2.2) sur la scène compilée, jouée par le player. dedit et builder partagent donc le même
calcul de taille, mais seul le player exécute l'effet animé.

## 8. Architecture du module

Même philosophie que `capsule-automation` : un composant pur qui ne touche jamais au DOM
affiché, ne dépend d'aucun framework, et calcule des artefacts à partir d'une entrée
déclarative.

```typescript
interface TextAutoSizeInput {
  text: string
  font: {
    family: string
    weight: string | number
    style?: 'normal' | 'italic'   // affecte les métriques de glyphe, pris en compte si posé
  }
  blockWidthCqw: number
  blockHeightCqw: number
  referenceWidthPx: number   // largeur du conteneur au moment de la mesure, pour conversion cqw
  minReadableSizePx?: number // seuil de lisibilité (§ 4) — config, 9 par défaut
  singleLineMaxChars?: number // seuil de longueur (§ 2.1) — config, 30 par défaut
  fitSafetyMargin?: number  // marge de sécurité (§ 3.2) — config, 0.02 par défaut
}

type FontStretchKeyword =
  | 'ultra-condensed' | 'extra-condensed' | 'condensed' | 'semi-condensed'
  | 'normal'
  | 'semi-expanded' | 'expanded' | 'extra-expanded' | 'ultra-expanded'

interface TextAutoSizeResult {
  mode: 'single-line' | 'multi-line' | 'scroll'
  fontSizeCqw: number   // en mode scroll : = minReadableSizeCqw (dérivé, § 4)
  lineHeight: 1.2
  fontStretch: FontStretchKeyword   // "normal" sauf mono/multi-ligne avec largeur inoccupée (§ 2.3)
}

function computeTextAutoSize(input: TextAutoSizeInput): TextAutoSizeResult
```

- `computeTextAutoSize` est la fonction d'entrée principale, pure vis-à-vis de son appelant
  (l'environnement de mesure canvas hors-écran est un détail d'implémentation interne, pas un
  paramètre injecté par l'appelant — au même titre que `capsule-automation` ne demande pas au
  consommateur de lui fournir le DOM). Elle suppose la fonte déjà chargée (`document.fonts`) :
  garantir le chargement avant l'appel est une **précondition de l'appelant** (dedit ou
  builder), pas une responsabilité du module — mesurer avec une fonte non chargée retomberait
  silencieusement sur une fonte de repli du navigateur, sans erreur.
- `minReadableSizePx` est reçu en px (config, § 4) ; la fonction dérive elle-même
  `minReadableSizeCqw` via `referenceWidthPx`, avec la même formule que le reste du calcul
  (§ 3.3) — un seul mécanisme de conversion dans tout le module.
- `lineHeight` est toujours `1.2` en sortie (§ 5.1) — constante interne, pas une entrée : le
  module ne lit aucun `line-height` existant, il impose systématiquement cette valeur tant que
  le calcul est actif.
- `fontStretch` (§ 2.3) est calculé après la taille, jamais en entrée — l'élargissement est
  entièrement automatique, aucune configuration exposée au-delà des 9 paliers fixes.
- Le mode `scroll` ne produit pas d'animation : il signale seulement que le player doit
  activer son comportement de scroll (§ 2.2). Les paramètres d'animation restent un point
  ouvert (§ 2.2).

## 9. Points restant ouverts

- Paramètres de l'animation de scroll (§ 2.2) — vitesse, easing, pause en haut/bas ; réservés
  à un chantier preset ultérieur côté player.
- Algorithme précis de recherche de taille (dichotomie vs incrémentation, § 3.2) — laissé à
  l'implémentation, sans impact sur le contrat public du module.
- Valeur par défaut du seuil de lisibilité (9px, § 4) affinée empiriquement une fois le
  module en usage réel.
- Valeur par défaut du seuil de longueur mono-ligne (30 caractères, § 2.1) — arbitraire,
  affinée empiriquement selon la pertinence perçue à l'usage.
- Valeur par défaut de la marge de sécurité (2 %, § 3.2) — arbitraire, affinée empiriquement
  une fois le module en usage réel sur des polices/tailles variées.
