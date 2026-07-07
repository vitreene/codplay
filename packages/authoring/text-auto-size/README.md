# text-auto-size

Composant TypeScript pur qui calcule la taille de police optimale d'un texte pour qu'il
tienne dans un bloc de dimensions données, sans jamais déborder.

Spec de référence : `docs/formalisation/2026-07-07-text-auto-size-spec.md`.

Le composant ne touche jamais au DOM affiché. La seule dépendance navigateur
([`OffscreenCanvas`](https://developer.mozilla.org/fr/docs/Web/API/OffscreenCanvas)) est
isolée dans `core/canvas-measure.ts`, utilisée pour une mesure hors-écran — jamais un élément
`<canvas>` rattaché au DOM, même détaché — le reste du module est pur et testable sans
navigateur.

## Périmètre

`computeTextAutoSize` prend en entrée un texte, des réglages typo et les dimensions du bloc
(en `cqw`), et retourne :

- un mode (`single-line`, `multi-line`, `scroll`) ;
- la taille de police résultante, en `cqw` ;
- le `line-height` forcé (`1.2`) ;
- un `fontStretch` (mot-clé CSS standard, `"normal"` par défaut) — élargit l'axe `wdth`
  d'une police variable pour mieux occuper la largeur disponible, une fois la taille figée
  (§2.3 de la spec).

Hors périmètre :

- l'animation de scroll pour les textes trop longs (mode `scroll`) — matérialisée par le
  player uniquement, jamais par ce module (spec §2.2, §7) ;
- la fusion du résultat dans un `DecorPatch`/`ResolvedDecor` de dedit — le module ne connaît
  aucun type de dedit ; cette composition est la responsabilité de chaque appelant (dedit en
  édition, le builder à la compilation) ;
- le chargement de la fonte avant mesure — précondition de l'appelant.

## Point d'entrée

```ts
import { computeTextAutoSize } from './src'

const result = computeTextAutoSize({
  text: 'Un titre un peu long',
  font: { family: 'Inter', weight: 700, style: 'normal' },
  blockWidthCqw: 40,
  blockHeightCqw: 15,
  referenceWidthPx: 1920, // largeur réelle du conteneur au moment du calcul
})

console.log(result.mode)         // 'single-line' | 'multi-line' | 'scroll'
console.log(result.fontSizeCqw)
console.log(result.lineHeight)   // toujours 1.2
console.log(result.fontStretch)  // 'normal' | 'semi-expanded' | 'expanded' | 'extra-expanded' | 'ultra-expanded'
```

`minReadableSizePx` est optionnel (défaut `9`, `DEFAULT_MIN_READABLE_SIZE_PX`) — seuil de
lisibilité physiologique en px réels, jamais franchi vers le bas par le calcul.

`singleLineMaxChars` est optionnel (défaut `30`, `DEFAULT_SINGLE_LINE_MAX_CHARS`) — au-delà
de ce nombre de caractères, le mono-ligne n'est même pas tenté, quelle que soit la largeur
du bloc.

`fitSafetyMargin` est optionnel (défaut `0.02`, `DEFAULT_FIT_SAFETY_MARGIN`) — la mesure
hors-écran et le rendu réel du DOM ne produisent jamais une largeur/hauteur rigoureusement
identique pour un même texte ; la recherche est donc menée contre un bloc réduit de cette
fraction, pour ne jamais s'arrêter pile à la frontière mesurée.

**Élargissement de l'axe width (§2.3).** Une fois la taille figée, un second passage élargit
`font-stretch` (`normal` → `ultra-expanded`, `FONT_STRETCH_STEPS`) pour occuper l'espace
restant en largeur, quand il y en a — typiquement lorsque c'est la hauteur, pas la largeur,
qui a limité la taille de police. Seuls ces 9 paliers CSS standard sont testés : la propriété
canvas `fontStretch` (mesure) n'accepte pas de pourcentage libre, vérifié directement.
Toujours `normal` en mode `scroll`, ou quand la largeur était déjà la contrainte active (rien
à occuper).

## Architecture interne

```
src/
  types.ts                    // TextAutoSizeInput / TextAutoSizeResult (contrat public)
  config.ts                   // seuil par défaut, line-height forcé
  compute-text-auto-size.ts   // composition publique + variante testable (mesure injectée)
  core/
    measure.ts                // contrat de mesure (FontSpec, MeasureLine) — pas de DOM
    canvas-measure.ts         // implémentation réelle (canvas 2D hors-écran)
    cqw.ts                    // conversion px ↔ cqw (règle de 3, §3.3)
    wrap-lines.ts             // retour à la ligne glouton, mot par mot
    search-font-size.ts       // recherche taille (mono/multi-ligne/scroll) + élargissement width (§2)
```

`computeTextAutoSizeWithMeasurer(input, measure)` est la composition testable : elle accepte
une mesure injectée, ce qui permet de tester tout l'algorithme (recherche, conversion cqw,
retour à la ligne) sans environnement canvas réel. `computeTextAutoSize(input)` — le seul
export destiné à dedit/builder — l'appelle avec la mesure canvas réelle.

## Vérification actuelle

```bash
npm run typecheck --workspace=packages/authoring/text-auto-size
npm run test --workspace=packages/authoring/text-auto-size
```
