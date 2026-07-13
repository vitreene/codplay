# ed2 — Pont contrôleur central ↔ îlots (Builder/Player, sequence-editor, dedit, selection-frame)

Sous-plan de l'étape 3 (`2026-07-10-app-construction-plan.md`) — le jalon « un item qui vit » lui-même. Écrit après audit direct du code (pas de suppositions) : `controller-machine.ts`, `SequenceEditorController`/`mount.ts` (422+597 lignes), `DecorEditorController`/`mount.ts`, `Player`/`createAuthorApi`/`createSelectionFrame`, `build-scene.ts` — tous lus intégralement avant d'écrire ce document.

**Décision actée (2026-07-13)** : le pont contrôleur↔îlots se fait par **acteurs enfants XState** (`invoke`), pas par simples effets React. Chaque îlot vanilla est enveloppé dans un acteur invocable par `controllerMachine`.

---

## 1. État exact du code — ce qui marche déjà, ce qui manque

### 1.1 Ce qui ne demande aucune modification

- **Modèle document unifié.** `sequence-editor/types.ts::EditorScene` est un réexport **littéral** de `app/commands/types.ts::EditorScene` (depuis `2026-07-13-sequence-editor-model-migration-plan.md`). Zéro traduction entre le document du contrôleur central et celui que `SequenceEditorController` consomme.
- **`DecorEditorController` a déjà la bonne posture.** `onDecorChange(cb: (entries: DecorChangeEntry[]) => void): Unsubscribe` (`decor-editor/controller.ts:235-238`) émet des intentions à chaque `applyPatch`/`stripInherited`/`applyPreset` (`emitDecorChange()`, lignes 154/171/178/245-249) — il ne possède jamais le document, seulement l'écart édité. `attachItems`/`detach` sont rappelables à tout moment sans recréer l'instance.
- **`Player`/`createAuthorApi`/`createSelectionFrame`** — API complète, patron de montage déjà démontré (`selection-frame-demo.ts`) : `new Player(options)` → `player.init({mountTarget, compiledScene, strapCollection})` → `createAuthorApi(player)` → `createXxxAdapter({authorApi, itemId})` → `createSelectionFrame({itemId, authorApi, sceneRoot, adapter})`.
- **`buildSceneDoc(scene) → {sceneDoc, styleSheet}`** (`builder/build-scene.ts`) — fonction pure, rejouable à volonté, aucun état interne. `BuilderFacade.compile(sceneDoc) → CompiledScene` tout aussi pur côté Codplay. `CodPlay.load({scene, mountTarget, ...})` (`creator-facade.ts`) enchaîne déjà compile→init — pont réutilisable tel quel plutôt que d'orchestrer `BuilderFacade`+`Player` séparément.

### 1.2 Le vrai trou — `SequenceEditorController` n'a pas de canal de sortie

`mountSequenceEditor` (`sequence-editor/mount.ts`, 597 lignes) appelle en interne, en réponse aux gestes DOM, les méthodes de mutation de `SequenceEditorController` directement : `ctrl.addKeyframe(...)`, `ctrl.moveMarker(...)`, `ctrl.removeKeyframe(...)`, `ctrl.toggleVisibility(...)`, etc. (recensé : `mount.ts` lignes 322, 355, 366, 395, 400, 416, 463-495, 528, 550-552). Ces appels mutent la machine XState **interne** à `SequenceEditorController` et s'arrêtent là — **aucun callback n'existe pour faire remonter l'intention** vers un appelant externe.

C'est exactement la régression que `2026-07-10-app-construction-discussion.md:64` identifie comme *devant être corrigée* (« il ne sera plus propriétaire : il reçoit le document du contrôleur et émet des intentions ») — jamais faite. `DecorEditorController` a cette forme ; `SequenceEditorController` ne l'a pas.

**Portée du patch** : ajouter un canal `onSceneChange`, symétrique à `onDecorChange`. Ni une réécriture de `machine.ts` (déjà fait, migration précédente), ni une extraction en fonctions pures façon `zone-model.ts` (option plus lourde, écartée — `SequenceEditorController` garde sa machine interne pour l'éphémère réel : viewport, drag, snap, interaction — seul le **document** devient une projection, pas toute la classe).

### 1.3 `deserialize()` est impropre à la re-synchronisation post-commit — À NE PAS RÉUTILISER

Signalé en relecture (2026-07-13) — vérifié dans le code, pas cosmétique. `deserialize()` envoie `SCENE.LOAD`, dont le handler (`machine.ts:888-897`) ne fait pas que remplacer `scene` :

```ts
'SCENE.LOAD': {
  actions: assign(({ context, event }) => ({
    scene: event.scene,
    snapGrid: computeSnapGrid(event.scene),
    virtualKeyframes: computeVirtualKeyframes(event.scene, context.displayConfig.capsuleOrder),
    playheadMs: 0,                                    // ← remet le playhead à zéro
    selection: { trackId: null, keyframeId: null, markerId: null },  // ← efface la sélection
    interaction: null,                                 // ← annule tout geste en cours
  })),
},
```

C'est le comportement **correct pour charger un nouveau document** (changer de scène — usage actuel : bouton « Charger la scène de démo », futur sélecteur multi-scènes, étape 5). C'est le comportement **destructeur** si rappelé après chaque commit de mutation (playhead reset + sélection perdue + geste annulé à chaque frappe dans dedit, à chaque `RUN_COMMAND` réussie) — **la version précédente de ce plan (§2.2 initiale) proposait exactement cet appel après chaque commit : erreur, corrigée ici.**

**Conséquence sur le patch (§2.4 ci-dessous)** : la re-synchronisation post-commit du sequence-editor a besoin d'un **second** point d'entrée, distinct de `SCENE.LOAD`/`deserialize()` — qui remplace `scene` (+ `snapGrid`/`virtualKeyframes` dérivés) SANS toucher `playheadMs`/`selection`/`interaction`. `deserialize()` reste réservé à son usage actuel (chargement d'un nouveau document, changement de scène) — jamais appelé dans la boucle de commit du pont.

### 1.4 Piège à éviter — boucle `onSceneChange` ↔ resynchronisation post-commit

Si `onSceneChange` se déclenche sur *toute* transition qui change `context.scene` par référence, alors : mutation utilisateur → `onSceneChange` → contrôleur central applique → contrôleur central rappelle le point d'entrée de resynchronisation (§2.4) → machine interne reçoit ce nouvel event → si `onSceneChange` se redéclenche dessus → boucle.

**Règle de conception** : `onSceneChange` ne se déclenche **jamais** sur l'event de resynchronisation lui-même (`SCENE.SYNC`, §2.4) ni sur `SCENE.LOAD` — seulement sur les events de mutation utilisateur (`KEYFRAME.*`, `TRACK.*`, `MARKER*.*`, `AUDIO.SET_WAVEFORM`, `SCENE.SET_DURATION`). Filtre par **type d'event reçu par la machine**, pas par comparaison de référence de `context.scene` (une comparaison de référence serait fragile — les deux events de rechargement changent aussi la référence).

---

## 2. Le patch — `SequenceEditorController.onSceneChange`

### 2.1 Mécanique interne

`this.actor.subscribe(callback)` (XState v5) ne donne accès qu'au snapshot, pas à l'event qui a causé la transition. Deux options techniques :

- **(a)** Inspecter la machine (`actor.system.inspect` ou `createActor(..., {inspect})`) pour intercepter les events avant transition.
- **(b)** Ajouter une action `assign` dans `machine.ts` qui marque un indicateur de contexte (`lastChangeSource: 'user' | 'load'`) à chaque transition pertinente, lu par le `subscribe` du contrôleur.

**Retenu : (b)**, plus simple, cohérent avec le style déjà en place dans `machine.ts` (contexte explicite plutôt que introspection XState). Ajout à `MachineContext` : `lastMutation: { source: 'user' | 'load'; at: number } | null` — `at` (timestamp) sert à dédupliquer si `subscribe` notifie plusieurs fois pour la même transition (XState ne le fait pas normalement, mais rend le filtre robuste sans dépendre de cette garantie).

- `SCENE.LOAD` → `lastMutation: { source: 'load', at: Date.now() }`.
- Toute autre action qui modifie `scene` (déjà repérées dans `machine.ts` : `KEYFRAME.ADD/REMOVE/CLEAR_TRACK/CLEAR_CAPSULE/RENAME/ASSIGN_DECOR/SET_TRANSITION_IN/SET_TRANSITION_OUT`, `TRACK.ADD/MOVE/REMOVE/TOGGLE_VISIBILITY/RESET_KEYFRAMES`, `MARKER_TRACK.*`, `MARKER.*`, `KEYFRAME.ATTACH_MARKER/DETACH_MARKER`, `AUDIO.SET_WAVEFORM`, `SCENE.SET_DURATION`, `DRAG.END` (`dragging-keyframe` state), `CLIP.DRAW_END`/`CLIP.PLACE` (`drawing-clip`/`idle` states)) → `lastMutation: { source: 'user', at: Date.now() }`.

### 2.2 API ajoutée à `SequenceEditorController`

```ts
export type Unsubscribe = () => void

onSceneChange(cb: (scene: EditorScene) => void): Unsubscribe {
  let lastSeenAt = 0
  const sub = this.actor.subscribe(s => {
    const m = s.context.lastMutation
    if (!m || m.source !== 'user' || m.at === lastSeenAt) return
    lastSeenAt = m.at
    cb(s.context.scene)
  })
  return () => sub.unsubscribe()
}
```

Émet la **scène entière** (comme `deserialize` la reçoit entière) — pas une intention typée fine comme `DecorEditorController.DecorChangeEntry`. Différence assumée : le sequence-editor mute une structure arborescente/temporelle complexe (keyframes, marqueurs, pistes) — découper chaque mutation en intention typée serait un deuxième chantier de conception (vocabulaire de commandes dédié), hors périmètre de ce patch. Le contrôleur central reçoit la scène mutée, la diff n'est pas nécessaire : il **remplace** son `context.scene` par celle reçue (même patron que `SCENE_LOADED`), l'historique (étape 4, pas encore construite) captera la granularité plus tard si besoin.

### 2.3 `SCENE.SYNC` — le point d'entrée de resynchronisation post-commit (remplace l'usage prévu de `deserialize`)

Nouvel event machine, distinct de `SCENE.LOAD` (§1.3) :

```ts
'SCENE.SYNC': {
  actions: assign(({ context, event }) => ({
    scene: event.scene,
    snapGrid: computeSnapGrid(event.scene),
    virtualKeyframes: computeVirtualKeyframes(event.scene, context.displayConfig.capsuleOrder),
    lastMutation: { source: 'load' as const, at: Date.now() },   // exclu d'onSceneChange, §1.4
    // playheadMs, selection, interaction : PAS touchés — c'est tout l'objet de ce patch
  })),
},
```

API contrôleur : `syncScene(scene: EditorScene): void { this.send({ type: 'SCENE.SYNC', scene }) }` — nom délibérément distinct de `deserialize` pour qu'aucun appelant ne les confonde. `deserialize()`/`SCENE.LOAD` restent inchangés, réservés au chargement d'un nouveau document (§1.3).

### 2.4 Fichiers touchés

| Fichier | Changement |
|---|---|
| `sequence-editor/machine.ts` | `MachineContext.lastMutation` ajouté ; chaque action de mutation recensée en §2.1 pose `lastMutation`. Nouvel event `SCENE.SYNC` (§2.3) — remplace `scene`/`snapGrid`/`virtualKeyframes` sans toucher `playheadMs`/`selection`/`interaction`. `SCENE.LOAD` reçoit aussi `lastMutation: {source:'load',...}`, sinon inchangé. |
| `sequence-editor/controller.ts` | `onSceneChange(cb)` ajouté (§2.2). `syncScene(scene)` ajouté (§2.3) — jamais `deserialize()` dans la boucle de commit. |
| `tests/sequence-editor/machine.spec.ts` | Cas ajoutés : `lastMutation.source === 'user'` après une mutation, `'load'` après `SCENE.LOAD`/`SCENE.SYNC`, jamais réémis deux fois pour la même transition. `SCENE.SYNC` ne touche pas `playheadMs`/`selection`/`interaction` (cas explicite : jouer, sélectionner, puis `SCENE.SYNC` — playhead et sélection inchangés). |
| `tests/controller.spec.ts` | `onSceneChange` : appelé sur mutation utilisateur, PAS appelé sur `syncScene()`/`deserialize()`, désabonnement effectif. `syncScene()` : scène remplacée, playhead/sélection préservés (contrairement à `deserialize()`, testé en contraste). |

---

## 3. Les 4 acteurs enfants — architecture

`controllerMachine` (`controller-machine.ts`) invoque 4 acteurs, chacun démarré/arrêté selon l'existence de `context.scene` (pas d'acteur avant qu'une scène soit chargée) :

```
controllerMachine
 ├─ invoke: 'scenePlayer'    (fromCallback) — Builder + Player + selection-frame
 ├─ invoke: 'sequenceEditor' (fromCallback) — SequenceEditorController + mountSequenceEditor
 └─ invoke: 'decorEditor'    (fromCallback) — DecorEditorController + mountDecorEditor
```

Chaque acteur est un `fromCallback(({ input, sendBack, receive }) => { ... })` (XState v5) — pas `fromObservable`/`fromPromise`, parce que chacun a un cycle de vie mount/destroy explicite (les trois `mount*`/`Player.init` retournent des handles `destroy()`), pas un flux Observable ni une promesse ponctuelle.

### 3.1 Acteur `scenePlayer` — Builder + Player + selection-frame — **BLOQUÉ, voir §3.1bis**

**Rôle prévu** : reconstruit le player à chaque changement de `scene`, monte `createSelectionFrame` sur l'item sélectionné. **L'ébauche de code ci-dessous a été écrite avant vérification — elle contient le même défaut que §1.3 (`deserialize()`), corrigé depuis pour le sequence-editor mais PAS résolu ici. Ne pas implémenter tel quel — voir §3.1bis.**

```ts
// ⚠️ NE PAS IMPLÉMENTER TEL QUEL — bloqué par §3.1bis.
const scenePlayerLogic = fromCallback<ScenePlayerEvent, ScenePlayerInput>(({ input, sendBack, receive }) => {
  const player = new Player()
  let frame: SelectionFrameHandle | null = null
  let authorApi: AuthorApi | null = null

  async function rebuild(scene: EditorScene): Promise<void> {
    const { sceneDoc, styleSheet } = buildSceneDoc(scene)
    const styleSheetUrl = URL.createObjectURL(new Blob([styleSheet], { type: 'text/css' }))
    const compileResult = builder.compile({ scene: sceneDoc })
    if (!compileResult.ok) { sendBack({ type: 'BUILD_ERROR', error: compileResult.error }); return }
    await player.init({   // ← PROBLÈME : voir §3.1bis, remount complet, même défaut que deserialize()
      mountTarget: input.mountTarget,
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest,
    })
    authorApi = createAuthorApi(player)
    sendBack({ type: 'PLAYER_READY' })
  }

  receive((event) => {
    if (event.type === 'SCENE_UPDATED') void rebuild(event.scene)   // ← à CHAQUE commit — le point qui casse tout
    if (event.type === 'SELECT_ITEM') {
      frame?.destroy(); frame = null
      if (event.itemId && authorApi) {
        const adapter = createLibreAdapter({ authorApi, itemId: event.itemId })
        frame = createSelectionFrame({ itemId: event.itemId, authorApi, sceneRoot: input.mountTarget, adapter })
      }
    }
    if (event.type === 'SEEK') void player.seek({ timelineMs: event.timelineMs })
  })

  void rebuild(input.initialScene)   // ← seul appel légitime : premier montage, pas un commit

  return () => { frame?.destroy(); void player.destroy() }
})
```

### 3.1bis — Le même défaut que §1.3, retrouvé dans `Player`, vérifié et NON contourné

**Périmètre déjà tranché par ce document (§1.3, à propos de `deserialize()`/`SCENE.LOAD`)** : un remontage complet (perte de playhead, de sélection, de geste en cours) n'est acceptable QUE pour charger un document **différent** — jamais pour une édition du document en cours d'édition, aussi fréquente soit-elle. C'est la règle déjà posée et appliquée (`SCENE.SYNC` créé exprès pour ne jamais la violer côté sequence-editor).

**Constat vérifié (lecture de `Player.init()`, `packages/codplay/src/player/player.ts:210-249`)** : `init()` fait `scheduleRuntime.reset()`, `destroyStrapLoopSchedulers()`, `mountRootNodes()` (remontage complet), `captureInitialAuthorState()` — un appel à chaque `SCENE_UPDATED` (§3.1 ci-dessus, ligne `if (event.type === 'SCENE_UPDATED') void rebuild(...)`) **viole exactement** le périmètre déjà tranché : ce n'est pas un chargement de document différent, c'est une édition du même document, potentiellement plusieurs fois par geste.

**Ce qui a été vérifié et écarté, sans y toucher davantage** : il existe un `rebuild(mode: 'state'|'full')` interne à `PlayerFacade` (`packages/codplay/src/player/create-player.ts:2420+`) qui **préserve** l'état de lecture (capture/restaure `previousStatus`) — mais (a) il n'est **pas exposé** sur `PlayerApi`, l'interface publique que `packages/editor` consomme, et (b) il ne prend pas de nouvelle scène compilée en paramètre — il rejoue la scène **déjà montée** (`this.scene`), ce qui ne correspond pas au besoin (« voici un document édité, reflète-le »).

**Décision (2026-07-13)** : `packages/codplay` n'est ni lu ni modifié dans le cadre de ce plan — hors mandat. L'acteur `scenePlayer` reste **bloqué** sur le point précis "réappliquer une édition de document à un player déjà monté, sans perdre l'état de lecture" — aucun contournement improvisé (pas de faux `seek()` de rattrapage après `init()`, pas d'acceptation silencieuse du remount complet à chaque commit). Ce blocage est un fait à documenter, pas un problème à maquiller par une implémentation qui semblerait fonctionner en démo mais casserait l'édition réelle.

**Ce qui reste faisable sans ce déblocage** : le premier montage (`rebuild(input.initialScene)`, un seul appel légitime, pas un commit) — donc le point 1 du jalon (« document → Builder → player ») est réalisable pour l'**affichage initial** d'un item. Toute édition **ultérieure** du même item ne peut pas se refléter dans la région scène tant que ce point n'est pas résolu ailleurs (hors périmètre ed2). §6 (ordre de travail) et §5 (validation du jalon) sont amendés en conséquence.

### 3.2 Acteur `sequenceEditor`

```ts
const sequenceEditorLogic = fromCallback<SequenceEditorActorEvent, SequenceEditorActorInput>(({ input, sendBack, receive }) => {
  const controller = new SequenceEditorController(input.initialScene)
  const handle = mountSequenceEditor(input.container, controller, {
    onPlayheadChange: (timeMs) => sendBack({ type: 'SEEK', timelineMs: timeMs }),
  })
  const unsubscribeScene = controller.onSceneChange((scene) => sendBack({ type: 'SCENE_MUTATED', scene }))
  const unsubscribeSelection = controller.subscribe((snap) => {
    const trackId = snap.context.selection.trackId
    if (trackId) sendBack({ type: 'SELECT_ITEM', itemId: trackId })
  })

  receive((event) => {
    if (event.type === 'SCENE_UPDATED') controller.syncScene(event.scene)   // JAMAIS deserialize() ici — §1.3/§2.3
    if (event.type === 'SELECT_ITEM_EXTERNAL') controller.selectTrack(event.itemId)
  })

  return () => { unsubscribeScene(); unsubscribeSelection(); handle.destroy(); controller.destroy() }
})
```

`container` (l'élément DOM de la région timeline) est passé en `input` — obtenu côté React via un `ref` sur la région, transmis au montage de l'acteur (voir §4).

### 3.3 Acteur `decorEditor`

Même patron, en s'appuyant sur `onDecorChange`/`attachItems` déjà existants — pas de patch requis côté dedit (§1.1). `subscribeToNode` passé à `mountDecorEditor` vient de `createAuthorApi(player).subscribeToNode` — **couplage direct à l'acteur `scenePlayer`** : `decorEditor` a besoin d'une référence à `authorApi`, disponible seulement après `PLAYER_READY`. Le contrôleur central retransmet cette référence (ou l'événement) à l'acteur `decorEditor` une fois reçue de `scenePlayer` — **premier point d'ordre inter-acteurs à respecter**, noté ici, détaillé à l'écriture.

### 3.4 Ordre de démarrage et dépendances

```
SCENE_LOADED (contrôleur central)
  │
  ├──▶ invoke scenePlayer (mountTarget déjà dans le DOM, région scène)
  │        │
  │        └──▶ PLAYER_READY (authorApi disponible)
  │                 │
  ├──▶ invoke sequenceEditor (indépendant, ne dépend pas du player)
  │
  └──▶ invoke decorEditor (attend PLAYER_READY pour subscribeToNode réel —
                            peut démarrer avant mais son pont au node reste inerte jusque-là)
```

---

## 4. Régions React → acteurs

`AppLayout.tsx` remplace `DemoMenuRegion`/`DemoPanelRegion` par les vraies régions (retrait des démos temporaires de l'étape 2, comme prévu). Chaque région scène/timeline/panneau est un composant qui :
1. Pose un `ref` sur son conteneur DOM.
2. Au montage, envoie l'event d'invocation au contrôleur avec ce conteneur en `input` (`useEffect` unique, pas de re-render en boucle — le conteneur ne change pas de référence).
3. Ne contient **aucune logique** — les 3 acteurs possèdent tout, la région n'est qu'un point d'ancrage DOM.

**Point à trancher à l'ouverture, pas ici** : XState `invoke` attend normalement une configuration statique déclarée dans la machine, pas un `input` dépendant d'un ref React monté après coup. Deux options : (a) l'`input` de la machine racine inclut les 3 conteneurs DOM, fournis à la création de l'acteur (`createActor(controllerMachine, {input: {...}})`) après que React a monté les régions une première fois (ordre : régions vides montées → containers obtenus → `createActor` avec ces refs → `actor.start()`) ; (b) les acteurs enfants sont `spawn`és dynamiquement (pas `invoke` statique) une fois les refs connus. **(a) plus simple, cohérent avec `main.tsx` actuel qui crée l'acteur une seule fois** — à confirmer à l'écriture.

---

## 5. Embryon de scène minimal — le jalon lui-même

Une fois §2-4 en place, le jalon « un item qui vit » (`app-construction-plan.md`) se vérifie ainsi :

1. **Document → Builder → player.** `RUN_COMMAND(createItem)` puis `RUN_COMMAND(assignType, 'text')` puis `RUN_COMMAND(assignContent, {text: '...'})` (seul type supporté par `buildSceneDoc` actuellement, cf. `mapItemTypeToPersoType` — throw sur tout autre type) → `scenePlayer` reçoit `SCENE_UPDATED` → l'item apparaît dans la région scène.
2. **Sélection commune.** Clic sur le node dans le player (via `selection-frame`, `onAltClickCycle` ou clic simple selon son contrat) OU clic sur la piste dans la timeline → `SELECT_ITEM` au contrôleur central → redescend vers `decorEditor` (`attachItems`) ET `scenePlayer` (`createSelectionFrame` sur ce node).
3. **dedit → façade → document → rebuild — BLOQUÉ en aval, voir §3.1bis.** Édition d'un champ dans la palette dedit → `onDecorChange` → contrôleur central traduit en `RUN_COMMAND(setDecor, ...)` → `scene` mise à jour : cette partie fonctionne (document correctement muté). **Mais la re-projection vers la région scène (« → rebuild ») est bloquée** : le seul chemin disponible (`player.init()` réappelé) violerait le périmètre déjà tranché en §1.3/§3.1bis (remount complet = perte de playhead/lecture à chaque édition). Le point 3 du jalon n'est donc **vérifiable qu'à moitié** avec l'état actuel de `Player` : la mutation du document, oui ; son reflet visuel dans la scène jouée, non.
4. **Playhead → seek.** Déplacement dans la timeline → `onPlayheadChange` → `SEEK` → `scenePlayer` appelle `player.seek({timelineMs})`. Réalisable indépendamment du point 3 — `seek()` est une méthode `PlayerApi` publique, non-destructive par construction (`docs/formalisation` : *"il ne re-exécute jamais les straps/effects"*), aucun blocage identifié ici.

**Validation** : test d'intégration (vitest + jsdom, comme `mount.spec.ts`) qui exerce les points 1, 2 et 4 sur le contrôleur central directement (sans vrai `Player` — mock ou stub minimal, puisque `Player` dépend du DOM/CSS réel) ; le point 3 se limite à vérifier que le document est correctement muté (testable), pas que la scène jouée le reflète (bloqué, §3.1bis) ; rendu réel dans Safari (`npm run dev:editor`) pour les points 1 et 2, où le rendu visuel compte réellement.

---

## 6. Ordre de travail

1. Patch `SequenceEditorController.onSceneChange` (§2) — isolé, testable seul, aucune dépendance aux acteurs.
2. Acteur `sequenceEditor` seul, invoqué par le contrôleur, région timeline réelle — valide point 1 partiellement (le document change, pas encore vu dans une scène jouée).
3. Acteur `scenePlayer` — **premier montage seulement** (`rebuild(input.initialScene)`, un seul appel légitime). Valide le point 1 pour l'affichage initial d'un item. **Ne pas câbler `SCENE_UPDATED → rebuild()` en boucle de commit — bloqué, §3.1bis.**
4. Sélection commune (§5.2) — branche `SELECT_ITEM` entre les 3 acteurs. Réalisable indépendamment du blocage §3.1bis.
5. Acteur `decorEditor` — le document se met à jour correctement (`onDecorChange` → `RUN_COMMAND(setDecor)`), vérifiable par test ; son reflet dans la région scène reste bloqué (§3.1bis) tant que ce point n'est pas résolu ailleurs, hors périmètre `codplay`.
6. Playhead → seek (§5.4) — valide le point 4, réalisable indépendamment du blocage.
7. Remplacer `DemoMenuRegion`/`DemoPanelRegion` par les vraies régions menu/panneau (pas construites dans ce plan — hors périmètre, elles restent temporaires tant que non spécifiées ailleurs).

Chaque étape validée (test + rendu Safari si applicable) avant la suivante, même méthode que la migration sequence-editor. **Le jalon « un item qui vit » ne peut pas être fermé intégralement tant que §3.1bis n'est pas résolu** — les points 1 (affichage initial), 2 (sélection) et 4 (seek) sont atteignables ; le point 3 (édition → reflet visuel) ne l'est pas.

---

## 7. Hors périmètre de ce plan

- **`packages/codplay` — non lu, non modifié dans ce plan** (§3.1bis). La résolution du blocage (permettre à `Player` de refléter un document édité sans perdre l'état de lecture) appartient à un chantier `codplay` séparé, hors mandat ici.
- Vocabulaire d'intentions typées fines pour `onSceneChange` (actuellement : scène entière) — évolution possible si l'historien (étape 4) en a besoin pour une granularité plus fine qu'« une scène remplace l'autre ».
- Rebuild incrémental/partiel du player — sans objet tant que §3.1bis n'est pas résolu (aucun rebuild en boucle de commit n'est câblé).
- Régions menu/chutier/telco — pas construites ici, `AppLayout` garde des régions vides pour elles.
- Le détail exact de `createLibreAdapter` vs les autres adapters (`createFlexAdapter`, `createGridPlacementAdapter`) — l'embryon minimal n'a pas de zones, `createLibreAdapter` suffit ; le choix d'adapter selon le contexte réel (zone vs libre) est un chantier séparé.
