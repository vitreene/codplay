# ed2 — Pont position dedit + généralisation de la session de phase

> **Document historique, supersédé.** Les actions de ce plan reposaient sur le
> pont de pose V1 et ne sont plus à exécuter. Le circuit retenu est décrit dans
> [`../2026-09-01-editor-v2-organization-plan.md`](../2026-09-01-editor-v2-organization-plan.md) :
> `decor-editor-bridge` lit `instance.snapshot`, le cadre V2 échange des px
> locaux et le commit passe par xState. Aucun pont de pose parallèle ne doit
> être recréé.

Plan précis, pas de code à ce stade. Réconcilie le travail des chantiers 1-3
(`2026-07-16-gesture-rebuild-ordering-plan.md` + sous-plans) avec le spec déjà écrit et jamais
implémenté `2026-07-07-dedit-spec.md` §6 (« Pont position — coordination avec l'éditeur visuel »).

---

## 1. Constat — deux chemins de commit indépendants, alors qu'un seul est prévu au spec

`2026-07-07-dedit-spec.md` §1.2 : *« L'éditeur visuel de position (cadre de sélection inséré dans
le player) est sous la responsabilité de dedit : dedit pilote son activation et coordonne ses
valeurs en temps réel avec ses propres champs (§6). »* Et §6 : le cadre de sélection est censé
émettre ses diffs vers dedit via un `PositionEditorBridge`, dedit fusionne dans l'écart courant et
émet `onDecorChange` — **exactement le même canal que la couleur, le curseur typo, etc.**

Ce pont n'a jamais été câblé. Résultat, constaté en direct cette session : `scene-player-bridge.ts`
construit sa propre session (`createTrackedSession`, chantiers 1-3) et commet l'offset **directement**
(`machine.send({type:'RUN_TRANSACTION', commands:[{name:'setDecor', args:{decorId, patch:{offset}}}]})`,
`scene-player-bridge.ts::persistOffset`) — en court-circuitant totalement dedit. Pendant ce temps,
`decor-editor-bridge.ts::onDecorChange` (L129-154) commet **lui aussi**, séparément, dès qu'un champ
de la palette change — sans savoir qu'un geste CS est en cours ailleurs. Son instantané interne
d'`offset` (`resolveCurrentPatch`, L40-58) n'est rafraîchi qu'à `sceneCommitted` (L156-159) : si une
saisie palette arrive **avant** que le commit du geste CS n'ait eu lieu, elle envoie un `offset` périmé
en même temps que le champ réellement modifié — bug confirmé en direct (édition de couleur pendant un
drag → position remise à zéro).

**Ce n'est pas un bug à corriger localement — c'est l'écart d'implémentation au spec qui le cause.**
Le pont §6 existe pour fermer exactement ce risque : une seule source de vérité (l'écart courant dans
dedit), un seul chemin de commit, quelle que soit l'origine du changement (geste ou champ).

### Note de nomenclature

Le spec (rédigé 2026-07-07) nomme ce module `position`/`PositionPatch`/`PositionEditorBridge`. Une
session ultérieure (mémoire `project-offset-vs-position-naming.md`) a renommé tout le code
`Position*` → `Offset*` dans `packages/editor/src/` pour réserver `position` à un futur placement en
grille — le domaine dedit actuel utilise donc déjà `offset`/`OffsetPatch` (confirmé :
`decor-editor-bridge.ts` référence `decor.offset`, pas `decor.position`). Le spec lui-même n'a pas été
mis à jour sur ce point terminologique — à corriger en marge (renommer `PositionEditorBridge` →
`OffsetEditorBridge` dans l'implémentation, et signaler la note dans le spec) sans rouvrir la question
déjà tranchée.

---

## 2. Principe de réconciliation

Dedit émet en continu, sans debounce (conforme au spec §4.3 : *« émission continue pour les contrôles
continus — curseurs, palette de couleur, gestes du pont position »*) — **aucun changement à ce
principe**, c'est la couche domaine, elle doit refléter l'état réel à tout instant. C'est l'**hôte**
(le pont `decorEditor` dans `packages/editor`) qui décide de la cadence de *commit* vers la scène —
exactement le rôle de coordinateur que l'utilisateur attribue à dedit. La session de geste
(chantiers 1-3 — `TrackedSession`, `isGestureActive()`, flush différé à la fin de phase) **devient un
mécanisme du pont décor**, généralisé à toute édition continue de l'item sélectionné (position ET
couleur ET curseur), pas seulement au CS.

```
CS (geste px)  ──┐
Couleur (input)  ─┼──▶ dedit.applyPatch (émission continue, écart complet, jamais de debounce)
Curseur (input)  ─┘         │
                             ▼
                      onDecorChange (continu)
                             │
                             ▼
         pont decorEditor : décide QUAND committer (chantier 3 généralisé)
                             │
                             ▼
              machine.send(RUN_TRANSACTION)  ── un seul chemin, une seule fois par phase
```

---

## 3. Étapes

### Étape A — Implémenter `PositionEditorBridge` (renommé `OffsetEditorBridge`)

Nouveau fichier, `packages/editor/src/app/bridges/offset-editor-bridge.ts`. Ne réimplémente **rien**
du suivi de node/geste — s'appuie entièrement sur ce que les chantiers 1-3 ont déjà construit et
testé :

- `onValues(cb)` : LibreAdapter écrit déjà en live sur le node à chaque delta
  (`applyMove`/`applyResize`/`applyRotate`/`applyScale`). Le pont lit l'état courant (même lecture que
  `readCurrentOffsetPx`, déjà écrite dans `scene-player-bridge.ts` — à déplacer ici ou partager), le
  convertit px→cqw (`pxToCqw`, déjà utilisé), appelle `cb(...)` à **chaque** notification pertinente
  — pas de debounce à ce niveau (conforme au spec).
- `apply(patch)` : chemin inverse (cqw→px), écrit sur le node via l'adaptateur — sens « champs →
  geste » du spec, jamais câblé aujourd'hui (aucune saisie dedit ne modifie encore le node).
- `activate(mode)`/`deactivate()` : bascule d'affichage du CS — mapping direct vers
  `SelectionFrameHandle.setPartActive`/`setOperationEnabled` (déjà exposés).
- `containerRefWidthPx()` : déjà dans `machine.getSnapshot().context.referenceWidthPx`.

**Tranché par l'auteur : dedit est le seul interlocuteur de l'app pour tout ce qui touche au décor
d'un item — l'offset disparaît derrière cette ombrelle, il ne doit exister nulle part comme un
troisième pont indépendant que l'app aurait à raccorder elle-même.** Concrètement :

- Le pont offset est un objet **stable et long-lived**, construit **une seule fois** par
  `scene-player-bridge.ts` (pas reconstruit à chaque sélection) et publié dans `context` exactement
  comme `authorApi` l'est déjà aujourd'hui (`PLAYER_READY`, `scene-player-bridge.ts:119`) — même
  pattern, pas un nouveau mécanisme de câblage. En interne, il se rebranche silencieusement sur la
  session/`LibreAdapter` courante à chaque changement de sélection (`attachSelection`/
  `destroySelection`) ; `onValues`/`apply` restent valides sans que dedit n'ait jamais à connaître ce
  changement de cible.
- `AppLayout.tsx`/`main.tsx` ne changent pas — `ScenePlayerRegion` et `DecorEditorRegion` restent deux
  îlots indépendants (`2026-07-13-controller-islands-bridge-plan.md`), chacun ne connaissant que
  `controller`. `decor-editor-bridge.ts` lit `context.offsetBridge` (nouveau champ, publié une fois,
  symétrique à `context.authorApi`) au lieu de le recevoir d'un câblage explicite entre bridges.
- `scene-player-bridge.ts` ne construit donc plus le pont *pour* dedit — il le **publie**, dedit le
  **consomme**. Aucune référence directe entre les deux fichiers de pont.

Construit dans `selectItem()`/`attachSelection` (`scene-player-bridge.ts`), à partir de la **même**
`TrackedSession` déjà créée pour `LibreAdapter`+`SelectionFrame` — aucune nouvelle instance de suivi.

### Étape B — Câbler le pont dans `createDecorEditor`

`decor-editor-bridge.ts` lit `context.offsetBridge` (publié une fois par `scene-player-bridge.ts`,
cf. étape A) — probablement à `ensureMounted()`/à la construction de `createDecorEditor`, avec la même
garde que `authorApi` (`ensureMounted` attend déjà `authorApi` non-null avant de monter ; `offsetBridge`
suit la même discipline). Passé à `createDecorEditor({..., offsetBridge})`.

### Étape C — Retirer le commit direct d'offset de `scene-player-bridge.ts`

`persistOffset` et son `RUN_TRANSACTION` direct (`scene-player-bridge.ts:181-198`) sont **supprimés** —
la position transite désormais par dedit comme tout le reste, via le pont de l'étape A. Le pont
`scenePlayer` redevient : rebuild/mount/seek + construction de la session partagée pour
LibreAdapter/SelectionFrame/le pont offset — plus de logique de patch/commit en propre.

### Étape D — Généraliser la session de phase à `decor-editor-bridge.ts::onDecorChange`

Le flush différé (chantier 3 : commit à la fin d'une phase de micro-gestes, pas un par micro-geste)
migre de `scene-player-bridge.ts` vers `decor-editor-bridge.ts`. Signal de phase active = union de :

- session CS (`session.isGestureActive()`, déjà exposé par la `TrackedSession` de l'étape A) ;
- un signal équivalent pour les widgets couleur/curseur — **à ajouter** : `render.ts` n'écoute
  aujourd'hui que `'input'` (continu, aucune fin de geste détectable) sur `renderColorField`/
  `renderSliderField`. Le navigateur émet déjà `'change'` une fois, à la fermeture du picker natif/au
  relâchement du curseur — à écouter en plus de `'input'` comme signal de fin de phase (symétrique de
  `<geste>_END` côté CS), sans toucher à l'émission continue de `'input'` elle-même (qui reste le canal
  de preview live, inchangé).

Un seul flush par phase, quelle que soit son origine — plus de commit séparé par outil.

---

## 3 bis. Ce comportement unifié résout-il le conflit signalé ?

Oui — et pas comme un correctif à côté du mécanisme, mais comme une **conséquence directe** de
l'architecture conforme au spec. Rejeu du scénario reproduit cette session (couleur éditée pendant un
drag CS encore en vol) avec le pont en place :

1. Le geste démarre → `LibreAdapter` écrit en live sur le node.
2. Le pont offset (étape A) relaie **en continu** (`onValues`, aucun debounce) vers
   `controller.applyPatch({offset: ...})` — l'écart interne de dedit (`item.patch.offset`) est donc
   tenu à jour **à chaque tick du geste**, pas seulement au commit.
3. La couleur est éditée *pendant* ce geste → `applyPathPatch('style.background-color', …)` fusionne
   uniquement le champ couleur — mais `emitDecorChange()` renvoie `getPatches()`, l'écart **complet**
   de l'item (§4.3 du spec), qui contient déjà l'offset **à jour** (étape 2), pas une valeur figée au
   moment de la sélection.
4. Le commit (immédiat ou différé par le flush de l'étape D) part avec un patch cohérent — plus de
   course entre deux instantanés.

La cause racine du bug n'était donc pas « il manque une garde anti-collision » mais « l'offset ne
transitait pas par la structure censée le tenir à jour en continu ». La corriger EST l'implémentation
du pont §6 — aucun mécanisme supplémentaire à inventer au-delà des étapes A-D.

---

## 4. Ce qui ne bouge pas

- Le principe d'émission continue de dedit (§4.3 du spec) — jamais de debounce dans le domaine/
  contrôleur lui-même.
- Le rendu propre à chaque widget de palette.
- Le modèle `DecorPatch`/fusion d'écart (`packages/editor/src/decor-editor/`) — inchangé, déjà
  conforme au spec.
- `packages/authoring/selection-frame` et `packages/codplay` — le pont offset consomme leur API
  publique existante (`TrackedSession`, `LibreAdapter`), n'y touche pas.

## 5. Risques / points restants

- **Ordre d'initialisation** : `decorEditor` lit `context.offsetBridge`, publié par `scenePlayer` —
  même dépendance d'ordre que `context.authorApi` aujourd'hui (`ensureMounted` de
  `decor-editor-bridge.ts` attend déjà `authorApi`, `offsetBridge` suit la même garde). Le pont offset
  lui-même reste utilisable même « à vide » (aucun item sélectionné) — il ne fait rien tant
  qu'`attachSelection` n'a pas rebranché sa cible interne.
- **`apply(patch)` (sens champs → geste)** n'a aujourd'hui aucun appelant réel (aucune saisie
  numérique dedit sur position n'existe encore dans la palette de démo, `dedit-demo.ts`) — à
  implémenter quand même (le spec l'exige) mais sans widget pour l'exercer immédiatement ; prévoir un
  test dédié plutôt qu'une validation Safari (rien à cliquer en attendant le panneau réel).
- **Renommage `position`→`offset`** dans le spec lui-même : correction de documentation, pas de
  code — à faire en marge, séparément.

## 6. Definition of done

- Plus aucun `RUN_TRANSACTION` direct pour l'offset hors de dedit — un seul chemin de commit, quelle
  que soit l'origine (geste, couleur, curseur).
- `PositionEditorBridge`/`OffsetEditorBridge` implémenté et testé (les deux sens : geste→champs déjà
  exercé par les tests existants du CS, champs→geste testé neuf).
- Un geste CS et une édition de couleur qui se chevauchent (le scénario reproduit cette session)
  produisent un seul commit final cohérent, plus de patch périmé.
- Une rafale sur le picker de couleur (plusieurs `'input'` rapprochés) ne produit plus qu'un commit à
  la fermeture/`'change'`, pas un par tick.
