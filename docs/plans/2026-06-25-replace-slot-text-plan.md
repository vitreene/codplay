# Plan — transitions `slot-up` / `slot-down` (rendu « machine à sous »)

Enrichissement de [2026-06-09-replace-plan.md](./2026-06-09-replace-plan.md) §4.2 (`replace-split-text`).

## 1. Origine

Le dépôt [slot-text](https://github.com/Danilaa1/slot-text) propose un rendu de
transition texte en « rouleau vertical » (effet machine à sous / split-flap) plus
lisible que l'interprétation actuelle de `replace-split-text` (fondu + glissement
horizontal). On adapte ce rendu pour le mode vertical (`swipe-top/bottom` imité).

## 2. Décision d'intégration

- **Déclencheur** : deux nouveaux noms de catalogue `slot-up` / `slot-down`,
  utilisés avec `split: "letter" | "word" | "line"`. Opt-in : `swipe-up`/`swipe-down`
  conservent leur rendu fondu + glissement actuel, inchangé.
- **Fidélités portées** (toutes) : roulement clippé par caractère, easing à ressort
  (overshoot), `skipUnchanged`, wobble/bounce déterministe par caractère, flash
  chromatique.

## 3. Écart avec la spec existante

§4.2 décrit `replace-split-text` comme « outro staggeré sur spans sortants, intro
staggeré sur spans entrants », les propriétés étant pilotées par le catalogue
`intro`/`outro`. Le rendu slot **diverge** : il empile l'ancien et le nouveau glyphe
dans une **cellule clippée** (`overflow:hidden`) et anime un `translateY` opposé sur
les deux faces. Ce n'est pas exprimable par le couple `intro`/`outro` générique.

→ Le catalogue `ReplaceTransitionDef` gagne un champ optionnel `slot`. Quand il est
présent **et** que `split` est un mode texte, le module emprunte un chemin de rendu
dédié (`apply-slot-text.ts`) au lieu de `apply-split-text.ts`. Les entrées sans `slot`
sont inchangées. `intro`/`outro` restent renseignés (fondu vertical) comme repli
gracieux si `slot-up/down` est utilisé sans `split`.

## 4. Catalogue

```ts
export type SlotConfig = {
  axis: 'up' | 'down'   // up = nouveau entre par le bas, ancien sort par le haut
  bounce?: number       // amplitude wobble 0..1 (défaut 0.6)
  chroma?: boolean      // flash chromatique (défaut false)
}

export type ReplaceTransitionDef = {
  durationMs: number
  intro: Record<string, { from?: number | string; to: number | string }>
  outro: Record<string, { from?: number | string; to: number | string }>
  ease?: string
  slot?: SlotConfig
}
```

`slot-up` / `slot-down` : `ease: 'outBack'`, `bounce: 0`, `chroma: true`, `durationMs: 500`.

> **anime v4 — easing** : le format string `'cubicBezier(...)'` a été **retiré** du cœur
> d'anime v4.3 (il retombe silencieusement en linéaire, tout comme les noms v3
> `easeOutQuad`). On utilise donc le nom d'ease v4 `'outBack'` (overshoot intégré), seul
> garant d'un mouvement réellement amorti — sans quoi le roulement paraît mécanique.

> **Régularité** : `bounce` vaut **0 par défaut** → durée uniforme, stagger linéaire et
> faces ancienne/nouvelle synchronisées (vague nette, scrub seek cohérent). `bounce > 0`
> réintroduit le wobble par caractère de slot-text (durée/délai variables, poursuite).

## 5. Rendu slot (`apply-slot-text.ts`)

**before** — capture `textContent`, mesure la hauteur de cellule `H` (line-height
calculé, repli `getBoundingClientRect().height` puis `fontSize*1.2`), masque l'élément
(`visibility:hidden`), force `position:relative` sur le parent.

**after** — l'élément réel a déjà le nouveau contenu :
1. Overlay = `el.cloneNode(false)`, positionné en absolu sur l'élément (offset parent,
   largeur), `white-space:pre`.
2. Tokenisation ancien/nouveau (même `tokenize` que split-text). `maxLen = max(len)`.
3. Par index `i` (appariement positionnel) :
   - `skipUnchanged` (défaut `true`) + glyphe identique non vide → cellule statique,
     aucune transition.
   - sinon cellule `inline-block`, `position:relative`, `overflow:hidden`, hauteur `H` :
     - *sizer* invisible (glyphe final, fixe la largeur),
     - *face ancienne* (absolue) si glyphe sortant non vide,
     - *face nouvelle* (absolue) si glyphe entrant non vide.
4. Stagger : `computeStaggerDelays(maxLen, 1, totalStagger, direction)`. Si `bounce > 0`,
   wobble déterministe (sin-hash slot-text) sur durée et délai :
   `d_i = duration·(tail?0.75:1)·(1 + bounce·0.45·wobble(i,1))`,
   `base_i = delay_i·(1 + bounce·0.25·wobble(i,2))`. Si `bounce === 0` (défaut) :
   `d_i = duration`, `base_i = delay_i` (régulier).
5. `TransitionRequest` (déterministes, compatibles seek) :
   - face ancienne : `y` 0 → `axis==='up' ? -H : +H`.
   - face nouvelle : `y` `axis==='up' ? +H : -H` → 0 (délai `base_i + exitOffset`,
     `exitOffset = 0` si `bounce === 0`).
   - si `chroma` : face nouvelle `color` `hsl(hue,90%,60%)` → couleur de repos,
     `hue = i/(maxLen-1)·300`.
6. `group.onGroupFinalize` : retire l'overlay, restaure `visibility` et la `position`
   du parent. `total` = nombre de `TransitionRequest` émis.

## 6. Seek

Identique à §8 du plan replace (jump-to-end) : overlay = clones retirés au finalize,
l'élément réel porte déjà la valeur finale. Durées/délais déterministes → reconstruction
stable. Pas de nouveau mécanisme.

## 7. Tests

- Unitaire `apply-slot-text` : structure DOM (cellules clippées, double face),
  `skipUnchanged`, requêtes `y` (et `color` si chroma), `group.total` cohérent.
- Démo : la cellule `cell-text-letter` de `replace-carousel-scene` passe en `slot-up`.
