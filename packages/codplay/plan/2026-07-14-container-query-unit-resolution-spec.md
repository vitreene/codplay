# Spec — Résolution des unités container-query avant anime.js

**Périmètre** : comment codplay applique une valeur de style exprimée dans une unité de container query (`cqw`, `cqh`, `cqi`, `cqb`, `cqmin`, `cqmax`) sans dépendre de la résolution d'unité interne d'anime.js. Le pourquoi des choix ci-dessous est conservé dans `notes/2026-07-14-container-query-unit-resolution-deliberation.md`.

---

## 1. Décision

codplay résout toute valeur exprimée dans une unité de container query en un nombre de pixels concret, avant qu'elle n'atteigne une API anime.js (`utils.set` ou `animate`) — quel que soit le point d'appel. anime.js n'est ni modifié ni contourné : il continue de recevoir exactement ce qu'il recevait déjà pour toute autre valeur (px, %, unitless, couleurs...). `utils.set` reste utilisé partout où il l'est aujourd'hui.

## 2. Emplacement

La résolution vit dans un module unique et isolé, situé dans la couche runtime de codplay — jamais dans le Builder, jamais dans le Player, jamais authorée via un strap de scène. Positionnement précis : après résolution des directives de style (actions, `initial.style`, transitions) en patch concret, juste avant que ce patch parte vers anime.js.

## 3. Points d'appel

Quatre points d'appel réels, tous dans `packages/codplay/src/` — les deux autres points listés dans une première version de cette spec (`create-flip-engine.ts::applyChannelState`, `create-list-flip-module.ts`) sont exclus : leurs valeurs sont typées `number` (deltas mesurés par FLIP), jamais des chaînes cq-unit, donc hors sujet.

1. `runtime/components/lib/dom.ts::applyStyleProps` (`utils.set`, ~ligne 160)
2. `runtime/components/lib/dom-component-adapter.ts::applyStylePatch` (`utils.set`, ~ligne 479)
3. `animation/adapter.ts::applyTransitionEndValue` (`utils.set`, ~ligne 163)
4. `animation/adapter.ts::toTransitionValue` / `groupTransitions` (~lignes 207-316, from/to transmis à `animate()`)

## 4. Détection

Toute valeur dont l'unité matche `cqw|cqh|cqi|cqb|cqmin|cqmax` est interceptée. La détection utilise CSS Typed OM (`CSSStyleValue.parse`) pour extraire valeur et unité — pas de regex maison. Toute autre valeur (px, %, unitless, couleur, deg...) traverse le module sans modification.

## 5. Résolution

**Révisé 2026-07-14** : le conteneur de requête n'est plus retrouvé par traversée DOM
(`.closest('.ac-scene-root')`) — voir `notes/2026-07-14-container-query-unit-resolution-deliberation.md`
pour l'arbitrage renversé, et `docs/formalisation/2026-07-14-container-query-resolution-spec.md`
pour la spec normative. Un nom de classe CSS n'est pas une source de vérité : le conteneur de
requête est le perso root de la scène, connu depuis les données (`CompiledScene.rootNodeIds`),
jamais redécouvert par une requête DOM à l'usage.

Mécanisme retenu : `container-query-units.ts` expose `setContainerQueryRootNode(node)`, appelée
une seule fois par `player.ts::mountRootNodes()` dès que le node du perso root (premier id de
`rootNodeIds`) est résolu via le registry runtime (`getNodeById`). `resolveContainerQueryValue`
lit cet état interne au lieu de faire `node.closest(...)` — signature inchangée pour tous les
appelants (`dom.ts`, `dom-component-adapter.ts`, `animation/adapter.ts`), aucun paramètre
nouveau à faire transiter.

Si aucun root node n'est encore résolu (scène non montée, ou pas de root defini), la valeur
traverse sans résolution — ce module reste inerte tant que le player n'a pas encore monté la
scène.

Sinon, la dimension pertinente du conteneur (largeur pour `cqw`/`cqi`, hauteur pour `cqh`/`cqb`, les deux pour `cqmin`/`cqmax`) est mesurée une fois (`getBoundingClientRect`), puis la conversion se fait par arithmétique pure — même formule que `cqwToPx` (`packages/editor/src/decor-editor/units.ts`), dupliquée localement dans `packages/codplay` plutôt qu'importée : `packages/codplay` n'a et ne prend aucune dépendance vers `packages/editor`, suivant le précédent déjà établi par `packages/authoring/text-auto-size/src/core/cqw.ts` (même formule, déjà dupliquée pour la même raison).

Pour une transition animée (point d'appel 4), `from` et `to` sont tous deux convertis avant que l'interpolation ne débute. Aucun calcul d'unité n'a lieu pendant les frames d'animation — anime.js interpole exclusivement entre deux nombres déjà résolus.

## 6. Hors périmètre

- Le diagnostic du bug d'affichage observé sur `width`/`height` après un cycle drag → persist → rebuild : `packages/editor/plan/notes/2026-07-14-offset-cqw-double-conversion-investigation.md`.
- Le resize du mount target en cours de lecture : non géré aujourd'hui, non traité ici. Réponse éventuelle : `docs/formalisation/v1-hypothese-layout-volatile-resize-minimal.md` (hypothèse non adoptée).
- Le retrait d'anime.js de codplay : non engagé.
- Toute évolution du schéma `initial.style` / `StyleProps` / `CompiledScene` : aucune. Les valeurs restent des chaînes CSS suffixées, comme aujourd'hui.

## 7. Relation aux autres documents

- Convention d'unité côté Builder ed2 (émission de `cqw`, inchangée) : `packages/editor/src/builder/build-scene.ts::resolveOffsetAsStyle`.
- Formule de référence (dupliquée, pas importée — cf §5) : `packages/editor/src/decor-editor/units.ts` (`pxToCqw`/`cqwToPx`), même précédent que `packages/authoring/text-auto-size/src/core/cqw.ts`.
- Investigation à l'origine de ce chantier : `packages/editor/plan/notes/2026-07-14-offset-cqw-double-conversion-investigation.md`.
