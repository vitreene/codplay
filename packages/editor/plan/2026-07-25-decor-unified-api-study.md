# ed2 — Decor comme canal unique : constat de l'existant

**Statut : constat de l'existant (ce que fait le code aujourd'hui), pas un cahier des charges.** Un
cahier des charges décrira ce qu'on veut obtenir ; un plan, comment y arriver ; une spec, les règles
de référence que l'implémentation en aura dégagées — ce document reste en amont des trois, il ne fait
que fixer précisément le point de départ. Priorité fixée par l'auteur
(2026-07-25) sur ce chantier, au-dessus de `2026-07-25-keyframe-insertion-interpolated-capture-plan.md`
(mis en pause, voir note en tête de ce fichier). Ce chantier a déjà fait l'objet de plusieurs demandes
d'intervention (2026-07-16 côté écriture, 07-17/07-18 cascade, cette session côté lecture live) sans
jamais être résolu correctement — repart à neuf, sur la base d'un cahier des charges précis plutôt que
d'un rafistolage supplémentaire.

**Relève au 2026-09-04** — le constat ci-dessous décrit l’état du 2026-07-25 et
reste une trace d’analyse. Pour l’état normatif et l’implémentation actuelle de la
projection du décor interpolé, se reporter à la section P2-D du [plan V2 de
l’éditeur de mouvement](./2026-09-02-motion-editor-v2-plan.md) et à la
[spécification dedit](./2026-07-07-dedit-spec.md).

## 0. Définition de Décor (redonnée par l'auteur, 2026-07-25 — fait foi)

- Un décor regroupe **tout ce qui peut toucher l'aspect d'un item et qui peut bouger dans le temps**
  (le critère est la mutabilité temporelle de l'apparence, pas la nature technique du champ).
- Les modules qui manipulent un décor adressent **directement ou indirectement** le style/les
  attributs de l'item.
- Certaines valeurs sont **méta** — ex. une attribution de position se traduit par une classe CSS dans
  la grille du parent (`zoneId`) : pas une propriété de style directe, mais un renvoi qui en produit.
- Les **modalités d'application** peuvent différer (en particulier les modules qui passent par le CS
  pour manipuler le style en direct) — mais la **finalité est identique**, et l'inscription
  (écriture) comme la lecture du décor doivent transiter par **un canal unifié**, auquel le reste de
  l'app s'adresse — jamais un module qui invente son propre aller-retour.
- Le système d'héritage/cascade (§07-17/07-18) n'est PAS remis en cause — hors périmètre de cette
  reprise.
- **Diagnostic de l'auteur sur la cause racine** : la construction des modules CS (canvas/pose),
  **séparément** de Décor, a introduit une rupture de continuité architecturale — jamais résolue
  proprement malgré plusieurs tentatives. Confirmé en code, voir §2.2.

## 0bis. Décision actée — donnée keyframe-varying vs donnée stable pour la vie de l'item

**Décidé avec l'auteur, 2026-07-25 — convention actuelle, pourrait évoluer plus tard, mais ne doit
pas être rouverte sans raison nouvelle.** Point à relire ici avant de refaire cette discussion.

**La distinction** : le critère de §0 (« ce qui bouge dans le temps ») sépare deux natures de données,
pas une seule :

- **Keyframe-varying** — une valeur qui peut différer d'un keyframe à l'autre pour un même item
  (`style`, `offset`, `zoneId` — l'usage d'une zone par un enfant). Relève pleinement du canal
  Decor : cascade/héritage, décor temporaire interpolé, écriture via `DecorLiveSession` (plan
  `2026-07-25-decor-unified-channel-plan.md`).
- **Stable pour la vie de l'item** — une valeur définie **une seule fois**, jamais par keyframe.
  Deux façons différentes d'être consultée ensuite, à ne pas confondre :
  - **Référencée directement, hors de toute cascade** — `Content` (texte/média/waveform), la
    **définition** des zones d'une capsule (son gabarit de placement). Rien n'en hérite, rien ne
    l'arbitre entre keyframes. **Précision de l'auteur (2026-07-25, déjà spécifiée dans
    `2026-07-07-dedit-spec.md` §3.4)** : « stable pour la vie de l'item » ne veut pas dire une seule
    valeur figée pour toujours — une définition de zone peut varier selon un axe NON temporel
    (contexte d'orientation aujourd'hui, potentiellement d'autres règles type media plus tard) :
    `ZoneDef` a une forme partagée (`{ coords }`, un seul jeu de coordonnées pour tout contexte) et
    une forme explicite par contexte (`{ contexts: Record<OrientationContext, coords> }`), avec
    bascule automatique de l'une à l'autre dès qu'une modification touche un seul contexte (la forme
    partagée est alors copiée comme base des deux, §3.4). Cette variation reste hors du canal
    keyframe/session (§2/§3) — ce n'est pas une variation dans LE TEMPS, donc aucune cascade ni
    session n'est nécessaire pour l'arbitrer ; c'est un mécanisme de repli propre, déjà spécifié,
    distinct de celui des keyframes.
  - **Consultée comme base fixe DE la cascade** — le **preset** (« un preset de base, accessible à
    tout moment dans la vie de l'item ») : assigné une seule fois (`assignType`,
    `2026-07-17-decor-keyframe-layering-plan.md` §1/§2), mais reste la couche `défauts` que CHAQUE
    keyframe continue d'hériter (`resolveDecor(defaults, patches)`, spec dedit §3.1 :
    `défauts ⊕ écart(kf1) ⊕ … ⊕ écart(kfn)`) — consultée en permanence, jamais elle-même arbitrée
    entre plusieurs valeurs concurrentes.

  Dans les deux cas : **aucune des deux ne varie elle-même par keyframe**, donc aucune des deux
  n'a besoin du canal keyframe/session (§2/§3 du plan) pour SA PROPRE écriture — la différence entre
  elles est seulement dans quel autre mécanisme la consulte ensuite (rien, ou la cascade en tant que
  base).

**Pourquoi ça ne relève pas du même canal** : le canal keyframe/cascade/session (§2/§3 du plan) existe
pour résoudre un problème précis — plusieurs valeurs successives dans le temps, dont il faut retenir
laquelle s'applique à quel instant, avec héritage entre elles. Une donnée qui n'a qu'UNE seule valeur
pour toute la vie de l'item ne pose jamais ce problème pour SA PROPRE écriture — lui appliquer la
machinerie de session ajouterait de la complexité sans résoudre quoi que ce soit de réel. Qu'elle
serve ensuite de base à la cascade (preset) ou soit lue directement (Content, définition de zones)
est un détail de consommation, pas une raison de lui donner un canal d'écriture keyframe-varying.

**Ce qui reste unifié malgré tout** : le **point d'entrée pour l'auteur reste toujours l'UI décor**
(dedit) — jamais une UI séparée pour Content ou pour la définition de zones. L'unification se fait
au niveau de l'expérience d'édition (un seul endroit où l'auteur touche à l'apparence/au contenu d'un
item), pas nécessairement au niveau du canal de données — les deux natures de données peuvent vivre
différemment en interne tout en étant éditées au même endroit.

**Statut** : convenu ainsi maintenant. **Ce n'est pas hypothétique pour `Content`** : un chantier sur
la définition des items texte viendra après ces sessions (réflexions déjà produites par ailleurs) et
reposera explicitement la question du contenu dynamique — susceptible de faire basculer tout ou
partie de `Content` vers keyframe-varying. Conséquence pour ce chantier-ci : le dispositif « stable
pour la vie de l'item vs keyframe-varying » doit rester assez souple pour accueillir ce changement
sans réécriture — ne pas coder l'exclusion de `Content` du canal §2/§3 de façon rigide/définitive,
garder la frontière entre les deux catégories facile à déplacer plutôt que figée en dur. Cette section
devra être révisée explicitement quand ce chantier arrivera — pas silencieusement contournée avant.

## 1. Périmètre couvert par ce constat

Six séquences actuelles, chacune tracée précisément (fichier, fonction, ordre d'appel) — base de
vérité avant toute refonte :

1. Édition d'un champ non-offset (palette : couleur, bordure, police, CSS libre…)
2. Édition d'`offset` via le CS (geste canvas : déplacer/redimensionner/tourner/étirer)
3. Lecture pour affichage — keyframe réel sélectionné (cascade)
4. Lecture pour affichage — décor temporaire (entre deux keyframes, `between`)
5. Insertion d'un keyframe
6. Reconstruction au build (`scene-player-bridge.ts::rebuild` → `codplay`)

## 2. Séquence par séquence

### 2.1 Édition d'un champ non-offset (ex. couleur de fond)

1. `decor-editor/render.ts` — l'auteur modifie un champ de palette → `controller.applyPatch({ style: { 'background-color': ... } })`.
2. `controller.ts::applyPatch` (ligne 206) — `send({ type: 'PATCH.APPLY', patch })` (état XState local du contrôleur dedit) puis `emitDecorChange()`.
3. `decor-editor-bridge.ts::unsubscribeDecorChange` (`controller.onDecorChange`, ligne 416) reçoit `entries` → résout `target` (`resolveTarget`) → si `writeDecorId` partagé (`isDecorSharedByAnotherKeyframe`), fork (`registerDecor`+`assignKeyframeDecor`) → `patchToDecorArgs(entry.patch, scene)` → commande `setDecor`.
4. Commandes accumulées dans `pendingCommands`, flush différé (`armIdleFlush`) → `machine.send({ type: 'RUN_TRANSACTION', commands })`.
5. `controller-machine.ts` applique la transaction → `scene.decors[decorId]` mis à jour → émet `sceneCommitted`.
6. `scene-player-bridge.ts` (`unsubscribeCommitted`) déclenche `rebuild(scene)` → voir §2.6.

### 2.2 Édition d'`offset` via le CS — chemin PARALLÈLE, confirmé en code

1. Geste souris sur le cadre CS → `LibreAdapter.applyMove/applyResize/applyRotate/applyScale`
   (`packages/authoring/selection-frame`) — écrit la pose **directement** via `AuthorApi.setNodePose`
   (anime.js), **jamais** via `controller.applyPatch`/`setDecor` à ce stade (retour visuel temps réel,
   pas de round-trip document).
2. `LibreAdapter.onApplied` → `offsetBridge.notifyNow(kind)` (`decor-editor-bridge.ts:202`) →
   `offsetEditorBridge.ts::notifyNow` → `readActivePose()` (lit `authorApi.getNodePose`, **pas**
   `getNodeSnapshot` — API distincte) → notifie les `valueListeners`.
3. `controller.ts::syncOffsetBridge` (ligne 152) — `offsetBridge.onValues(values => this.applyPatch({ offset: ... }))` — **ici seulement** les deux mondes se rejoignent : la valeur lue via `getNodePose` entre dans le même `applyPatch`/`emitDecorChange` que §2.1.
4. `LibreAdapter.onCommit` (fin de geste) → `offsetBridge.commitNow(kind)` → `decor-editor-bridge.ts:355` (`offsetBridge.onCommit`) → arme le flush de phase.
5. Suite identique à §2.1 étapes 3-6 (`onDecorChange` → `setDecor` → `RUN_TRANSACTION` → rebuild).

**Constat précis** : le POINT DE JONCTION (`controller.applyPatch`, étape 3) est unique et correct —
mais tout ce qui précède (lecture de la valeur courante, écriture visuelle en temps réel) passe par un
système ENTIÈREMENT séparé (`LibreAdapter`/`AuthorApi.getNodePose`/`setNodePose`), avec son propre
protocole de notification (`onValues`/`onCommit`/`notifyNow`), sans rapport avec `getNodeSnapshot`
(utilisé pour le style) ni avec aucune notion de « Decor » — c'est exactement la rupture nommée par
l'auteur : le CS a été bâti comme un système autonome, raccordé après coup par des callbacks, jamais
comme un client d'un canal Decor unique.

**Mise à jour (implémenté, `2026-07-25-decor-unified-channel-plan.md` §A)** : `notifyNow`/`commitNow`
alimentent en plus une `DecorLiveSession` (`decor-editor/decor-live-session.ts`) — lue par §2.4
ci-dessous, PAS encore par l'écriture. Une tentative de faire écrire cette session à `committing` (en
plus de l'étape 3 ci-dessus) a été codée puis retirée : `onCommit` n'a jamais été qu'un déclencheur du
flush d'un `pendingCommands` déjà préparé par l'étape 3 — jamais une écriture indépendante — ajouter un
second chemin créait un risque de double-fork sur décor partagé (6 tests cassés, corrigé en retirant
l'ajout). L'étape 3 reste donc l'unique écrivain d'offset.

### 2.3 Lecture — keyframe réel sélectionné (cascade)

`decor-editor-bridge.ts::syncSelection` (ligne 369) → `resolveTarget` → `target.keyframeId` défini →
`resolveEffectiveKeyframePatch(scene, item, keyframeId, content)` (ligne 197) : cascade
`initial ⊕ keyframes précédents ⊕ soi-même`, chaque maillon passé dans `resolveCurrentPatch` (ligne
161 — champs couverts : `style`, `classes`, `offset`, `custom`, `zoneId`, `text`, `textAutoSize`) puis
fusionné (`mergePatch`). Résultat → `controller.attachItems([{ patch, isTemporary: false, ... }])`.

### 2.4 Lecture — décor temporaire (`between`)

Même point d'entrée (`syncSelection`), `target.isTemporary === true` :
`base = resolveEffectiveKeyframePatch(..., alignment.prevKeyframeId, ...)` (cascade complète, comme
§2.3) ⊕ `liveStyle = resolveTemporaryPatch(authorApi, itemId, styleFieldsForItemType(...), referenceWidthPx)`
(`authorApi.getNodeSnapshot`, champs `style.*` de la palette) ⊕ `liveOffset =
resolveTemporaryOffset(authorApi, itemId, referenceWidthPx)` (`authorApi.getNodePose`, **fermé cette
session** — auparavant absent, `offset` retombait sur `base` sans jamais s'interpoler). `patch =
mergePatch(mergePatch(base, liveStyle), liveOffset)`. Aucune écriture possible dans cet état
(`onDecorChange` : refuse et avertit, « pose un keyframe pour committer ») — inchangé.

### 2.5 Insertion d'un keyframe

`sequence-editor/machine.ts::'KEYFRAME.ADD'` (ligne 443) → `adjacentDecorId(item.keyframes, timeMs)`
(ligne 281 — retourne le `decorId` du keyframe voisin le plus proche, ou `undefined` si aucun) →
`createNamedKeyframe` (commande) → si `decorId` fourni, le nouveau keyframe **partage la référence**
(§07-17 spec, aucune lecture de §2.4 consultée) ; sinon décor vide neuf. **Aucune connexion** avec le
décor temporaire déjà résolu par §2.4 pour ce même instant — l'information qu'affichait dedit une
seconde avant l'insertion (si `isTemporary` avec un `patch` non-vide) est perdue.

### 2.6 Reconstruction au build

`scene-player-bridge.ts::rebuild(scene)` (ligne 103) → `buildSceneDoc(scene)`
(`packages/editor/src/builder/build-scene.ts`) → pour chaque item/keyframe,
`resolveKeyframeCascadeStyle` (ligne 262 — cascade similaire à §2.3 mais RÉ-IMPLÉMENTÉE
indépendamment) → `resolveDecorStyle` (ligne 741 — champs couverts : `style`, `offset` (via
`resolveOffsetAsStyle`), `custom` — **pas** `classes` ni `zoneId`) → `computeStyleDiff` entre
keyframes consécutifs → événements d'interpolation → `studio.load(sceneDoc)` (`codplay`) →
`player.seek({ timelineMs: lastSeekMs + preRollMs })` pour repositionner.

## 3. Synthèse — où le canal se rompt exactement

| Séquence | Lecture live (décor temporaire) | Cascade | Écriture |
|---|---|---|---|
| §2.1 style | `getNodeSnapshot` | `resolveCurrentPatch`/`resolveEffectiveKeyframePatch` | `patchToDecorArgs`→`setDecor` |
| §2.2 offset | `getNodePose` — **fermé §2.4**, mais production toujours via un système séparé (`LibreAdapter`) | même cascade que style | rejoint `patchToDecorArgs` seulement APRÈS `applyPatch` — pas avant (inchangé, tranché comme correct, voir §2.2) |
| §2.6 build | — | `resolveKeyframeCascadeStyle`/`resolveDecorStyle` (**3ᵉ implémentation** de la cascade, indépendante de §2.3) | — |

**Ce qui a changé (§2.2/§2.4)** : le trou de lecture live pour offset est fermé. **Ce qui reste** :
trois implémentations indépendantes de la cascade (§2.3/§2.4's `resolveEffectiveKeyframePatch`, §2.6's
`resolveKeyframeCascadeStyle`), le système de production CS (`LibreAdapter`) toujours séparé de la
notion de Decor (mais son unique point de jonction avec l'écriture, lui, est correct et ne doit pas
être dupliqué — §2.2).

## 3bis. Vérification de complétude — autres parties ignorées ?

Recherche systématique de tout ce qui, en plus de §2.2 (CS/offset), pourrait toucher l'apparence d'un
item par un canal séparé.

**Dans le périmètre du chantier — confirmé par l'auteur, pas un risque différé** — `zone-editor.ts` et
`multi-selection-frame.ts` (`packages/authoring/selection-frame/src/`) ne sont pas câblés dans
`packages/editor/src` aujourd'hui, mais font partie intégrante du problème à résoudre, pas d'un futur
hypothétique à surveiller. Caractérisés précisément :

- **`zone-editor.ts`** (`createZoneEditor`, ~980 lignes) — possède son PROPRE modèle d'état complet
  (`ZoneEditorState`/`ZoneDef` : grille rows/cols, spans, containers/enfants), son propre chemin
  d'écriture (`applyState` → `options.onZonesChange(state)`), entièrement DÉCONNECTÉ de `Decor` — ne
  touche jamais `scene.decors`/`DecorPatch`. Une rupture plus profonde que le CS/offset (§2.2) : là où
  offset finit par rejoindre `applyPatch` après le geste, zone-editor ne rejoint RIEN de `Decor` — son
  `onZonesChange` n'est même pas branché à ce jour. Le champ `Decor.zoneId` existant
  (`resolveCurrentPatch`, simple référence + lookup de nom) et le modèle riche de `zone-editor.ts`
  (placement en grille complet) sont probablement deux représentations d'un même concept jamais
  réconciliées — à trancher explicitement dans le cahier des charges, pas supposé ici.
- **`multi-selection-frame.ts`** (`createMultiSelectionFrame`) — réutilise le MÊME `CsValueAdapter`
  par item que le CS single-item (§2.2), diffusant le même delta de geste à N adaptateurs. Même
  catégorie de rupture que §2.2, simplement démultipliée sur plusieurs items — pas un nouveau défaut,
  une aggravation du même.

**Vérifié, PAS le même défaut** — l'application de preset (`controller.ts::applyPreset`) et de carte
(`applyCard`), et l'écriture du panneau CSS libre (`render.ts::renderCustomCodePanel`) passent tous
par `emitDecorChange()`, le même canal que §2.1 — pas de chemin d'écriture séparé pour ces trois-là.
Seule leur LECTURE live reste concernée par le trou déjà noté (`custom` absent de
`styleFieldsForItemType`, donc absent de `resolveTemporaryPatch`).

**Confirmé hors périmètre (arbitrage de l'auteur, 2026-07-25)** — `Keyframe.transitionIn`/
`transitionOut` (`app/commands/types.ts`) : pour qu'ils se comportent comme une valeur de décor qui
« bouge dans le temps » au sens du §0, il faudrait pouvoir créer deux keyframes très rapprochés en
entrée ou sortie de l'item — or on ne peut pas créer de keyframe en dehors des bornes intro/outro, ce
cas ne se présente donc jamais en pratique. Laissés explicitement en dehors du champ pour ce chantier.

**Confirmé hors périmètre (arbitrage de l'auteur, 2026-07-25)** — mises à jour de `Content` : donnée
stable pour la vie de l'item (§0bis), pas keyframe-varying — `codplay` (runtime) admet déjà des mises
à jour de contenu, mais l'éditeur ne les prévoit pas encore à l'authoring ; `Decor` n'est pas concerné
par ce sujet à ce stade. Confirmé qu'aucun module actuel de `packages/editor/src` n'a de chemin de
lecture/écriture parallèle pour `Content` (seul `DemoMenuRegion.tsx` appelle `setDecor` directement,
pour amorcer une scène de démo, pas un module d'édition).

**Conclusion de cette vérification** : le périmètre du chantier couvre §2.1 (style), §2.2 (offset/CS),
`zone-editor.ts` et `multi-selection-frame.ts` — quatre modules à faire tenir dans le même canal, pas
seulement les deux déjà actifs. Transitions et mises à jour de contenu en sont explicitement exclues
(arbitrages ci-dessus). §2.6 (build) reste concerné comme client du futur canal, pas comme module à
« corriger » au même titre que les quatre précédents.

## 4. Prochaine étape

Ce document reste le constat de référence — pas encore un cahier des charges. Prochaine étape :
formuler le cahier des charges (ce qu'on veut obtenir du canal unique), sur la base des QUATRE modules
recensés en §3bis (style, offset/CS, zones, multi-sélection), avant d'en tirer un plan.

---

**Plan en pause** : `2026-07-25-keyframe-insertion-interpolated-capture-plan.md` — dépend directement
de ce chantier (l'insertion de kf, §2.5, doit consulter le futur canal unique) ; repris seulement
après que ce cahier des charges soit validé et qu'une direction de refonte soit tranchée.
