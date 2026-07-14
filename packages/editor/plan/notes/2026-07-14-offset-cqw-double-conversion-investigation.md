# Investigation — offset (position/dimension) faux après un cycle drag → persist → rebuild → re-drag

Note de travail, contexte figé à l'instant où l'investigation s'est arrêtée pour réflexion. Écrite pour reprise dans une autre session — chaque affirmation ci-dessous est soit vérifiée en live (marquée **CONFIRMÉ**), soit une hypothèse non encore tranchée (marquée **HYPOTHÈSE**).

## Point de départ : la mission

Faire que l'offset (position/dimension libre d'un item, posé via `SelectionFrame`/`LibreAdapter`) s'écrive correctement dans `initial.style` du perso Codplay, pour que Codplay/anime.js l'applique réellement au montage — pas seulement dans le document.

## Ce qui a été confirmé et corrigé pendant cette session (les 3 fixes tiennent, tests verts)

### Fix 1 — `introDecor` ignorait `.offset`
**Fichier** : `packages/editor/src/builder/build-scene.ts`, fonction `buildItemPerso`.
**Avant** : `style: { ...initialStyleFromIntro, ...introDecor?.style, ...resolveDecorStyle(firstKfDecor) }` — `introDecor` (le décor `item.initialDecorId`, utilisé quand aucun kf n'est explicitement sélectionné au moment du drag) ne contribuait que `.style`, jamais `.offset`.
**Après** : `...resolveDecorStyle(introDecor)` — même traitement que `firstKfDecor`.
**Pourquoi c'est réel** : `resolveTargetDecorId` (`scene-player-bridge.ts`) retombe sur `item.initialDecorId` quand `selection.keyframeId` est `undefined` (utilisateur n'a pas explicitement cliqué un losange de kf avant de dragger — un geste parfaitement naturel). Sans ce fix, l'offset écrit dans ce cas était silencieusement invisible pour toujours.
**CONFIRMÉ en live** : testé, le patch fonctionne pour ce cas précis.

### Fix 2 — confusion d'unité anime.js « unitless = px »
**Même fichier**, fonction `resolveOffsetAsStyle`.
**Avant** : `x`/`y`/`width`/`height` sortaient en nombre brut (ex. `x: 50.39`).
**Après** : `x`/`y`/`width`/`height` sortent en **chaîne avec suffixe `cqw`** (ex. `x: "50.39cqw"`). `rotate`/`scaleX`/`scaleY` restent des nombres bruts (pas d'ambiguïté d'unité pour eux).
**Pourquoi** : Codplay applique `style` (initial ET actions) via `animejs.utils.set`/le moteur de transition (`packages/codplay/src/runtime/components/lib/dom.ts::applyStyleProps`, ligne ~160, `utils.set(nodeRef, definedPatch)`) — **jamais une assignation DOM littérale**, contrairement à ce qui avait été établi (à tort) plus tôt dans la session précédente. Anime.js applique la convention « unitless = px » (`node_modules/animejs/dist/modules/core/consts.js`, `unitsExecRgx`) — un nombre brut cqw serait donc interprété comme des px.
**CONFIRMÉ en live** : `utils.set` accepte bien une chaîne avec suffixe alphabétique comme unité explicite (`unitsExecRgx = /^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)([a-z]+|%)$/i` matche `cqw`).

### Fix 3 — `LibreAdapter` suppose le node toujours en px
**Fichier** : `packages/authoring/selection-frame/src/adapters/libre-adapter.ts`.
**Problème** : `readTranslate`/`readPx` lisent `node.style.translate`/`node.style.width` (CSS inline littéral) et y ajoutent un delta px, en réécrivant en px explicite. Si le node vient d'être remonté par Codplay avec `translate`/`width` en `cqw` (suite au Fix 2), le premier geste après un rebuild traite un nombre cqw comme s'il était en px — double conversion confirmée par le soupçon de l'utilisateur (« un deplacement à lieu, mais les valeurs sont erronées »).
**Fix appliqué** : nouvelle fonction `pinToResolvedPx(node)`, appelée dans le callback `subscribeToNode` dès que le node est (re)capturé, AVANT tout geste — normalise `translate`/`width`/`height` vers du px explicite via `getComputedStyle` (qui résout toujours en px réels quelle que soit l'unité déclarée).
**Tests** : 167/167 (`selection-frame`), 400/400 (`editor`), `tsc --noEmit` propre sur les deux packages.
**Statut** : correctif structurellement correct et nécessaire, mais **son effet n'a pas pu être validé isolément** — voir le blocage ci-dessous, qui masque tout.

## Le blocage actuel — non résolu, cause racine inconnue

### Symptôme observé en live, reproductible

Séquence exacte :
1. Créer un item avec 2 kf (t=0 « intro », t=5000 « outro »).
2. Sélectionner explicitement le kf intro (`kf-4`/`decor-5`, confirmé par le libellé UI « kf: 0.0 s décor: decor-5 »).
3. Redimensionner via la poignée `nw` du `SelectionFrame` → DOM immédiatement correct : `width: 949px; height: 533.75px; translate: 71px 40px;`.
4. Debounce (250ms) → `persistOffset` écrit `decor-5.offset` correctement (`translate: {x:6.96, y:3.92}`, `width:93.04`, `height:52.33`, en cqw) → `RUN_TRANSACTION` → rebuild.
5. Le Builder produit un `initial.style` **correct** : `x: "6.96cqw", y: "3.92cqw", width: "93.04cqw", height: "52.33cqw", rotate: 0, scaleX: 1, scaleY: 1` — **CONFIRMÉ via le log `[DEBUG sceneDoc.stories.story-main]`**.
6. Après que Codplay a monté ce `sceneDoc` (donc APRÈS le rebuild), l'attribut `style` réel du node DOM est :
   ```
   transform: translate(6.960784cqw, 3.921569cqw) rotate(0deg) scale(1, 1); width: 8px; height: 8px;
   ```
   **CONFIRMÉ par lecture directe `getAttribute('style')` en live, deux fois, sur deux tests séparés (avant et après le fix container-type ci-dessous).**

Deux anomalies distinctes dans ce résultat :
- **(A)** Le `transform` est un **shorthand composé** (`transform: translate(...) rotate(...) scale(...)`), pas les propriétés CSS individuelles (`translate`/`rotate`/`scale` séparées) que `libre-adapter.ts` (`readTranslate`, etc.) sait lire. Non exploré plus loin — potentiellement un problème séparé ou lié.
- **(B)** `width`/`height` valent **`8px`**, une valeur qui ne ressemble à RIEN de transmis (`93.04cqw`/`52.33cqw` attendus). Confirmé identique sur deux tests différents (dimensions cqw différentes à chaque fois) — donc `8px` semble être une valeur de repli fixe, pas une conversion erronée proportionnelle.

Fait notable : le **transform, lui, se résout correctement** — `getComputedStyle(item-1).transform` donne `matrix(1, 0, 0, 1, 71, 40)`, soit exactement `6.96cqw`/`3.92cqw` reconverti en px réels (`1020px` de large × 6.96% ≈ 71px). Donc la résolution `cqw` fonctionne pour `transform`, mais pas pour `width`/`height`. C'est le fait le plus contraignant pour toute hypothèse — n'importe quelle explication doit rendre compte de cette asymétrie.

### Piste explorée et rejetée (au moins partiellement) — absence de `container-type`

**HYPOTHÈSE initiale** : `cqw` (container query width) nécessite un ancêtre avec `container-type: inline-size`/`size` déclaré — sans ça, pas de conteneur de requête valide, résolution en repli.

**Vérifié** : `SCENE_ROOT_CSS_RULE` (`packages/authoring/capsule-automation/src/core/build-grid.ts`, appliqué à `.ac-scene-root`, le parent direct de tout item racine) ne déclarait **jamais** `container-type`. **Fix appliqué** : ajout de `container-type:size;` à la règle.
- Tests mis à jour et verts : `packages/authoring/capsule-automation/tests/build-grid.spec.ts` (28/28), `packages/editor/tests/builder/build-scene.spec.ts` (400/400 au total package).
- **CONFIRMÉ en live** : le CSS injecté contient bien `container-type:size;` dans la règle `.ac-scene-root{...}` (lu directement depuis le `<style>` injecté par `extraResources`).
- **CONFIRMÉ en live** : `getComputedStyle(.ac-scene-root).containerType === "size"` — la règle s'applique bien, l'élément EST un conteneur de requête établi, avec `computedWidth: "1020px"`, `computedHeight: "573.75px"` corrects.
- **MALGRÉ ÇA** : `width`/`height` sur `item-1` (l'enfant direct) restent `8px` après le fix. **Le fix container-type seul n'a pas résolu le symptôme.**

Donc soit l'hypothèse « absence de container-type » était incomplète (il faut *aussi* autre chose), soit elle était une fausse piste et la vraie cause est ailleurs.

### Piste en cours d'exploration, non conclue — `animejs` `convertValueUnit`

**Fichier examiné** : `node_modules/animejs/dist/modules/core/units.js`, fonction `convertValueUnit` (utilisée quand anime.js doit convertir une valeur d'une unité vers une autre — possible chemin pour `utils.set` en interne).

Mécanisme observé (lignes 39-56) :
```js
const tempEl = el.cloneNode();
const parentNode = el.parentNode;
const parentEl = (parentNode && (parentNode !== doc)) ? parentNode : doc.body;
parentEl.appendChild(tempEl);
const elStyle = tempEl.style;
elStyle.width = baseline + currentUnit;   // ex. "100cqw"
const currentUnitWidth = tempEl.offsetWidth || baseline;
elStyle.width = baseline + unit;          // ex. "100px"
const newUnitWidth = tempEl.offsetWidth || baseline;
const factor = currentUnitWidth / newUnitWidth;
parentEl.removeChild(tempEl);
convertedValue = factor * currentNumber;
```
Anime.js clone le node, l'insère dans le même parent, mesure `offsetWidth` avec `100cqw` puis avec `100<unit-cible>`, calcule un facteur de conversion empirique. C'est un mécanisme fragile : le clone n'a ni le contenu, ni forcément le bon `display`/`box-sizing` hérité correctement selon le placement CSS Grid réel de l'item original (l'item original a `grid-row`/`grid-column` via `ac-cell-r1-c1-rs9-cs16`, un clone nu inséré dans le même parent grid pourrait se comporter très différemment — ex. auto-placement dans une case différente, ou dimension nulle si le contenu est vide).

**PAS ENCORE VÉRIFIÉ** : est-ce que `convertValueUnit` est réellement le chemin emprunté par `utils.set` pour `width`/`height` en `cqw` ? Est-ce que le clone produit effectivement `8px` via ce mécanisme ? Aucune preuve directe — c'est resté une hypothèse de code lue, jamais instrumentée/testée en live.

**Fait troublant à noter** : `8px` est une valeur suspicieusement ronde et fixe (identique sur deux tests avec des `cqw` sources différents) — cohérent avec une valeur de repli codée en dur quelque part (peut-être une taille de police par défaut, une valeur `minWidth`/`minHeight` implicite d'un composant texte vide, ou un défaut CSS `1em` ≈ 8-16px selon le contexte) plutôt qu'un résultat de calcul foireux qui varierait selon l'entrée.

## Autre chose non exploré du tout — le shorthand `transform`

`libre-adapter.ts` (`readTranslate`) lit `node.style.translate` (propriété CSS individuelle). Si Codplay/anime.js écrit un shorthand `transform` composé au lieu des propriétés individuelles séparées (`translate`/`rotate`/`scale`), alors après un rebuild, `node.style.translate` serait vide — cassant potentiellement `readTranslate` d'une manière différente du problème d'unité déjà traité par le Fix 3 (`pinToResolvedPx`, qui lit `getComputedStyle(node).translate` — à vérifier si `getComputedStyle` résout correctement `.translate` même quand seul le shorthand `transform` est posé en CSS inline ; probablement oui car le navigateur décompose `transform` vers les longhands calculés, mais **non testé explicitement**).

## Prochaines étapes suggérées (non commencées)

1. Isoler si `width: 8px` vient réellement de `convertValueUnit` — instrumenter ce fichier (ou un breakpoint/log temporaire) pour confirmer si ce code path est emprunté du tout pour ce cas.
2. Si confirmé, comprendre pourquoi le clone produit `8px` — probablement lié au fait que le clone, une fois détaché de son placement de grille réel (`grid-row`/`grid-column`), n'a plus la même largeur de référence — le `cqw` du clone se résout alors contre un contexte différent (peut-être le `doc.body` lui-même si `parentNode` est mal résolu, ou le conteneur query échoue silencieusement sur un élément qui n'a pas encore de layout stable au moment du clonage synchrone).
3. Vérifier si `width`/`height` doivent plutôt être appliqués via un mécanisme DIFFÉRENT de celui de `x`/`y`/`rotate`/`scale` (qui, eux, passent par `tweenTypes.TRANSFORM`, jamais par `convertValueUnit`/CSS générique) — peut-être que `width`/`height` en `cqw` ne devraient tout simplement jamais transiter par le moteur d'animation anime.js de la même façon, et qu'il faut un chemin d'application différent (assignation directe, hors `utils.set`) pour ces deux propriétés spécifiquement.
4. Vérifier le shorthand `transform` vs propriétés individuelles — est-ce voulu par Codplay (une décision de rendu), ou est-ce lui-même symptomatique d'un problème plus large dans la façon dont `utils.set` compose le patch final ?

## État du code au moment de la pause

Tous les fixes 1-3 ci-dessus SONT appliqués et commités dans l'arbre de travail (pas encore commit git, juste modifiés sur disque) :
- `packages/editor/src/builder/build-scene.ts` (Fix 1 + Fix 2)
- `packages/authoring/selection-frame/src/adapters/libre-adapter.ts` (Fix 3)
- `packages/authoring/capsule-automation/src/core/build-grid.ts` (container-type:size)
- Tests correspondants mis à jour dans les 3 packages, tous verts.
- Instrumentation de debug (`console.log`) retirée de `scene-player-bridge.ts`, SAUF le log préexistant `[DEBUG sceneDoc.stories.story-main]` dans `rebuild()` (accord permanent en attente : « dites-moi quand je peux le retirer », jamais confirmé).

Aucun de ces fixes n'est faux ou à annuler — ils sont tous nécessaires et corrects pour ce qu'ils couvrent. Le blocage restant (`width`/`height` → `8px`) est un problème distinct, plus profond, situé soit dans anime.js (`convertValueUnit`), soit dans une interaction entre le CSS Grid réel de l'item et le mécanisme de résolution `cqw` que ni le Fix 2 ni le Fix container-type n'ont suffi à couvrir.
