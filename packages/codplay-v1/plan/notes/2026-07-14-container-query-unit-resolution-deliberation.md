# Notes — délibération résolution des unités container-query

**Statut : arbitrage renversé.** La section « Pourquoi le conteneur de requête n'a pas besoin
d'être découvert par un paramètre injecté ni un parcours DOM générique » ci-dessous est
**écartée** — `.closest('.ac-scene-root')` est une violation du principe « le moteur ne
découvre jamais une relation structurelle par traversée DOM », signalée après coup. Voir la
spec normative qui remplace cet arbitrage : `docs/formalisation/2026-07-14-container-query-resolution-spec.md`.
Le reste de ce document (carte d'usage anime.js, formule `cqwToPx`, raisons d'écarter `%` et
l'indirection CSS var) reste valable — seule la section sur la découverte du conteneur est
renversée.

## Pourquoi `%` a été écarté

`%` a une sémantique dépendante de la propriété CSS qui le porte (référence au content-box du parent pour `width`, à la containing block padding-box pour `top` en position absolue, etc.) — fragile dès qu'une marge ou un padding intervient. `cqw`/`cqh`/etc. n'ont pas ce problème : ils désignent toujours 1% de l'inline-size/block-size du conteneur de requête, quelle que soit la propriété. Mais ce n'était pas la seule raison de l'écarter : `%` déclenche la même réconciliation d'unité fragile qu'anime.js effectue pour `cqw` au premier mount (valeur "from" lue en px sur le DOM vs "to" en `%`) — donc passer à `%` n'aurait pas résolu le problème de fond, seulement changé l'unité qui le déclenche.

## Pourquoi l'indirection par variable CSS a été écartée

Idée explorée : poser `cqw` dans une custom property (`--w`) plutôt que directement sur `width`, en s'appuyant sur une règle CSS statique (`width: var(--w)`) pour la résolution native. Lecture du code source d'anime.js (`node_modules/animejs/dist/modules/core/render.js`) : les tweenTypes `CSS`, `CSS_VAR` et `TRANSFORM` partagent exactement la même logique de composition de valeur en amont (`${number}${unit}`) — seule l'écriture finale diffère (`style[prop] = value` vs `style.setProperty(prop, value)`). L'indirection ne contourne donc rien du pipeline de décomposition/conversion d'anime. Une fois la décision prise que `cqw` n'atteint plus jamais anime.js (résolu en amont), cette question devient de toute façon sans objet.

## Pourquoi le retrait complet d'`utils.set` a été proposé puis abandonné

Piste explorée un temps : puisque `utils.set` n'effectue jamais de vraie interpolation (duration ≈ 0 dans tous ses usages observés), le retirer entièrement au profit d'une écriture DOM directe semblait éliminer le problème à la racine. Écarté : `utils.set` n'est pas la source du problème — c'est ce qu'on lui transmet qui l'est. Le retirer aurait été un changement d'architecture (bascule d'une partie du rendu hors d'anime.js) disproportionné par rapport au problème réel (une conversion d'unité), et redondant une fois la résolution en amont en place : `utils.set` recevant déjà des valeurs px non ambiguës, sa propre logique de réconciliation from/to ne se déclenche plus jamais (elle ne se déclenche que si `from.unit !== to.unit`).

## Pourquoi un strap `layout-recompute` a été écarté pour ce chantier

`docs/formalisation/v1-hypothese-layout-volatile-resize-minimal.md` (hypothèse non adoptée) propose un modèle pour gérer le resize du mount target en cours de lecture : un event volatil `runtime:viewport:changed`, routé vers un strap centralisé qui recalcule et pousse des patchs de style concrets par perso. Ce modèle répond à un besoin différent (le conteneur change de taille pendant la lecture) de celui traité ici (une unité mal résolue au moment où elle est posée, conteneur stable). Le mount target n'est aujourd'hui jamais redimensionné pendant une session de lecture active (confirmé : aucun `ResizeObserver` ni listener de resize dans `packages/codplay-v1/src/player`/`runtime`) — ce chantier ne régresse donc rien sur ce plan, et n'a pas besoin d'un mécanisme de strap pour son propre problème, qui est ponctuel (une conversion à la pose) et non continu.

## Carte d'usage réelle d'anime.js dans codplay

Huit fichiers importent `animejs` dans `packages/codplay-v1/src/`, pour trois capacités réelles seulement :
- `utils.set` (écriture DOM instantanée, jamais d'interpolation observée) — `dom.ts`, `dom-component-adapter.ts`, `animation/adapter.ts` (`applyTransitionEndValue`), `create-flip-engine.ts`, `create-list-flip-module.ts`.
- `animate` + `engine` (vraie interpolation, avec durée/easing/stagger/loop réels) — `animation/adapter.ts` (`createAnimationAdapter`), `broadcast-player.ts`.
- `svg.morphTo` (morphing de path SVG) — `animation/adapter.ts`.

Fait notable : codplay possède déjà son propre moteur d'interpolation indépendant, `tween/tween-runner.ts::TweenRunner` (table d'easing propre, calcul de progress propre), utilisé pour l'action `tween()` — sans lien avec anime.js. Le scheduling (`helper-finite-core.ts`, `helper-loop-core.ts`) est également 100% maison. Anime.js n'est donc structurant que pour les transitions `TransitionRequest`/list-flip et le morph SVG — la conversion d'unité, qui aurait pu être vue comme une raison de plus de s'appuyer sur anime.js, s'avère à la fois peu fiable dans le contexte de codplay et, une fois ce module en place, entièrement prise en charge côté codplay. Un des rares attraits résiduels d'anime.js pour ce chemin s'évanouit.

## Pourquoi mesure-conteneur + `cqwToPx` plutôt qu'une réimplémentation

Écarté : poser la valeur `cqw` littéralement sur le node cible réel puis relire la valeur calculée par le navigateur (via `computedStyleMap`/CSS Typed OM) — mécanisme initialement envisagé pour laisser le navigateur seul juge, par analogie avec la mesure par clonage qu'utilise anime.js en interne (`convertValueUnit`, fragile justement parce qu'elle clone le node cible et le réinsère dans un contexte de grille qui peut ne pas se comporter comme l'original). Cette analogie ne tient pas : `cqw`/`cqh`/etc. sont définis uniquement par rapport à la boîte du conteneur de requête, jamais par rapport à l'élément qui les porte (contrairement à `%`) — poser/relire sur le node cible introduit des variables sans rapport avec le calcul réel (box-sizing de l'item, placement de grille, contenu) et un aller-retour DOM inutile.

Retenu : mesurer directement le conteneur de requête (`getBoundingClientRect`, une fois) et calculer par arithmétique pure. `cqwToPx` (`packages/editor/src/decor-editor/units.ts`) fait déjà exactement ce calcul, testé et utilisé pour la persistance ed2 en sens inverse (`pxToCqw`) — la formule est reprise à l'identique, dupliquée localement plutôt qu'importée (voir section suivante).

## Pourquoi la formule est dupliquée plutôt qu'importée depuis `packages/editor`

`packages/codplay` n'a aujourd'hui aucune dépendance vers `packages/editor`, et la couche architecturale (Builder/Player/Runtime décrite dans CLAUDE.md) place codplay en dessous d'ed2, jamais l'inverse — y prendre une dépendance pour deux lignes d'arithmétique inverserait ce sens. `packages/authoring/text-auto-size/src/core/cqw.ts` a déjà résolu exactement cette même tension en dupliquant la formule plutôt qu'en dépendant d'ed2 : même précédent suivi ici.

## Pourquoi le conteneur de requête n'a pas besoin d'être découvert par un paramètre injecté ni un parcours DOM générique

Deux mécanismes ont été envisagés puis écartés avant de trouver le bon :
- Un paramètre `referenceWidthPx` fourni explicitement (calqué sur `scene-player-bridge.ts`/`text-auto-size`) — écarté : aurait exigé de faire transiter une nouvelle référence à travers `player.init` → `createDefaultAnimationAdapter` → chaque point d'appel, alors que rien de tel n'existe aujourd'hui dans codplay.
- Un parcours ascendant du DOM vérifiant `getComputedStyle(ancestor).containerType` à chaque niveau — écarté : plus complexe à tester (les tests de `create-flip-engine.ts` utilisent des `FakeNode` qui ne supportent pas un vrai parcours DOM), et générique pour un problème qui ne l'est pas.

Le bon niveau de généralité, trouvé en relisant `packages/authoring/capsule-automation/src/core/build-grid.ts` : il n'existe dans tout le repo qu'un seul et unique identifiant portant `container-type` — la classe `ac-scene-root`. Ce n'est pas une valeur à découvrir, c'est une convention fixe et déjà documentée dans le code source d'ed2. `node.closest('.ac-scene-root')` la retrouve directement depuis le node cible, sans paramètre nouveau ni traversal générique.
