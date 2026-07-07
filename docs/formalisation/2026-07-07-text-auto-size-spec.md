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

Règles de clamp :

- rechercher la taille maximale qui tient en une seule ligne dans la largeur du bloc ;
- si le texte est trop long pour tenir en une ligne même à la taille limite de lisibilité,
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

## 3. Mesure et conversion cqw

### 3.1 Environnement de mesure

La mesure ne se fait **pas** dans le DOM visible de dedit : un environnement de mesure séparé
(canvas 2D hors-écran, créé à la demande, jamais inséré dans le DOM affiché) reçoit fonte,
graisse, taille candidate et texte en entrée, et renvoie les dimensions résultantes
(`measureText`, largeur ; hauteur de ligne dérivée des métriques de fonte/`line-height`
en vigueur).

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

### 3.3 Conversion en cqw

La mesure est nécessairement faite à une largeur de conteneur de référence, en pixels (dedit
édite dans un viewport concret). Conversion par règle de 3 simple, même principe que la
conversion px ↔ cqw déjà prévue pour le pont position (`2026-07-07-dedit-spec.md` § 3.3, § 6) :

```
fontSizeCqw = fontSizePx (mesuré) / largeurConteneurPx (au moment de la mesure) × 100
```

Pas de nouvelle mécanique de conversion : réutilisation du principe existant.

## 4. Seuil de la limite de lisibilité

Une **valeur `cqw` fixe unique**, indépendante de la fonte/graisse choisie. Valeur exacte à
déterminer empiriquement à l'implémentation (hors normatif ici) ; le principe normatif est
qu'il s'agit d'une constante simple, pas d'une formule dépendant de la fonte.

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
  dans le décor résolu au build — pas dans l'écart brut de dedit.

## 6. Interaction avec `custom`

`custom` **prime toujours** sur le calcul de `textAutoSize`, cohérent avec la règle générale
du domaine dedit (`custom` prime sur `style`, dernier appliqué — `2026-07-07-dedit-spec.md`
§ 3.2). Si l'utilisateur pose une règle `font-size` dans le mini-éditeur de code alors que
`auto` est coché, la valeur `custom` écrase le résultat du calcul — même si ici le clamp est
un calcul et non une simple valeur statique, la règle reste uniforme et simple à expliquer à
l'utilisateur : `custom` est toujours la dernière main.

## 7. Déclenchement du calcul côté dedit

Le calcul est **continu** : recalculé à chaque frappe dans la zone de texte (`text`) et à
chaque changement de taille du bloc (`position.width`/`position.height`), pour un retour
visuel immédiat dans dedit. Le coût des appels répétés à l'environnement de mesure (§ 3.1)
est accepté à ce stade ; une optimisation (debounce, etc.) reste possible en implémentation
sans être normative ici.

## 8. Architecture du module

Même philosophie que `capsule-automation` : un composant pur qui ne touche jamais au DOM
affiché, ne dépend d'aucun framework, et calcule des artefacts à partir d'une entrée
déclarative.

```typescript
interface TextAutoSizeInput {
  text: string
  font: { family: string; weight: string | number }   // réglages typo en vigueur
  blockWidthCqw: number
  blockHeightCqw: number
  referenceWidthPx: number   // largeur du conteneur au moment de la mesure, pour conversion cqw
  minReadableSizeCqw: number // seuil de lisibilité (§ 4)
}

type TextAutoSizeResult =
  | { mode: 'single-line' | 'multi-line'; fontSizeCqw: number }
  | { mode: 'scroll'; fontSizeCqw: number }   // fontSizeCqw = minReadableSizeCqw

function computeTextAutoSize(input: TextAutoSizeInput): TextAutoSizeResult
```

- `computeTextAutoSize` est la fonction d'entrée principale, pure vis-à-vis de son appelant
  (l'environnement de mesure canvas hors-écran est un détail d'implémentation interne, pas un
  paramètre injecté par l'appelant — au même titre que `capsule-automation` ne demande pas au
  consommateur de lui fournir le DOM).
- Le mode `scroll` ne produit pas d'animation : il signale seulement que le player doit
  activer son comportement de scroll (§ 2.2). Les paramètres d'animation restent un point
  ouvert (§ 2.2).

## 9. Points restant ouverts

- Valeur exacte du seuil de lisibilité (§ 4) — empirique, à trancher à l'implémentation.
- Paramètres de l'animation de scroll (§ 2.2) — vitesse, easing, pause en haut/bas ; réservés
  à un chantier preset ultérieur côté player.
- Algorithme précis de recherche de taille (dichotomie vs incrémentation, § 3.2) — laissé à
  l'implémentation, sans impact sur le contrat public du module.
