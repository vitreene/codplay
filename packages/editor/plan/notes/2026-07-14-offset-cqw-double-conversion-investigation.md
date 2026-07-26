# Investigation — offset (position/dimension) faux après un cycle drag → persist → rebuild → re-drag

Note de travail, contexte figé à l'instant où l'investigation s'est arrêtée pour réflexion. Écrite pour reprise dans une autre session — chaque affirmation ci-dessous est soit vérifiée en live (marquée **CONFIRMÉ**), soit une hypothèse non encore tranchée (marquée **HYPOTHÈSE**).

## Mise à jour 2026-07-14 (suite) — résolu côté Codplay

Le blocage `width`/`height` → `8px` documenté ci-dessous est **résolu** par le commit Codplay `d771a1e` (« container-query-units ») : la conversion `cqw`→px se fait désormais **en amont**, avant d'atteindre anime.js — `packages/codplay/src/runtime/components/lib/container-query-units.ts` mesure directement le conteneur de requête réel (`node.closest('.ac-scene-root')` + `getBoundingClientRect`, une fois) et calcule par arithmétique pure (formule `cqwToPx`, dupliquée depuis `packages/editor/src/decor-editor/units.ts`, même précédent que `packages/authoring/text-auto-size/src/core/cqw.ts`). Anime.js/`utils.set` ne voit plus jamais de valeur `cqw` brute — seulement des px déjà résolus. Détail complet de la délibération : `packages/codplay/plan/notes/2026-07-14-container-query-unit-resolution-deliberation.md`.

Confirmé après reprise des tests (voir section suivante) : **tout le pipeline offset (Fix 1/2/3 ci-dessous + ce correctif Codplay) est maintenant vert** — 290/290 (codplay), 167/167 (selection-frame), 28/28 (capsule-automation), 400/400 (editor).

**Point technique annexe non résolu, sans impact fonctionnel** : `packages/codplay/src/types/typed-om-polyfill.d.ts` (shim pour un `.d.ts` cassé de la dépendance `typed-om-polyfill`) n'est vu que lorsque `packages/codplay` compile lui-même. Quand `packages/editor` compile isolément (`tsc --noEmit`, `include:["src"]`, atteint `codplay/*` seulement via `paths` de résolution de module, jamais les fichiers physiques de `codplay/src/types/`), l'erreur `File '.../typed-om-polyfill/build/index.d.ts' is not a module` apparaît — un problème de propagation de shim `.d.ts` entre projets TS séparés du monorepo (pas de project references ici), pas un défaut du shim lui-même (confirmé : aucune erreur quand `codplay` compile seul). Les 400 tests d'`editor` passent malgré ça — décision explicite de l'auteur : ne pas corriger maintenant, documenter seulement.

## Mise à jour 2026-07-14 (suite 2) — `width`/`height` toujours faux en live, cause racine trouvée

Contrairement à ce qu'affirmait la mise à jour précédente, **`width`/`height` restent `8px` en live après un cycle drag → persist → rebuild**, même avec le fix `container-query-units` en place — CONFIRMÉ par re-test identique au précédent (poignée `nw`, `kf-4`/`decor-5`, `initial.style` produit par le Builder contenant `x/y/width/height` en `cqw`).

**Cause racine, CONFIRMÉE par instrumentation directe** (log temporaire posé puis retiré dans `resolveContainerQueryValue`, `packages/codplay/src/runtime/components/lib/container-query-units.ts`) :

```
[DEBUG resolveContainerQueryValue] rawValue= 93.03921568627452cqw parsed= Object   ← parsing réussit
[DEBUG resolveContainerQueryValue] containerNode= null                              ← .closest() échoue
```

`parseContainerQueryValue` réussit systématiquement (confirmé : `CSSStyleValue.parse('width', '93.03...cqw')` fonctionne correctement en isolation, testé directement dans la console via un `<script type="module">` injecté — `registerParsers` du polyfill `typed-om-polyfill` est bien exécuté, aucun souci de bundle/singleton ESM, même URL de module des deux côtés). Mais **`node.closest('.ac-scene-root')` retourne systématiquement `null`** au moment précis où `resolveContainerQueryValue` est appelée pendant le montage (`applyStyleProps`/`utils.set`, `dom.ts:157`).

Hypothèse la plus probable (non encore vérifiée formellement, mais cohérente avec tous les faits) : **au moment où Codplay applique `initial.style` sur le node, celui-ci n'est pas encore inséré dans l'arbre DOM réel** (encore détaché / en cours de construction par le runtime), donc `.closest()` ne peut pas remonter jusqu'à `.ac-scene-root`. Un test manuel ultérieur sur le MÊME node, une fois pleinement monté et présent dans le DOM final, confirme que `.closest('.ac-scene-root')` fonctionne alors parfaitement (`closestFound: true`) — donc le problème est bien un problème de timing (node détaché au moment de l'appel), pas un problème de sélecteur ou de structure DOM en soi.

Fait notable et cohérent avec cette hypothèse : le `transform` shorthand (`x`/`y`/`rotate`/`scale`) est ÉGALEMENT resté en `cqw` non résolu dans le même test (`transform: translate(6.960784cqw, 3.921569cqw) rotate(0deg) scale(1, 1)`) — donc ce n'est pas un problème spécifique à `width`/`height`, c'est un problème global de timing qui affecte TOUTES les valeurs `cqw`, y compris celles qui semblaient "marcher" lors d'un test antérieur (ce test antérieur lisait probablement `getComputedStyle().transform`, qui RÉSOUT le `cqw` littéral côté navigateur au moment de la lecture — masquant que la valeur CSS elle-même, elle, n'avait jamais été convertie en px par Codplay).

**Prochaine étape suggérée** : trouver le bon moment/mécanisme pour résoudre `cqw`→px — soit en différant l'appel à `resolveContainerQueryValue` jusqu'à ce que le node soit confirmé attaché au DOM (ex. après l'insertion réelle, pas pendant la construction de `definedPatch`), soit en remontant au conteneur autrement qu'en dépendant de la position du node dans l'arbre (ex. le node de montage racine étant déjà connu par ailleurs dans le pipeline Codplay, sans passer par `.closest()`).

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

## Mise à jour 2026-07-14 (suite 3) — le vrai défaut de conception : `.closest()` interroge le DOM directement

Correction de trajectoire de l'auteur, décisive : **la faute n'est pas un problème de timing à contourner, c'est une violation du principe fondamental de Codplay** — *jamais interroger le DOM directement* pour retrouver une relation structurelle. `node.closest('.ac-scene-root')` (`container-query-units.ts:79`) fait exactement ça : une traversée DOM physique pour retrouver un ancêtre, alors que Codplay connaît déjà cette hiérarchie de façon déclarative, indépendamment de tout montage.

**Le bon mécanisme existe déjà dans le runtime**, repéré dans `packages/codplay/src/runtime/components/runtime-component-orchestrator.ts` :
- `nodeByPersoId: Map<string, unknown>` (l. 97) — le node réel de chaque perso, indexé par `persoId`, jamais par recherche DOM.
- `parentListByPersoId: Map<string, string | null>` (l. 99) — la chaîne de parenté déclarée (`move.parentId`), connue dès la compilation, avant tout montage physique.

C'est CETTE hiérarchie qu'il faut remonter pour trouver le perso racine porteur de `container-type` (celui marqué `ac-scene-root`), pas une traversée `.closest()`.

**Ce qui reste à trancher (pas fait, decision de conception qui revient à l'auteur)** : `resolveContainerQueryValue` est appelée depuis `dom.ts::applyStyleProps`, qui est lui-même appelé depuis `component-services.ts:56` — un chemin qui ne reçoit que le `node` brut, jamais le `persoId` ni une référence à l'orchestrateur/ses maps. Combler cet écart demande de choisir COMMENT faire transiter soit le `persoId` soit une résolution déjà faite (le node racine, ou directement la largeur de référence en px) jusqu'à ce point précis — injection de dépendance dans `component-services.ts`, service dédié consulté par `applyStyleProps`, ou un autre mécanisme. Non commencé, à concevoir avec l'auteur avant tout code.

**État du code à cette étape** : `container-query-units.ts` est revenu à l'état exact du commit `d771a1e` (instrumentation de debug ajoutée puis intégralement retirée, aucune modification de fond conservée) — le défaut de conception ci-dessus reste entier, non corrigé, en attente d'une décision.

## Mise à jour 2026-07-14 (suite 4) — référence normative déjà existante, jamais consultée avant cette section

Faute de méthode signalée sèchement par l'auteur : la section précédente traitait `.closest()` comme une découverte de conception nouvelle, sans avoir vérifié si `docs/formalisation/` documentait déjà le bon mécanisme. Il le fait.

**`docs/formalisation/2026-07-07-text-auto-size-spec.md` §3.1 "Environnement de mesure"** (normatif, déjà écrit avant ce chantier) :
> « La mesure ne se fait **pas** dans le DOM visible de dedit : un environnement de mesure séparé (`OffscreenCanvas`, jamais rattaché au DOM — pas même un `<canvas>` détaché)... Ce choix isole le module de tout DOM monté... et l'aligne sur la pureté de `capsule-automation` (aucune dépendance DOM affichée, résultat déterministe à entrée identique). »

**§3.3 "Conversion en cqw"** :
> « La mesure est nécessairement faite à une largeur de conteneur de référence, en pixels... Conversion par règle de 3 simple, même principe que la conversion px ↔ cqw déjà prévue pour le pont position (`2026-07-07-dedit-spec.md` §3.3, §6) : `fontSizeCqw = fontSizePx / largeurConteneurPx × 100`. Pas de nouvelle mécanique de conversion : réutilisation du principe existant. »

Le paramètre porté explicitement s'appelle **`referenceWidthPx`** (déjà nommé ainsi dans `text-auto-size-spec.md` §4, ligne 265 de son schéma de types) — le même nom que celui déjà utilisé côté ed2 (`app/controller/types.ts::ControllerContext.referenceWidthPx`, `scene-player-bridge.ts`). C'est un principe **déjà établi et nommé de façon cohérente dans ce dépôt**, pas quelque chose à inventer : toute résolution `cqw`→px doit recevoir sa largeur de référence en paramètre explicite, jamais la déduire d'une lecture DOM en direct (`.closest()`, `getBoundingClientRect()` sur un ancêtre trouvé par traversée).

Ceci **contredit directement l'approche retenue dans `packages/codplay/plan/notes/2026-07-14-container-query-unit-resolution-deliberation.md`**, section "Pourquoi le conteneur de requête n'a pas besoin d'être découvert par un paramètre injecté ni un parcours DOM générique" — qui écarte explicitement l'option `referenceWidthPx` injecté au profit de `node.closest('.ac-scene-root')`. Cette décision doit être rouverte à la lumière de la spec text-auto-size, qui établit déjà ce précédent nommé et normatif pour exactement ce problème (conversion `cqw`→px sans jamais toucher le DOM monté).

## Mise à jour 2026-07-14 (suite 5) — arbitrage tranché, spec normative écrite

Décision de l'auteur : `.closest('.ac-scene-root')` est confirmé invalide — « il interroge le DOM directement sur un id sans aucune garantie de continuité ». Le conteneur de requête doit être identifié par le perso root de la scène (déjà connu via `CompiledScene.rootNodeIds`, calculé au build), pas redécouvert par traversée DOM.

Granularité tranchée : détail d'implémentation. Principe retenu — codplay est un routeur d'events ; il y a toujours un root défini pour projeter les items de la scène ; la résolution du conteneur se fait à la lecture de la scène (build/init), une seule fois ; le node du perso root est ensuite mis à disposition via le registre runtime existant (`nodeByPersoId`) ; si `container-type` n'est pas encore posé sur ce node, le runtime l'assure lui-même à ce même moment d'init.

Spec normative écrite : `docs/formalisation/2026-07-14-container-query-resolution-spec.md`. La délibération `container-query-unit-resolution-deliberation.md` est annotée comme arbitrage renversé sur ce point précis. **Implémentation non commencée** — reste à faire : `container-query-units.ts` (et ses 3 call-sites : `dom.ts`, `dom-component-adapter.ts`, `animation/adapter.ts`) doivent être adaptés pour consulter la résolution faite à l'init au lieu de `.closest()`.

## Mise à jour 2026-07-16 — clôture : `.closest()` était déjà résolu, la vraie cause était ailleurs

Reprise de session : `.closest('.ac-scene-root')` **n'existe plus du tout** dans le
code (confirmé par grep, deux commits déjà en place et propres, `d771a1e` +
`5fe0777 fix w-h null` — le registre déclaratif `setContainerQueryRootNode`/
`nodeByPersoId` décrit ci-dessus était déjà implémenté entre l'écriture de cette note
et cette reprise). Le symptôme observé en direct (`transform: translate(60px,
-8.62069cqw)...`, unités mixtes) n'avait donc **aucun rapport** avec ce défaut de
conception — fausse piste.

**Cause racine réelle, trouvée et corrigée** : `container-query-units.ts::
parseContainerQueryValue` parsait chaque valeur cqw via
`CSSStyleValue.parse('width', rawValue)` — la propriété CSS `width` interdit les
longueurs négatives, donc toute valeur cqw négative (typiquement `y` d'une
translation vers le haut) faisait lever un `TypeError` silencieusement avalé par le
`catch`, repassant non convertie. Confirmé empiriquement : `CSSStyleValue.parse
('width','-8.62cqw')` lève, `CSSStyleValue.parse('margin-left','-8.62cqw')` réussit.
Corrigé en parsant contre `margin-left`. Détail complet, plus la réflexion
architecturale plus large que cette investigation a déclenchée (réduction du rôle
d'anime.js, doublons relevés, chantiers) :
`docs/projet/2026-07-16-solve-project-moteur-custom.md`.
