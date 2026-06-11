# Plan — micro-animations `replace`

## 1. Vue d'ensemble

`replace` est un `RuntimeModule` analogue à `move`. Il intercepte les mutations de contenu (`content`, `src`) pour leur substituer une transition visuelle. La mutation est appliquée **immédiatement** sur le nœud réel ; la transition est purement cosmétique. Le module ne génère pas d'événements.

## 2. Prérequis

Les étapes suivantes sont des prérequis à l'implémentation. Elles sont indépendantes du module `replace` et doivent être traitées en premier.

### 2.1 Création de `TagComponent`

Renommer l'actuel `TextComponent` en `TagComponent`, type perso `"tag"`. Aucun changement de comportement : création d'un tag HTML générique, contenu via `textContent` (texte brut).

### 2.2 Création de `TextComponent`

Nouveau composant, type perso `"text"`. Hérite ou reprend la structure de `TagComponent` mais écrit le contenu via `innerHTML`. Tag par défaut : `p`. Support futur des variantes de langue (hors périmètre).

### 2.3 Mise à jour des démos

Recenser les scènes et démos qui utilisent actuellement le type `"text"` pour des usages générique (création de tags simples) et les migrer vers `"tag"`. Les usages de texte enrichi restent sur `"text"`.

---

## 3. API auteur

```ts
// Forme courte — transition nommée, durée du catalogue
{ replace: "fade" }

// Forme complète
{
  replace: {
    transition: "fade" | "swipe-left" | string,
    duration?: number,          // surcharge la durée catalogue
  }
}

// Avec split texte
{
  replace: {
    transition: "counter-up",
    split: "letter" | "word" | "line",
    stagger?: number,
    direction?: "left" | "right" | "top" | "bottom"
              | "left-top" | "right-top" | "left-bottom" | "right-bottom"
              | "center" | "edges",
  }
}

// Avec split image
{
  replace: {
    transition: "shutter",
    split: "cells",
    cellX?: number,
    cellY?: number,
    stagger?: number,
    direction?: "left" | "right" | "top" | "bottom"
              | "left-top" | "right-top" | "left-bottom" | "right-bottom"
              | "center" | "edges",
  }
}
```

`content` ou `src` reste défini normalement dans l'action, à sa place habituelle. La propriété `replace` pilote uniquement la transition visuelle qui accompagne ce changement.

## 4. Variantes

Le module détecte la variante à partir de la propriété `split` :
- absente → `replace-simple`
- `"letter" | "word" | "line"` → `replace-split-text`
- `"cells"` → `replace-split-cells`

### 4.1 replace-simple

**Lifecycle :**

1. `beforeUpdate` :
   - Capturer `offsetLeft`, `offsetTop`, `offsetWidth`, `offsetHeight` de l'élément
   - Clone A = `element.cloneNode(true)`, positionné en `position: absolute` dans le parent, recouvrant exactement l'élément original
   - Stasher la valeur de `parent.style.position`, forcer `position: relative` si nécessaire
   - Masquer l'élément original : `element.style.visibility = 'hidden'`

2. `component.update()` — applique le nouveau `content` ou `src` au nœud réel

3. `afterUpdate` :
   - Clone B = `element.cloneNode(true)` (état mis à jour), même positionnement absolu
   - L'élément réel reste `visibility: hidden`
   - Pousser dans `output.directTransitions` : outro sur Clone A, intro sur Clone B

4. `onFinalize` (les deux animations terminées, compteur = 2) :
   - Supprimer Clone A et Clone B du DOM
   - Restaurer `element.style.visibility = ''`
   - Restaurer `parent.style.position` si modifié

**Positionnement :**
- `position: absolute` dans le parent, pas `position: fixed` sur `document.body`
- Z-index respecté naturellement : un élément en avant-plan reste devant les clones
- Pas d'`overflow: hidden` sur le parent — les effets pixel (blur, shadow, glow) peuvent déborder

### 4.2 replace-split-text

S'applique quand `split ∈ { "letter", "word", "line" }`.

**Prérequis — refactoring TextComponent :**

Le `TextComponent` actuel recouvre deux fonctions distinctes qui doivent être séparées :

| Composant | Type perso | Rôle | Contenu |
|---|---|---|---|
| `TagComponent` *(ex-TextComponent)* | `"tag"` | Tag HTML générique (`button`, `fieldset`, `p`…) | `textContent` (texte brut) |
| `TextComponent` *(nouveau)* | `"text"` | Texte enrichi avec balisage inline | `innerHTML` (`<strong>`, `<em>`, `<span>`…) |

`TagComponent` est un renommage pur du composant actuel. `TextComponent` est un nouveau composant avec :
- écriture via `innerHTML` (ou équivalent structuré safe)
- support futur des variantes de langue (hors périmètre de cette spec)
- support de `replace-split-text`

Ce refactoring est un **prérequis bloquant pour `replace-split-text`**. `replace-simple` et `replace-split-cells` ne sont pas affectés.

**Stratégie de découpe — adaptation de l'approche anime.js v4 :**

anime.js v4 (`animejs ^4.3.6`) expose une interface de splitting texte ([`utils` / text](https://animejs.com/documentation/text)) qui enveloppe les caractères, mots ou lignes dans des `<span>`. On adapte cette logique de découpe pour `replace-split-text`.

**Règle de découpe sur texte enrichi :**

Les nœuds texte (`Text`) sont découpés en unités (lettre, mot, ligne). Quand une unité (mot) s'étend sur plusieurs nœuds éléments adjacents (ex. `<strong>hel</strong>lo`), elle est regroupée dans un `<span>` enveloppant :

```html
<!-- avant découpe -->
<strong>hel</strong>lo monde

<!-- après découpe par mot -->
<span><strong>hel</strong>lo</span> <span>monde</span>
```

Les nœuds élément (`<strong>`, `<em>`…) ne sont jamais remplacés — leur structure est préservée à l'intérieur du `<span>` de regroupement. Stasher l'`innerHTML` avant découpe pour restauration fidèle.

**beforeUpdate :**
- Découper l'état courant (voir ci-dessus) → ensemble de spans sortants
- Stasher l'`innerHTML` original (avant mutation)
- `visibility: hidden` sur l'élément, overlay des spans sortants en position absolue

**afterUpdate :**
- Le composant a appliqué le nouveau `content` (via `innerHTML`)
- Découper le nouvel état selon la même portée → ensemble de spans entrants
- Animer : outro staggeré sur spans sortants, intro staggeré sur spans entrants
- Ordre de stagger calculé selon `direction` (voir §5)

**onFinalize :**
- Supprimer tous les spans clones
- Restaurer l'`innerHTML` post-mutation sans spans (contenu enrichi final, sans artefacts de découpe)
- Restaurer `visibility`

### 4.3 replace-split-cells

S'applique quand `split === "cells"`.

**beforeUpdate :**
- Lire `offsetWidth` × `offsetHeight` de l'élément image
- Créer une grille de `cellX × cellY` `<div>` avec `background-image: url(ancienSrc)`, `background-size` et `background-position` calculés pour que chaque cellule recouvre sa zone dans l'image originale
- Positionner la grille en `position: absolute` sur l'élément (même mécanique que 3.1)
- `visibility: hidden` sur l'image originale

**afterUpdate :**
- L'image a déjà le nouveau `src`
- Animer : outro staggeré sur les cellules de la grille
- Pas de Clone B pour cells — l'image réelle est la révélation finale

**onFinalize :**
- Supprimer la grille overlay
- Restaurer `element.style.visibility = ''`

## 5. Architecture module

```
src/runtime/modules/replace/
  index.ts                  ← install() → RuntimeModule
  normalize-replace.ts      ← parse et validation de la propriété replace
  apply-simple.ts           ← stratégie 4.1
  apply-split-text.ts       ← stratégie 4.2
  apply-split-cells.ts      ← stratégie 4.3
  stagger-order.ts          ← calcul d'ordre Manhattan (1D texte, 2D cellules)
```

Le catalogue est placé dans le dossier de configuration auteur, adjacent à `src/runtime/config.ts` :

```
src/runtime/config/
  transitions.ts            ← transitions simples (auteur peut étendre)
  transitions-split.ts      ← transitions split text et cells (auteur peut étendre)
```

Ces fichiers sont le **point d'entrée auteur** : formatés pour être lus, modifiés et complétés sans connaissance du runtime interne.

**Utilitaires partagés disponibles :**

`src/runtime/modules/list-flip/engine/dom-matrix.ts` (extrait — étape 1 ✓ du plan selection-frame) expose :
- `captureCombinedMatrixForNode` — matrice cumulée des transforms parents
- `worldDeltaToLocalDelta` — conversion viewport → espace local
- `worldSizeToLocalSize` — conversion dimensions viewport → local
- `extractRotationMatrix` — isole la rotation sans le scale

Pour `replace-simple` v1, ces fonctions **ne sont pas des dépendances directes** : `cloneNode(true)` préserve les classes et styles inline de l'élément (transforms compris), et le positionnement `offsetLeft`/`offsetTop` est suffisant dans l'espace du parent. Ces utilitaires seront utiles si une v2 doit gérer des éléments dont les transforms viennent uniquement de styles calculés en cascade (sans classe ni style inline).

**Extractions prévues :** aucune extraction de code existant n'est planifiée pour `replace`. Les seules modifications de fichiers existants sont des **enrichissements** : `animation/types.ts` et `animation/adapter.ts` (groupe `onFinalize`).

## 6. Format du catalogue

Même structure `intro`/`outro` que `capsule/config/event-definitions.ts` :

```ts
export type ReplaceTransitionDef = {
  durationMs: number
  intro: Record<string, { from?: number | string; to: number | string }>
  outro: Record<string, { from?: number | string; to: number | string }>
  ease?: string
}

export const REPLACE_TRANSITIONS: Record<string, ReplaceTransitionDef> = {
  fade: {
    durationMs: 300,
    intro: { opacity: { from: 0, to: 1 } },
    outro: { opacity: { to: 0 } },
  },
  "swipe-left": {
    durationMs: 300,
    intro: { opacity: { from: 0, to: 1 }, x: { from: -250, to: 0 } },
    outro: { opacity: { to: 0 }, x: { to: -250 } },
  },
  // …
}
```

**Source du catalogue initial :** les transitions sont adaptées du site [kawai-text-animation](https://kawai-text-animation.pages.dev), qui liste des effets d'apparition. Pour `replace`, chaque effet est converti : `intro` = apparition telle quelle, `outro` = animation miroir ou inverse.

**Processus de validation du catalogue :**
- Chaque effet candidat est testé une fois avant d'être ajouté au catalogue
- Un test automatisé vérifie que l'effet s'exécute sans erreur et produit un résultat visuel cohérent
- Les effets qui échouent au test sont **écartés du catalogue** — ils n'y figurent pas
- Le catalogue ne contient que des effets validés ; aucun mécanisme de fallback runtime n'est nécessaire

Les transitions split ont des paramètres supplémentaires : `staggerDefault` et `direction`. Leur format est défini dans `transitions-split.ts`.

`direction` est un mot sémantique indiquant l'**origine** de la propagation ; la propagation réelle se fait dans la direction opposée :

| Valeur | Origine | Propagation effective |
|---|---|---|
| `"left"` | bord gauche | vers la droite |
| `"right"` | bord droit | vers la gauche |
| `"top"` | bord haut | vers le bas |
| `"bottom"` | bord bas | vers le haut |
| `"left-top"` | coin haut-gauche | vers bas-droite (diagonale) |
| `"right-top"` | coin haut-droit | vers bas-gauche (diagonale) |
| `"left-bottom"` | coin bas-gauche | vers haut-droit (diagonale) |
| `"right-bottom"` | coin bas-droit | vers haut-gauche (diagonale) |
| `"center"` | centre | rayonnement vers les bords |
| `"edges"` | bords | convergence vers le centre |

Le module calcule l'ordre de stagger des spans/cellules à partir de cette valeur. L'auteur n'a pas à se préoccuper de l'ordre d'index.

**Algorithme de tri (distance de Manhattan) :**

Pour chaque élément `i` à la position `(col_i, row_i)` dans la grille (ou `(index_i, 0)` pour du texte 1D), la distance depuis l'origine `(col_0, row_0)` est :

```
d_i = |col_i - col_0| + |row_i - row_0|
```

L'ordre de stagger est l'ordre croissant de `d_i`. Les éléments équidistants reçoivent le même délai. `"edges"` est le cas `"center"` avec les distances inversées (`d_max - d_i`).

## 7. Intégration dans le pipeline runtime

`replace` s'inscrit dans le pipeline `RuntimeModule` existant :
- `match: { actionKeys: ['replace'] }`
- Hooks : `beforeUpdate` (clonage état sortant) + `afterUpdate` (clonage état entrant + animations)
- Les `TransitionRequest` des clones sont poussés dans `output.directTransitions`
- Ils passent ensuite par `runAnimationBatch()` → `AnimationAdapter.run()` → anime.js
- `onFinalize` (via `TransitionRequest.onFinalize`) gère le nettoyage DOM

**Enrichissement de `onFinalize` pour la coordination deux clones :**

Le `TransitionRequest.onFinalize` existant est `(reason) => void` par animation. Pour `replace-simple`, le nettoyage (suppression des deux clones, restauration du nœud réel) ne doit s'exécuter qu'une fois les deux animations terminées. L'API `TransitionRequest` sera enrichie d'un champ `group` : les transitions d'un même groupe partagent un `onGroupFinalize` déclenché quand toutes les animations du groupe sont complètes (completed ou stopped).

```ts
// Enrichissement prévu de TransitionRequest
group?: {
  id: string
  total: number
  onGroupFinalize: (reason: 'completed' | 'stopped') => void
}
```

Cet enrichissement est localisé dans `animation/types.ts` et `adapter.ts`.

## 8. Seek

**v1 — jump-to-end :**
- Les animations de clones sont trackées normalement dans `AnimationAdapter.activeAnimations`
- Quand `timelineMs ≥ eventMs + duration` → `completeActiveAnimation()` → `onFinalize()` → clones supprimés, original révélé
- Le nœud réel a déjà la valeur finale (appliquée à `update()`) → seek reconstruit le bon état sans rejeu

**v2 — interpolation (futur, spec séparée) :**
- Seek positionne les clones à la progression correcte dans la transition
- Nécessite de conserver les clones et leur état dans le track

## 9. Propriétés cibles et échec silencieux

Les propriétés qui déclenchent une transition de remplacement sont pour l'instant **`content`** (texte, éventuellement texte enrichi avec `span`, `strong`…) et **`src`** (image).

Si l'action contient `replace` mais aucune de ces propriétés cibles, le module **échoue silencieusement** : aucune transition n'est lancée, un warning auteur est émis (`REPLACE_NO_TARGET_PROPERTY`).

## 10. Cas apparition / disparition pure

Quand `replace` est présent sans changement de `content`/`src` (élément qui apparaît ou disparaît) :
- **Apparition** : l'élément était `visibility: hidden` → intro animation sur l'élément lui-même → `visibility: visible`
- **Disparition** : l'élément visible → outro animation → `visibility: hidden` (empreinte layout préservée)
- Pas de clones dans ce cas

## 11. Contexte flex / grid

La majorité des effets se produisent dans des conteneurs `flex` ou `grid`. La stratégie inline est compatible sans déformation :

- `visibility: hidden` sur l'original → l'élément reste dans le flux flex/grid, son espace est préservé
- Clone `position: absolute` → sorti du flux, n'affecte pas les autres items flex/grid
- `position: relative` sur le parent → sans effet sur le comportement flex/grid du conteneur
- Le clone est dimensionné explicitement (`offsetWidth` / `offsetHeight`) → indépendant du recalcul flex/grid

Contrainte connue : si le parent est un item flex/grid *et* n'a pas de dimensions fixes, `position: relative` peut légèrement affecter le rendu dans certains navigateurs anciens. Hors périmètre.

## 12. Points ouverts

| Point | Décision |
|---|---|
| `overflow: hidden` sur le parent | Non — les effets pixel peuvent déborder |
| Positionnement `fixed` vs `absolute` | `absolute` dans le parent (z-index naturel respecté) |
| overlay-world comme méthode partagée | À formaliser dans une spec dédiée quand l'usage est consolidé |
| Rapprochement catalogue capsule ↔ replace | Futur — `replace` devient le mécanisme de nommage commun |
| Seek interpolation | v2, spec séparée |
| Débordement visuel (swipe hors parent) | Laissé à la responsabilité de la transition ; testé visuellement |
