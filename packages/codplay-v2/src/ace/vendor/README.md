# `vendor/` — code extrait d'anime.js 4.5.0

Copie **non modifiée** des modules retenus par le cadrage
(`docs/projet/codplay-v2/notes/2026-07-29-noyau-solve-cadrage.md`, §4bis). Point de départ de
l'extraction, pas l'état cible : ces fichiers sont destinés à être élagués et adaptés.

anime.js — MIT, © Julian Garnier. Licence conservée dans `LICENSE.md`, en-têtes de fichier intacts.

## Ce qui est là

| | |
|---|---|
| `easings/` | catalogue complet — Penner, cubic-bezier, spring, steps, linear, irregular |
| `core/values.js` | décomposition `{type, nombre, unité, opérateur}` — la facilité centrale |
| `core/units.js` | conversions génériques (angles, rapports) |
| `core/helpers.js`, `core/consts.js` | socle commun |
| `core/render.js` | pour ses ~40 lignes d'interpolation ; le reste du fichier est le portillon, à retirer |
| `animation/additive.js` | l'astuce de composition additive |
| `animation/composition.js` | pour son seul bloc `blend` ; le bloc `replace` est à retirer |

## Ce dossier ne compile pas, et n'a pas à compiler

C'est une **copie de lecture**. Les déclarations de types d'anime tiennent dans un seul fichier
(`types/index.d.ts`) qui couvre **toute** la bibliothèque et référence `animatable`, `draggable`,
`layout`, `scope`, `text`, `timeline`, `timer`, `waapi`. Le rapatrier ne répare pas les chemins : il tire
des références vers l'intégralité d'anime, soit l'inverse du cadrage.

Ces `.d.ts` sont par ailleurs des artefacts **générés** depuis le JSDoc des `.js`. `ace` étant destiné à
être du TypeScript, ils ne sont pas la cible — seulement du vocabulaire de référence.

**À exclure de la vérification de types** tant que l'élagage n'a pas eu lieu.

## Une exception au « on emprunte exactement les courbes »

Le **spring** n'est pas une courbe pure. Il importe `JSAnimation`, conserve une référence `parent`, et
porte un `settlingDuration` qui **impose la durée du tween** (`animation.js` : `tDuration =
animEase.settlingDuration`). Il est couplé au runtime d'anime et demandera une adaptation, pas une copie.

## Arêtes coupées

Les importations suivantes ne résolvent plus, et c'est voulu — elles marquent les frontières du cadrage :

`animation/animation.js` (parsing, keyframes, `Timer`) · `engine/engine.js` · `timeline/timeline.js` ·
`core/transforms.js` (lecture du nœud) · `core/colors.js` (hors périmètre)

## Arêtes coupées qui demandent une décision

| dépendance | taille | question |
|---|---|---|
| `core/globals.js` | 90 l. | valeurs par défaut et `precision`. Copier, ou remplacer par notre configuration centralisée (conduite §8, « rien en dur ») ? |
| `types/index.d.ts` | 505 l. | les types JSDoc de tout le module. Nécessaires pour que le code se vérifie ; à reprendre et élaguer avec le reste. |
| `adapters/registry.js` | 146 l. | registre d'adaptateurs de cibles d'anime v4. Touche la question du substrat — à instruire, pas à copier par défaut. |
| `core/styles.js` | 147 l. | `sanitizePropertyName`, employé par `composition.js`. Sans doute inutile une fois le bloc `replace` retiré. |
