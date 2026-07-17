# ed2 — Restaurer la sélection pérenne et le commit de fin de phase ; retirer les props intouchées

**Statut : exécuté et validé (2026-07-17)** — étapes A, B, C toutes implémentées, testées (vitest +
Safari), zéro régression sur la suite existante (30 fichiers/423 tests dans `packages/editor`).
Détail par étape en fin de chaque section.

**Complément post-clôture (même jour)** : deux gaps signalés par l'auteur après cette clôture initiale,
traités dans la foulée — voir §Complément en fin de document (resize/scroll du CS, et un bug réel de
preview décor sans rapport avec les étapes A-C, présent depuis la toute première version de
`mount.ts`).

Fait suite au diagnostic live du 2026-07-17 (scène démo : première manipulation → cadre de sélection
perdu, irrécupérable). Trois régressions des chantiers 1-3 + étape D, restaurées ici depuis la
dernière version où elles fonctionnaient.

**Arbitrage acté par l'auteur (2026-07-17)** : le `change` d'un champ palette s'harmonise avec la
directive la plus récente (`2026-07-16-gesture-rebuild-ordering-plan.md` §6) — c'est un signal de
**fin de salve** qui alimente la phase, jamais un commit en soi. La formulation antérieure de
`2026-07-12-app-controller-definition.md` §4.3 (« fin de geste franche → commit tout de suite ») est
remplacée sur ce point (note à porter dans ce document, en fin de fichier).

## D'où ça vient, où c'est parti

Vérifié dans l'historique git (branche `ed2`) — ce plan restaure, il ne conçoit pas :

- **Sélection pérenne** : de `b35c07f` (naissance du pont) à `db18e52` (dernière version
  fonctionnelle), `selectItem` détruisait et recréait **inconditionnellement** le frame après chaque
  commit+rebuild, avec une souscription `subscribeToNode` fraîche — la sélection ne se perdait
  jamais. Supprimé par une ligne de `7e4534f` (« gesture-rebuild-ordering ») :
  `if (itemId === currentItemId) return`. Le plan exécuté par ce commit (§3.2 de
  `2026-07-16-rebuild-ordering-execution-plan.md`) demandait « remplacement ordonné », pas « aucun
  remplacement » — c'est une déviation d'implémentation, jamais écrite dans un plan validé.
- **Commit en fin de phase** : jamais câblé correctement — le débounce 250 ms est né avec le pont
  (`b35c07f`) et n'a jamais été remplacé par la cadence que `docs/plans/2026-06-09-selection-frame-
  plan.md` et `2026-07-16-gesture-rebuild-ordering-plan.md` §6 décrivent (« décision de l'éditeur »,
  pas un minuteur fixe). Le patron existe déjà, testé, dans `sequence-editor/mount.ts`
  (`pointerup` → `dragEnd`), cité par le §6 comme modèle à répliquer.
- **Props intouchées dans l'écart offset** : le commit de la pose **complète** (translate + w/h +
  rotate + scale, même quand un seul de ces champs a bougé) est présent depuis `b35c07f` — jamais
  correct, pas une régression récente, confirmé par l'auteur comme prématuré.

---

## Étape A — remplacement ordonné du frame après tout rebuild réel (restaure `db18e52`)

`scene-player-bridge.ts`, handler `sceneCommitted` :

- Quand `scene !== lastScene` (mutation réelle du document) : après `rebuild(scene)`, forcer la
  reconstruction session+frame **même si l'item sélectionné est inchangé** — un chemin
  `reattachSelection(itemIds)` qui fait `destroySelection(() => attachSelection(itemId))` sans le
  garde d'identité. La re-souscription `subscribeToNode` fraîche reçoit immédiatement le node attaché
  (contrat « appel immédiat » — c'est exactement pourquoi la sélection fonctionne à la création).
- Quand `scene === lastScene` (écho de sélection) : `selectItem` actuel inchangé, no-op même-item
  conservé — légitime dans ce seul cas.
- Les gardes d'ordonnancement existants sont réutilisés tels quels : `destroySelection` attend la fin
  d'un geste en cours, `attachSelection` vérifie la supplantation (`itemId !== currentItemId`).
- Ménage : retirer le commentaire devenu faux (« l'ancre existante suit déjà le node remonté ») et le
  `console.log('[DEBUG sceneDoc…')` laissé dans `rebuild()`.

**Test** : Safari scripté — charger la démo, créer un item, sélectionner, drag, attendre le commit :
le cadre reste visible et manipulable après le rebuild ; enchaîner un second drag immédiatement, sans
recharger ni changer de sélection.

**Fait, validé (2026-07-17)** — Safari : trois drags enchaînés sur le même item, le cadre reste
visible et réactif après chaque commit, aucune erreur (hors l'artefact connu `setPointerCapture` sur
pointeur synthétique, sans rapport). `console.log` de debug retiré.

## Étape B — fin de phase réelle, à la place du minuteur 250 ms

`decor-editor-bridge.ts`. Dedit continue d'émettre en continu (spec §4.3, inchangé) ; `pendingCommands`
continue d'accumuler le dernier écart complet. Ce qui change : **plus aucun flush armé par un délai
court après chaque micro-geste ou `change`**. `armFlush(250)` disparaît. Les déclencheurs de
`flushNow()` deviennent, conformément à §6 et au cadre 2026-06-09 :

1. **Changement de sélection** — `SELECT_ITEM` vers un autre item, ou `CLEAR_SELECTION` : flush avant
   `syncSelection`.
2. **Clic hors CS** — **déjà câblé**, pas construit ici : `AppLayout.tsx::useClearSelectionShortcuts`
   (`mousedown` sur `.app-region--scene` hors `[data-selection-frame]` → `CLEAR_SELECTION`) existe
   depuis `2026-07-16-rebuild-ordering-execution-plan.md` §4.2. Découvert en cours d'exécution de ce
   chantier — une première version de cette étape avait recréé un second écouteur redondant dans
   `scene-player-bridge.ts`, retiré. Le signal 1 s'en sert tel quel, sans rien y ajouter.
3. **Seek de l'auteur** — sur l'event `seek` de la machine : flush immédiat.
4. **Inactivité longue** — un seul minuteur, `PHASE_IDLE_FLUSH_MS` (constante nommée, valeur initiale
   4000 ms, à doser). Armé/réarmé par chaque signal d'activité : `onDecorChange`,
   `notifyInteractionEnd` (`change` palette), fin de geste CS (`onGestureActiveChange(false)`).
   Annulé par un début de geste (`onGestureActiveChange(true)`). La double garde de tir
   (`isGestureActive()` consulté dans `flushNow`) est conservée.
5. **Mutation externe du document** — un `sceneCommitted` avec nouvelle référence de scène alors que
   `pendingCommands !== null` et que ce commit ne vient pas du flush lui-même : flush immédiat.
6. **Échap — abandon de phase** : `pendingCommands` jeté sans commit, preview annulée par
   reconstruction depuis le document inchangé. Mécanisme : événement machine `PHASE_ABORT` →
   `sceneReverted` → le pont `scenePlayer` fait `rebuild(scene)` inconditionnel + `reattachSelection`
   (étape A). **Point d'ordonnancement critique** : `AppLayout.tsx` écoute déjà `Escape` sur
   `document` (phase de bulles) et envoie `CLEAR_SELECTION` pour désélectionner — sans précaution,
   ce `CLEAR_SELECTION` déclenche le signal 1 et **commit** le patch en attente, l'inverse du contrat
   (« abandon, jamais de commit »). L'écouteur d'abandon de `decor-editor-bridge.ts` doit donc être
   posé en **phase de capture** sur `document` (jamais `window`/bulle, qui s'exécuterait après),
   pour vider `pendingCommands` avant que le `CLEAR_SELECTION` de la bulle n'atteigne le signal 1.

La sauvegarde explicite (localStorage/backend — pas encore construite) devra flusher d'abord :
contrainte à reporter au chantier sauvegarde, pas de code ici.

**Test** : vitest sur `decor-editor-bridge` (machine réelle, pont offset factice) — rafale
`onDecorChange` + fins de gestes + `change` palette → **aucun** `RUN_TRANSACTION` ; chaque signal 1-6
ci-dessus produit alors exactement un commit. Safari : resize → rotate → move enchaînés sur le même
item = zéro commit pendant la séquence, un seul `RUN_TRANSACTION` au signal de fin de phase.

**Fait, validé (2026-07-17)** — `tests/decor-editor-bridge.spec.ts` (9 tests, tous les signaux 1/3/4/
5/6, plus la garde geste-actif et la séquence composite resize→rotate→move = 1 seul commit — vérifié
via `countSceneCommits`, un compteur de changements de référence `context.scene`). Safari : drag →
Échap = position revenue à la ligne de base + aucune sélection (abandon confirmé, AUCUN commit) ;
drag → clic hors CS = position conservée (commit confirmé) — les deux scénarios rejoués côte à côte
pour vérifier le contraste exact. Le signal 6 a nécessité un dispatch de vrai `KeyboardEvent`
(`document.dispatchEvent`), pas un `PHASE_ABORT` envoyé directement à la machine — `abortPhase()`
(qui vide `pendingCommands`) vit dans le listener local, pas dans la réaction à l'event machine.

## Étape C — retirer les props intouchées de l'écart offset

Chaîne actuelle : `LibreAdapter.onApplied()` → `offsetBridge.notifyNow()` → `readActivePose()`
(pose **complète**) → `onValues` → `offsetValuesPxToPatch` → `applyPatch({offset})` — un simple move
fige `width`/`height` en cqw sur un item dimensionné par sa grille. Correction :

- `LibreAdapter.onApplied` porte déjà `change.kind` (`move`/`resize`/`rotate`/`scale`, chaque `apply*`
  le renseignait déjà) — aucune signature à étendre, seulement à **propager** : `scene-player-bridge.ts`
  l'ignorait (`onApplied: () => offsetBridge.notifyNow()`), corrigé en
  `onApplied: (change) => offsetBridge.notifyNow(change.kind)`.
- Le pont offset (`offset-editor-bridge.ts`) accumule l'ensemble des composants manipulés dans un
  `Set<OffsetGestureKind>`, vidé à chaque `rebind` (le rebind suit désormais chaque rebuild — étape A
  — donc chaque phase committée repart à vide).
- `notifyNow(kind)` (désormais un paramètre requis, pas optionnel) ajoute `kind` à l'ensemble, calcule
  la pose complète comme avant, puis `restrictToManipulated` ne laisse passer que les champs des
  composants accumulés. Mapping : `move → translate`, `resize → width/height`, `rotate → rotate`,
  `scale → scale`.
- Fusion par champ de `patch.offset` dans l'écart : **déjà correcte**, rien à ajuster —
  `offset` fait partie de `STRUCTURED_GROUPS` (`decor-patch-groups.ts`), `mergePatch` (`merge.ts`)
  fait déjà `{ ...baseGroup, ...additionGroup }` pour ces groupes. Un `addition.offset` sans
  `width`/`height` laisse déjà le `base.offset` existant intact.
- `apply(patch)` (sens champs → geste) accepte déjà le partiel — inchangé.

**Test** : `tests/offset-editor-bridge.spec.ts` (6 tests, unitaires sur `createOffsetEditorBridge`
directement — plus léger qu'une intégration bridge complète) : move seul → translate seul ; resize
seul → width/height seuls ; rotate/scale isolés ; move+resize dans la même phase → accumulation ;
`rebind` repart à zéro ; `rebind(null)` n'émet rien.

**Fait, validé (2026-07-17)** — vitest vert, et confirmé en conditions réelles (Safari, log temporaire
inspectant `scene.decors` avant/après un move seul suivi d'un commit par clic hors CS) :
`decor.offset` ne contenait que `{translate: {x, y}}`, sans `width`/`height`/`rotate`/`scale` — log de
vérification retiré après confirmation.

---

## Ce qui ne bouge pas

- L'émission continue de dedit (spec dedit §4.3) — jamais de debounce dans le domaine.
- La preview live (LibreAdapter pour les gestes, `mount.ts` pour la palette).
- Le rebuild complet destroy+remount (décision actée et mesurée) et son ordonnancement chantier 2
  (jamais pendant un geste actif).
- `packages/codplay` — non touché (contrainte reconduite).
- Le chemin de commit unique par dedit (plan de réconciliation, étapes A-C déjà en place).

## Hors périmètre — noté, pas traité ici

- **Contrat `subscribeToNode` côté codplay** : notifier à l'attache réelle (replay de move,
  `appendNodeToParent`), pas seulement à la création du node — chantier codplay séparé. Une fois fait,
  l'optimisation « la session suit le node remonté » redeviendra légale et pourra être réévaluée —
  pas avant.
- Click-to-select canvas : le listener « clic hors CS » de l'étape B.2 est son futur point d'entrée.
- Le flush avant sauvegarde explicite (chantier sauvegarde).

## Notes documentaires (à porter en marge, même chantier)

- `2026-07-12-app-controller-definition.md` §4.3 : « fin de geste franche » = fin de salve (signal
  d'activité de la phase) ; le commit a lieu en fin de phase (§6 de `2026-07-16-gesture-rebuild-
  ordering-plan.md`, arbitrage 2026-07-17).
- `2026-07-16-position-bridge-reconciliation-plan.md` §Étape D : la cadence « flush 250 ms » est
  remplacée par la fin de phase réelle (ce plan).

## Ordre d'exécution

A (corrige le symptôme immédiat) → B (le commit de fin de phase déclenche un rebuild qui doit
ré-attacher, dépend de A) → C (indépendante de B, s'appuie sur le rebind par rebuild de A). Chaque
étape validée (vitest + Safari) avant la suivante.

## Definition of done — tout coché (2026-07-17)

- [x] Créer un item, le manipuler, enchaîner les gestes : le cadre de sélection ne disparaît jamais ;
  après chaque commit il reste visible et manipulable. *(Safari, trois drags enchaînés, étape A.)*
- [x] Aucun `RUN_TRANSACTION` issu de dedit tant qu'aucun signal de fin de phase (sélection, clic hors
  CS, seek, mutation externe, inactivité longue) n'est survenu ; Échap abandonne sans commit et
  restaure l'état du document. *(`decor-editor-bridge.spec.ts` signaux 1/3/4/5/6 ; Safari Échap
  vs. clic-hors-CS côte à côte.)*
- [x] Une séquence resize → rotate → move = un seul commit, en fin de phase. *(`decor-editor-
  bridge.spec.ts`, `countSceneCommits() === 1`.)*
- [x] Un move seul ne fige ni `width`/`height` ni `rotate`/`scale` dans le document.
  *(`offset-editor-bridge.spec.ts` ; confirmé en Safari sur `scene.decors`.)*
- [x] Tests vitest des étapes B et C écrits et verts ; protocole Safari de l'étape A rejoué et
  confirmé. *(30 fichiers/422 tests dans `packages/editor`, zéro régression ; `tsc --noEmit` propre.)*

## Écart au plan initial — corrigé en cours d'exécution

L'étape B avait initialement prévu de construire un listener « clic hors CS » dans
`scene-player-bridge.ts` (§B.2). En l'implémentant, découverte que ce mécanisme existait déjà,
correctement câblé, dans `AppLayout.tsx::useClearSelectionShortcuts` (`mousedown` + `Escape` →
`CLEAR_SELECTION`, depuis `2026-07-16-rebuild-ordering-execution-plan.md` §4.2) — écouteur redondant
retiré avant de committer. Cette découverte a aussi révélé un vrai risque d'ordonnancement (Échap
aurait committé au lieu d'abandonner, cf. §B.6) — corrigé en posant l'écouteur d'abandon en phase de
capture. Rappelé ici en application directe de [[feedback-preserve-validated-acquis]] : chercher le
code existant avant d'en écrire, y compris à mi-chantier.

## Complément — deux gaps signalés après la clôture initiale (même jour)

### Resize / scroll du CS

Signalé : en redimensionnant la fenêtre de l'app, le cadre de sélection ne suit pas l'item (le scroll
ferait pareil). Diagnostic : `SelectionFrameHandle.sync()` existe précisément pour ça
(`positionCs()` recalculé depuis `getBoundingClientRect()`), mais n'était câblé que dans les démos
autonomes du module (`selection-frame-demo.ts`, `selection-frame-grid-demo.ts` :
`window.addEventListener('resize', () => frame.sync())` +
`document.addEventListener('scroll', () => frame.sync(), {capture:true, passive:true})`) — jamais
dans `scene-player-bridge.ts`, l'intégration réelle d'ed2. Le `ResizeObserver` interne du module
n'observe que le node de l'item lui-même (ses changements de taille propre), ni un resize fenêtre ni
un scroll d'ancêtre. **Corrigé** : les deux mêmes listeners posés dans `scene-player-bridge.ts`,
nettoyés au `destroy()`. Vitest + `tsc` verts, pas de protocole Safari dédié (mécanique triviale,
même pattern que les démos déjà éprouvées).

### Preview décor jamais appliquée avant le commit — bug réel, présent depuis toujours

Signalé : « toutes les modifications doivent intervenir immédiatement, comme les positions » — un
changement de fond (couleur) ne s'affichait qu'après le délai d'inactivité (§Étape B.4), jamais en
direct. Vérification : c'était bien un bug de preview, pas une question de cadence de commit (les deux
hypothèses initiales explorées par question à l'auteur — ni l'une ni l'autre).

**Cause** : `mountDecorEditor` (`decor-editor/mount.ts`) abonnait `subscribeToNode` **une seule fois**,
à la construction, sur `controller.getPatches()` — mais `ensureMounted()`
(`decor-editor-bridge.ts`) appelle toujours `mountDecorEditor` **avant** `syncSelection()`/
`attachItems()`. `controller.getPatches()` est donc systématiquement vide au moment où la boucle
d'abonnement tourne : aucun abonnement n'est jamais posé pour l'item réellement sélectionné,
`nodesByItemId` ne le contient jamais, `applyToAllAttachedNodes()` ne s'applique donc jamais à rien.
La couleur ne devenait visible qu'au commit+rebuild suivant, qui repeint depuis le document — pas un
effet de bord des étapes A-C, un bug structurel présent depuis la toute première version de ce
fichier. Les tests existants (`tests/decor-editor/mount.spec.ts`) ne l'avaient jamais détecté car leur
fixture (`minimalController()`) attache l'item **avant** de construire `mountDecorEditor` — l'ordre
inverse de la production.

**Corrigé** : `syncNodeSubscriptions()` (nouvelle fonction) réconcilie les abonnements avec le jeu
COURANT d'items attachés, appelée à la construction ET à chaque changement du contrôleur (symétrique
de ce que `selection-frame.ts` fait déjà pour le cadre). Un nouveau test de non-régression
(`tests/decor-editor/mount.spec.ts`, « previews decor on an item attached AFTER mount (production
order) ») reproduit l'ordre réel — vérifié qu'il échoue contre l'ancien code (`git stash` temporaire)
avant de confirmer qu'il passe avec le correctif. Le fake `subscribeToNode` du fichier de test a dû
être corrigé au passage : il n'implémentait pas le contrat « appel immédiat » du vrai
`AuthorApi.subscribeToNode`, ce qui aurait fait échouer le nouveau test pour la mauvaise raison.

**Validé en Safari** : `input` sur le champ couleur → `getComputedStyle(item).backgroundColor` change
de `rgba(0,0,0,0)` à la couleur choisie **dans le même tick synchrone** (aucune attente) ; la valeur
persiste ensuite correctement au commit différé (~4,5 s plus tard). Zéro erreur console.

### Clic direct sur l'item → sélection (réciproque du clic hors CS)

Demandé après le complément ci-dessus : cliquer *dans* l'item doit sélectionner son CS, symétrique
du clic hors CS qui désélectionne déjà. C'est exactement le gap documenté par la mémoire projet
`project-canvas-click-to-select-gap` — la pièce manquante était la résolution DOM node → persoId,
pas la logique de sélection elle-même.

**Corrigé** : `AppLayout.tsx::useClearSelectionShortcuts` — même écouteur `mousedown` que le clic
hors CS (pas un second câblage indépendant, conforme à la mémoire). Nouvelle fonction
`resolveClickedItemId(target, scene)` : `target.closest('[id]')` remonte au node racine le plus
proche portant un `id` — `base-component.ts` (codplay) pose systématiquement `id = perso.id` sur la
racine de tout composant, ed2 ne fournit jamais d'`id` authored qui primerait dessus — puis vérifie
que cet id appartient à `scene.items` (exclut la capsule racine implicite, dont le node porte aussi
un `id` mais qui n'est jamais un item du document). Si résolu : `SELECT_ITEM`, sinon comportement
inchangé (`CLEAR_SELECTION` si une sélection existe). Simple clic seulement — le cycle alt-clic/
multi-sélection déjà présent dans `selection-frame` (`onAltClickCycle`) reste hors périmètre, pas
demandé.

**Validé en Safari** : clic direct sur le node d'un item non sélectionné → `[data-selection-frame]`
apparaît dessus immédiatement ; clic sur un second item → la sélection bascule dessus.

### Panneau dedit qui se réinitialise sur « Forme » après chaque modification

Signalé : la présentation (onglet actif de la palette) doit rester stable, seul un geste utilisateur
peut la changer — or elle revenait systématiquement à « Forme » après une modification, quel que soit
l'onglet où l'utilisateur se trouvait.

**Cause** : `decor-editor/machine.ts`, transition `ITEMS.ATTACH` (état `active`) — réinitialisait
inconditionnellement `activePanelId`/`visualPosition`/`zoneMode` à chaque réception, y compris quand
c'est le MÊME ensemble d'items qui se réattache. Or `decor-editor-bridge.ts::syncSelection` appelle
`controller.attachItems(...)` à **chaque** `sceneCommitted` — pas seulement aux changements de
sélection — pour rafraîchir les données de l'item depuis le document ; chaque commit (donc chaque
modification, avec la cadence de fin de phase de l'étape B) écrasait donc la présentation. Bug distinct
des étapes A-C, pas introduit par elles — révélé par leur usage plus fiable de `syncSelection`.

**Corrigé** : `sameItemIdSet(previous, next)` compare l'ensemble des `itemId` (pas leur ordre) entre
l'ancien et le nouveau `ITEMS.ATTACH` — si identique, `activePanelId`/`visualPosition`/`zoneMode`
sont préservés ; sinon (sélection réellement différente), réinitialisés comme avant. Un test existant
(`decor-editor-machine.spec.ts`) attestait justement l'ancien comportement bogué (son commentaire
disait « ré-attache (nouvel item) » mais réattachait en réalité le même `item-1`) — corrigé et scindé
en deux cas explicites : sélection différente (réinitialise) vs. même sélection (préserve).

**Validé en Safari** : basculer sur l'onglet « Typo », faire un drag (commit différé ~4,5 s) → l'onglet
reste sur « Typo » pendant et après le commit ; sélectionner ensuite un AUTRE item → l'onglet revient
bien sur « Forme » (comportement attendu pour un changement de sélection réel).

30 fichiers / 423 tests dans `packages/editor` (423 = 422 + le nouveau test de non-régression),
`tsc --noEmit` propre.
