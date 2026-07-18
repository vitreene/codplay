# Étude — édition de pose d'un item sélectionné : cartographie et refonte

**Statut : implémenté et validé (2026-07-18).** Quatre chantiers clos : (1) "part-2" jamais fait à
l'époque (`2026-07-16-authoring-shared-tracking-layer-plan.md` §3 Étape 2, commit `559410b` s'arrêtait
à "part-1") — `csMachine` ne pilote plus une session de geste dupliquée en parallèle de
`TrackedSession`, elle la synchronise de façon synchrone à chaque transition acceptée ; (2) le bug de
lecture périmée pendant un geste (`offset-editor-bridge.ts::readLiveGestureNodePose`), vérifié en
direct dans le navigateur (un déplacement à kf1 puis désélection reste bien committé) ; (3) le canal
de commit explicite du §7 (`CsValueAdapter.onCommit`), fiabilisant le déclenchement du regroupement de
phase sans en changer le comportement observable ; (4) amendement de `v1-author-api-spec.md` (§8) et
correctif jumeau du décor temporaire (`decor-editor-bridge.ts`), même prémisse fausse trouvée une
seconde fois par audit de la spec.

Origine : bug constaté en usage réel — sélectionner un item à kf1, le déplacer, le désélectionner
faisait perdre la modification. Creusé jusqu'à la cause racine (anime.js compose la pose dans
`style.transform`, jamais dans les propriétés CSS discrètes que `LibreAdapter` écrivait), puis élargi
à une analyse structurelle complète du chemin d'édition de pose.

## 1. Fait empirique établi (testé, pas supposé)

anime.js (`utils.set`/`utils.get`) tient un cache interne **synchrone et cohérent** : écrire puis
relire immédiatement donne toujours la valeur juste écrite, aucune latence. Confirmé par un test
direct (`utils.set(node, {x:10}); utils.get(node, 'x', false)` → `10` immédiatement, y compris après
plusieurs écritures successives).

Confirmé aussi, dans le code source d'anime.js lui-même (`animejs/dist/modules/core/transforms.js`)
et déjà documenté dans un commentaire préexistant de `packages/codplay/src/runtime/components/lib/
dom.ts:232-241` : anime.js compose **toujours** `x`/`y`/`rotate`/`scaleX`/`scaleY` dans
`style.transform` (`translate(...) rotate(...) scale(...)`), **jamais** dans les propriétés CSS
discrètes séparées (`style.translate`/`.rotate`/`.scale`).

## 2. Bug racine trouvé

`LibreAdapter::seedResolvedPose` (`packages/authoring/selection-frame/src/adapters/libre-adapter.ts`,
avant correctif) écrivait la pose directement sur les propriétés CSS discrètes
(`node.style.translate = ...`, `.rotate = ...`, `.scale = ...`), en dehors du cache anime.js. Comme
anime.js n'écrit jamais dans ces propriétés-là (point 1), les deux mécanismes ne s'écrasent pas — ils
**se cumulent visuellement** (CSS applique `transform` ET les propriétés discrètes en même temps).
Confirmé par test empirique direct (`utils.set` puis écriture manuelle des propriétés discrètes puis
nouvel `utils.set` → la propriété discrète reste figée à l'ancienne valeur, jamais nettoyée par
anime.js, qui l'ignore superbement).

**Premier correctif appliqué** (packages/codplay, validé) : nouvelle fonction `writeNodePose`
(`dom.ts`) + méthode `PlayerApi.setNodePose`/`AuthorApi.setNodePose`, symétriques de
`readNodePose`/`getNodePose`, qui routent l'écriture via `utils.set` au lieu du DOM direct.
`LibreAdapter` réécrit pour lire `getNodePose`/écrire `setNodePose` à chaque `applyMove`/
`applyResize`/`applyRotate`/`applyScale`, au lieu de maintenir un état local seedé une fois.

**Deuxième bug trouvé immédiatement après, en testant** : `packages/editor/src/app/bridges/
offset-editor-bridge.ts::readLiveGestureNodePose` lisait ENCORE les mêmes propriétés CSS discrètes
que `LibreAdapter` n'écrit plus — un consommateur non audité avant le premier correctif. Preuve que
la méthode (corriger le premier point trouvé, tester, découvrir le suivant) est insuffisante : il
fallait cartographier TOUS les consommateurs avant de toucher au code, pas les découvrir un par un en
production. Voir [[feedback-analysis-then-stop-never-auto-execute]].

## 3. Cartographie complète du chemin d'édition (pointeur → document)

Établie par lecture exhaustive de `machine.ts`, `selection-frame.ts`, `gesture-session.ts`,
`tracked-session.ts`, `gesture-lifecycle-machine.ts`, `libre-adapter.ts`, `offset-editor-bridge.ts`,
`decor-editor/controller.ts`, `decor-editor/machine.ts`, `decor-editor-bridge.ts`,
`controller-machine.ts`.

Chaîne actuelle, par maillon :

1. **`bindGestureSession`** (`gesture-session.ts`) — capture les pointer events natifs
   (pointerdown/move/up/cancel/lostpointercapture) sur une cible DOM précise (corps du cadre, une
   poignée, l'aiguille de rotation, le pivot). Garantit un `onEnd(session, apply, event)` appelé
   **exactement une fois** par geste, avec un booléen `apply` non ambigu (`true` sauf
   `pointercancel`). **C'est le seul signal fiable et non ambigu de tout le système.**

2. **`selection-frame.ts`** — reçoit ce signal via ses 5 instances de `bindGestureSession` (drag,
   resize×N poignées, rotate, pivot, trace-création). À chaque `onMove`, calcule un delta incrémental
   et appelle **immédiatement** `adapter.applyMove/applyResize/applyRotate/applyScale` — la même API,
   identiquement, qu'il s'agisse d'un mouvement intermédiaire ou du dernier avant `onEnd`. Aucune
   distinction structurelle entre "valeur intermédiaire" et "valeur finale" à ce niveau (seule
   exception : le drag en contexte grille, où rien n'est envoyé à l'adapter avant `onEnd`). À `onEnd`,
   envoie un event à `csMachine` (`DRAG_END`/`RESIZE_END`/`ROTATE_END`) et appelle `sync()`
   (repositionnement visuel pur, ne notifie personne à l'extérieur du module).
   `CsValueAdapter`/`SelectionFrameHandle` n'exposent aucune méthode `onCommit`/`onGestureEnd` — la
   donnée du geste fini (portée par `session` dans `onEnd`) n'est jamais transmise vers l'extérieur.

3. **`csMachine`** (`machine.ts`) — machine XState **indépendante**, écrite à la main, gérant l'état
   UI du cadre (`idle → active(still/dragging/resizing/rotating) ⇄ suspended`, plus un sous-arbre
   `creating` pour le mode création). Ne touche jamais le DOM elle-même. Deux events déclarés
   (`DRAG_MOVE`, `SYNC`) ne sont écoutés par AUCUNE transition — envoyés mais sans effet, du
   vocabulaire mort.

4. **`TrackedSession`** (`tracked-session.ts`) — **une deuxième machine XState**, générée
   dynamiquement par `createGestureLifecycleMachine` (`gesture-lifecycle-machine.ts`), avec le même
   squelette conceptuel que `csMachine` (`idle → active(still/<gesture>) ⇄ suspended`) mais codée et
   instanciée séparément. C'est elle qui porte `isGestureActive()`. `csMachine` et cette machine ne
   sont PAS composées XState-ment — `selection-frame.ts` fait un **mirroring manuel** : à chaque
   transition de sous-état de `csMachine`, il appelle à la main `anchor.startGesture(kind)`/
   `endGesture(kind)` sur la `TrackedSession`. Deux sources de vérité paral·lèles pour "un geste est-il
   en cours", synchronisées par du code impératif, jamais par construction.

5. **`LibreAdapter`** — reçoit les deltas, les applique désormais via `AuthorApi.setNodePose` (après
   le premier correctif), et notifie `onApplied(change)` à **chaque** delta appliqué — un flux
   continu, jamais un signal de fin.

6. **`offset-editor-bridge.ts::readActivePose`** — bifurque selon `isGestureActive()` (la machine du
   point 4) : geste actif → `readLiveGestureNodePose` (lit les propriétés CSS discrètes — **c'était le
   deuxième bug**, maintenant qu'il n'y a plus rien à y lire) ; sinon → `getNodePose`. `notifyNow(kind)`
   relaie cette lecture vers `onValues` à chaque `onApplied` reçu — encore un flux continu, la fin de
   geste n'est visible ici que par la **disparition** ultérieure de `isGestureActive()`, observée à un
   instant disjoint, jamais reçue comme un événement porteur de la valeur finale.

7. **`decor-editor/controller.ts`** — `onValues` → `applyPatch({offset:...})` → événement `PATCH.APPLY`
   sur une **troisième machine XState** (`decorEditorMachine`), qui accumule le patch dans
   `context.items[].patch`.

8. **`decor-editor-bridge.ts`** — `onDecorChange` traduit ce patch en `commands`, stockées dans
   `pendingCommands` (**variable de closure mutable, hors XState**) — pas committées immédiatement.
   Un flush (`RUN_TRANSACTION`, seul point d'écriture réel du document via `controller-machine`) est
   déclenché par l'un de 6 signaux disjoints : changement de sélection, seek, mutation externe du
   document, Échap, `flushPending` (avant play), ou un minuteur d'inactivité de 4000 ms
   (`PHASE_IDLE_FLUSH_MS`) réarmé à chaque signal d'activité — dont la fin d'un geste CS
   (`onGestureActiveChange`), qui n'arme QUE ce minuteur, ne flush jamais immédiatement.

**Constat central** : le seul signal réellement fiable de tout le système (`bindGestureSession::
onEnd`, point 1) est dilué dès le maillon 2 en un flux indifférencié, puis "fin de geste" est
reconstitué 5 maillons plus loin par déduction (`isGestureActive() === false`), à travers 3 machines
XState non reliées entre elles et 3 variables de closure mutables (`pendingCommands`,
`lastKnownTimelineMs`, `applyingFromBridge`). Aucun maillon ne porte "voici la valeur finale de ce
geste" comme un message explicite — c'est reconstruit par observation d'états annexes à chaque étage.

## 4. Pourquoi committer "à la désélection" committe une valeur déjà fausse

`sceneCommitted` (émis par `SELECT_ITEM`/`CLEAR_SELECTION`) déclenche bien `flushNow()`
immédiatement (signal 1, pas de délai de 4s en cause) — mais au moment du flush, `entry.patch.offset`
contient déjà la valeur lue via `readLiveGestureNodePose` pendant le dernier geste actif, périmée par
le bug du point 2. Le flush est fidèle ; c'est la donnée en amont qui est fausse. Corriger uniquement
`readLiveGestureNodePose` (le supprimer, puisque `getNodePose` est maintenant fiable pendant un
geste) referme ce bug précis — mais ne referme pas la fragilité structurelle du point 3.

## 5. Le défaut est générique à `Decor`, pas spécifique à `offset`/transform

Point tranché explicitement par l'auteur (2026-07-18) : `transform` ne doit jamais être traité comme
une propriété à part du modèle `Decor` — même mécanisme que `color` ou n'importe quel autre champ de
`style.*`. Vérifié en relisant le chemin d'édition palette normal (`render.ts`, `decor-editor/
controller.ts`) :

- `DecorPatch` (`decor-editor/types.ts:72-82`) traite déjà `style` et `offset` comme deux champs du
  même objet, au même niveau — le modèle de données ne sépare pas transform du reste.
- `controller.applyPatch(patch)` (`decor-editor/controller.ts:206-216`) est déjà LE point d'entrée
  commun pour toute propriété (couleur, offset, texte...) — `offset` a une branche additionnelle
  (réinjection vers le CS via `offsetBridge.apply()`) uniquement parce qu'il a un second consommateur
  visuel synchronisé (le cadre CS) que `color` n'a pas — différence réelle et légitime, pas un défaut.
- **Le color picker (`renderColorField`, `render.ts:223-254`) a DÉJÀ un geste continu**, exactement du
  même type que le CS : l'event natif `input` (à chaque frame du picker, flux continu) appelle
  `controller.applyPathPatch(...)` ; l'event natif `change` (LE seul signal de fin de geste sur un
  `&lt;input type=color&gt;`) appelle `controller.notifyInteractionEnd()`. Ce n'est donc pas un cas
  hypothétique futur — c'est un cas réel déjà présent, avec le bon vocabulaire d'événements
  (preview continu / fin de geste discrète) déjà en place au niveau du DOM natif.
- Mais **`notifyInteractionEnd()` n'est PAS traité comme un commit** côté
  `decor-editor-bridge.ts:456-465` — il n'arme que le minuteur d'inactivité de 4000 ms, "harmonisé"
  (arbitrage 2026-07-17, commentaire en place) avec la fin d'un geste CS pour la même raison. Donc le
  défaut trouvé (fin de geste diluée en simple signal d'activité plutôt qu'en commit porteur de
  valeur) **existe déjà pour `color`, identiquement à `offset`** — ce n'est pas un problème propre au
  CS/transform, c'est un problème du point de convergence commun (`decor-editor-bridge.ts`) qui
  concerne déjà toute propriété à geste continu, couleur incluse.

**Conséquence sur la portée de la reconstruction** : le canal preview/commit à concevoir (§6
ci-dessous) doit être un concept générique de `Decor`/dedit — pas quelque chose de propre à
`LibreAdapter`/`offsetBridge`. Le CS et le color picker (et tout futur champ à geste continu) doivent
converger vers le MÊME mécanisme de signal de commit, pas deux mécanismes parallèles harmonisés à la
main comme aujourd'hui.

## 6. Ce qui a été fait (2026-07-18)

- **Point 3 fermé** : `csMachine` (`selection-frame.ts`) ne pilote plus une session de geste dupliquée
  en parallèle de `TrackedSession` — chaque `DRAG_START`/`RESIZE_START`/`ROTATE_START` accepté par
  `csMachine` (guards de capacité inchangés, toujours la seule source de décision) notifie
  immédiatement et de façon synchrone `TrackedSession.startGesture`/`endGesture`
  (`syncTrackedGestureStart`/`syncTrackedGestureEnd`), remplaçant l'ancien mirroring différé
  (`actor.subscribe` réagissant après coup). Ferme le chantier "part-2" jamais fait depuis le commit
  `559410b` (`559410b` = "part-1", aucun "part-2" dans l'historique — oubli, pas abandon décidé, cf.
  `packages/editor/plan/app/2026-07-16-authoring-shared-tracking-layer-plan.md` §3 Étape 2).
  `MultiSelectionFrame`/`ZoneEditor` audités : pas concernés (aucune `TrackedSession` partagée en
  pratique pour l'un, `zoneMachine` seule machine de geste pour l'autre — pas de vraie duplication).
- **Bug de lecture périmée corrigé** : `offset-editor-bridge.ts::readLiveGestureNodePose` (lisait
  `node.style.translate`/`.rotate`/`.scale`, plus jamais écrits depuis que `LibreAdapter` route via
  `AuthorApi.setNodePose`) supprimée ; `readActivePose` appelle `getNodePose` inconditionnellement,
  fiable pendant un geste comme hors geste. Vérifié en direct (navigateur, geste pointeur synthétique
  + `CLEAR_SELECTION`) : `scene.decors[kf1].offset.translate` porte bien le delta du geste après
  désélection — le bug original (position perdue) ne se reproduit plus.
- Tests : `codplay` 302/302, `selection-frame` 198/199 (+1 skip jsdom déjà documenté), `editor`
  457/457, `tsc` propre partout.

## 7. Canal de commit explicite — implémenté (2026-07-18)

Arbitrage tranché avant implémentation : le regroupement en PHASE
(`app/2026-07-17-phase-commit-selection-recovery-plan.md`, plusieurs gestes enchaînés = un seul
commit, idle en déclenche un) est PRÉSERVÉ — ce chantier ne change QUI porte l'information de fin de
geste (un message explicite plutôt qu'un état à déduire), jamais QUAND committer.

- **`CsValueAdapter.onCommit?(kind)`** (`types.ts`) — nouvelle méthode optionnelle, appelée
  exactement une fois par geste réellement appliqué (jamais sur un abort/`pointercancel`), distincte
  du flux continu `applyMove`/`applyResize`/`applyRotate`/`applyScale`.
- **`selection-frame.ts`** — chaque `onEnd` (drag/resize/rotate) appelle `adapter?.onCommit?.(kind)`
  après `syncTrackedGestureEnd`, gardé par le paramètre `apply` de `bindGestureSession` (jamais émis
  sur un abandon). Le mode resize/scale d'une poignée (`session.mode`) détermine le `kind` — la
  machine XState reste `resizing` dans les deux cas (scale n'a pas de sous-état propre), seul le
  signal de commit distingue les deux valeurs réellement appliquées.
- **`LibreAdapter`** — relaie `onCommit` tel quel vers `options.onCommit`.
- **`scene-player-bridge.ts`** — câble `onCommit: (kind) => offsetBridge.commitNow(kind)`, à côté de
  `onApplied` (preview) déjà existant.
- **`offset-editor-bridge.ts`** — `commitNow(kind)`/`onCommit(cb)` ajoutés à
  `OffsetEditorBridgeHandle`/`OffsetEditorBridge` : `commitNow` rebroadcast le signal sans porter de
  valeur (déjà transmise en continu via `notifyNow`/`onValues`).
- **`decor-editor-bridge.ts::wireOffsetBridge`** — le début de geste (`onGestureActiveChange(true)`)
  continue d'annuler un flush déjà armé ; la fin de geste arme désormais le minuteur via `onCommit`
  au lieu de `onGestureActiveChange(false)` — comportement observable identique (même regroupement,
  même délai d'inactivité), source du signal fiabilisée.

Le canal reste spécifique à `offset`/CS pour l'instant — le color picker (`notifyInteractionEnd`, un
vrai event DOM `change`) a déjà un signal fiable nativement et n'a pas eu besoin d'un canal
équivalent ; en construire un générique à `Decor` au-delà de ces deux cas reste non fait, à
reconsidérer si un troisième module à geste continu apparaît.

Tests : 5 nouveaux (`selection-frame.spec.ts` ×2, `adapters.spec.ts` ×1, `offset-editor-bridge.spec.ts`
×2), tous confirmés rouges sans le correctif avant d'être committés verts. `codplay` 302/302,
`selection-frame` 201/202 (+1 skip jsdom déjà documenté), `editor` 459/459, `tsc` propre partout.

## 8. Amendement spec + décor temporaire fiabilisé (2026-07-18)

- **`docs/formalisation/v1-author-api-spec.md`** amendée : la section "Non sûr pendant un geste CS
  actif" (`getNodeSnapshot`) devient "Sûr pendant un geste CS actif" — vérifié qu'aucune propriété que
  `getNodeSnapshot` demande réellement (`style.*` de la palette, jamais `x`/`y`/`rotate`/`scaleX`/
  `scaleY`/`width`/`height`) n'entre en conflit avec ce que `LibreAdapter` écrit encore directement
  (`transformOrigin`, `left`/`top` en mode `top-left`) — les deux catégories sont disjointes.
  `setNodePose` (jamais documentée depuis son ajout) intégrée au périmètre, à l'interface
  `AuthorApi`, à ses propres "Contrats par méthode", et aux "Additions requises sur `PlayerApi`".
- **`decor-editor-bridge.ts`** — le décor temporaire (playhead entre deux keyframes) retirait sa
  propre exception `!gestureActive` (héritée de la même prémisse fausse) : il restait figé sur le kf
  précédent pendant tout geste CS au lieu de suivre le geste en cours. Corrigé — `resolveTemporaryPatch`
  appelée inconditionnellement, `getNodeSnapshot` fiable en permanence.
- Tests : `packages/codplay/tests/v1/author-api-set-node-pose.spec.ts` (4 tests, patron symétrique de
  `author-api-get-node-pose.spec.ts` — jamais existé depuis l'ajout de `setNodePose`) ; un test
  `decor-editor-bridge.spec.ts` pour le décor temporaire pendant un geste actif, confirmé rouge sans
  le correctif (couleur de kf1 reçue au lieu de la couleur live du node) avant d'être vert.
  `codplay` 306/306, `editor` 460/460, `tsc` propre partout.

## 9. Ce qui reste ouvert

- **Canal générique à `Decor`** (au-delà d'offset/CS et du color picker) — non construit, cf. §7.
- Comportement multi-sélection, interruption de geste par seek/rebuild pendant que `onCommit` est en
  vol, undo (aucun mécanisme n'existe encore dans `packages/editor/src`) — non vérifiés.
