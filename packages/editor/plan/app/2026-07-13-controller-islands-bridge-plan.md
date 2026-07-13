# ed2 — Pont contrôleur central ↔ îlots (Builder/Player, sequence-editor, dedit, selection-frame)

Sous-plan de l'étape 3 (`2026-07-10-app-construction-plan.md`) — le jalon « un item qui vit ». Décrit l'état présent (ce qui est construit et vérifié, ce qui est bloqué, ce qui reste à faire) — pas l'historique des décisions qui y ont mené.

**Décision de forme** : le pont contrôleur↔îlots se fait par des **modules de câblage impératifs** — fonctions fabriques sans état propre, ni acteurs XState invoqués ni effets React. Les contrôleurs (`SequenceEditorController`, `DecorEditorController`) et le player exposent déjà des API à callbacks purs (§1) : le pont n'a donc plus d'état à réconcilier (l'ancien besoin d'anti-écho a disparu avec l'architecture par émission) ni de cycle de vie mount/unmount à faire porter par une machine — `SCENE.LOAD` (changement de document) est traité comme un event envoyé au contrôleur déjà existant, jamais comme un remontage de module. Chaque pont est donc créé une seule fois, dès que son conteneur DOM existe, et détruit uniquement au démontage complet de l'app.

**Décision de fond** : le contrôleur central est l'**unique possesseur** du document (`scene`) et de la sélection structurelle (`trackId`/`keyframeId`). Aucun îlot ne garde de copie mutable de ces données — chacun projette ce qu'il reçoit et **émet** des commandes/intentions vers le centre, qui les applique et renvoie l'état à jour en écho. Un seul écrivain par donnée, donc aucun mécanisme de réconciliation/anti-écho à maintenir nulle part.

---

## 1. Ce qui est construit et vérifié

### 1.1 Modèle document unifié

`sequence-editor/types.ts::EditorScene` réexporte littéralement `app/commands/types.ts::EditorScene` — zéro traduction entre le document que possède le contrôleur central et celui que consomme le sequence-editor.

### 1.2 `SequenceEditorController` — posture correcte, API construite et testée en conditions réelles

`sequence-editor/machine.ts` ne possède plus `scene` ni `selection.trackId`/`selection.keyframeId` comme des états qu'il mute lui-même — ce sont des projections en lecture seule, écrites uniquement par deux events distincts :

- **`SCENE.SYNC`** — écho post-commit : remplace `scene` et les champs de `selection` que le centre possède, **sans** toucher `playheadMs`/`interaction`. Seul point d'entrée légitime pour refléter une mutation appliquée ailleurs.
- **`SCENE.LOAD`** — chargement d'un document **différent** : réinitialise tout (playhead, sélection, geste en cours). Réservé au vrai changement de scène (sélecteur multi-documents, étape 5) — jamais appelé dans une boucle de commit.

`selection.markerId` est la seule exception : les marqueurs n'ont pas de slot dans le `Selection` central (`{itemIds, keyframeId}`) — cette machine en reste l'unique possesseur légitime.

Chaque handler de geste utilisateur (ajouter/déplacer/supprimer un keyframe, CRUD marqueur, visibilité de piste, durée de scène…) calcule ce qui a changé et **l'émet** (XState v5 `emit()`) au lieu de l'appliquer localement. API publique sur `SequenceEditorController` :

```ts
onCommand(cb: (commands: Command[]) => void): Unsubscribe
onSelectionRequest(cb: (itemIds: string[], keyframeId?: string) => void): Unsubscribe
syncFromCenter(scene: EditorScene, selection: CentralSelectionEcho): void
deserialize(scene: EditorScene): void   // = SCENE.LOAD, chargement d'un document différent
```

**Vérifié en conditions réelles (Safari, harnais de test jetable câblant le plus petit pont possible)** : double-clic sur une piste → keyframe créé et rendu ; clic sur une piste → sélection reflétée dans l'infobar. Aucune erreur console, 361/361 tests unitaires verts.

### 1.3 Vocabulaire de commandes — deux bibliothèques, une seule voie d'écriture

`app/controller/types.ts::Command` compose deux bibliothèques de fonctions pures `(EditorScene, args) → EditorScene`, sans état interne :

- `app/commands/base-commands.ts` — structure du document (créer/déplacer/supprimer un item, décor, capsule).
- `sequence-editor/commands.ts` — mécanique timeline (keyframes, marqueurs, visibilité de piste, durée de scène), possédée par le module qui en a l'usage plutôt que d'engorger le vocabulaire central (documenté comme volontairement fermé).

`app/commands/facade.ts::runCommand`/`transaction` reste l'unique fonction qui écrit réellement sur `scene` — elle route vers l'une ou l'autre bibliothèque selon le nom de la commande. Une deuxième bibliothèque de fonctions pures n'est pas une deuxième voie d'écriture : le contrôleur central reste le seul à jamais faire `assign({scene: ...})`.

### 1.4 `DecorEditorController` — déjà dans la bonne posture

`onDecorChange(cb: (entries: DecorChangeEntry[]) => void): Unsubscribe` émet des intentions à chaque édition — il ne possède jamais le document, seulement l'écart édité. `attachItems`/`detach` sont rappelables à tout moment sans recréer l'instance. Aucun patch requis.

### 1.5 `Player`/`createAuthorApi`/`createSelectionFrame`

Patron de montage démontré (`selection-frame-demo.ts`) : `new Player(options)` → `player.init({mountTarget, compiledScene, strapCollection})` → `createAuthorApi(player)` → `createXxxAdapter({authorApi, itemId})` → `createSelectionFrame({itemId, authorApi, sceneRoot, adapter})`.

### 1.6 `buildSceneDoc`/`BuilderFacade.compile`

`buildSceneDoc(scene) → {sceneDoc, styleSheet}` (`builder/build-scene.ts`) est une fonction pure, rejouable à volonté. `BuilderFacade.compile(sceneDoc) → CompiledScene` l'est tout autant côté Codplay. `CodPlay.load({scene, mountTarget, ...})` (`creator-facade.ts`) enchaîne déjà compile→init — pont réutilisable tel quel plutôt que d'orchestrer `BuilderFacade`+`Player` séparément.

---

## 2. Coût du rebuild complet — mesuré, accepté

### 2.1 `Player.init()` fait un remontage complet à chaque commit — même mécanisme que dedit, déjà accepté

`Player.init()` remonte entièrement la scène (nœuds DOM détruits/recréés, schedulers réinitialisés) — ce n'est pas un patch incrémental. C'est le même mécanisme que le cycle dedit « preview→debounce→commit→full rebuild », déjà décidé et chiffré : un rebuild coûteux-mais-debounced est un coût accepté, pas une question ouverte. Le pont `scenePlayer` (§3.3) rebuild donc à chaque `sceneCommitted`, exactement comme dedit — pas de restriction au premier montage.

**Mesuré en conditions réelles (Safari, harnais jetable, scène minimale — un item texte)** : rebuild à 17–28ms à froid, puis 2–3ms sur les rebuilds suivants — négligeable à cette échelle. Le tag `<style>` injecté (Blob CSS, `extraResources`) n'est jamais diffé ni nettoyé (chaque rebuild en ajoute un nouveau, même à contenu identique) — défaut réel côté `Player`, hors mandat ici, consigné dans `docs/evolution/lots/backlog.md`.

Comportement média (chargement, position de lecture) sous rebuild répété : déjà démontré correct par les démos `codplay` existantes (`preload-media-demo`, etc.) — pas un point à revérifier ici, l'objectif de ce plan n'est pas de tester `codplay`.

**`packages/codplay` n'est ni lu ni modifié dans le cadre de ce plan** — contrainte de travail générale (§8), indépendante du statut de ce point.

---

## 3. Les ponts à construire

Chaque pont est une fonction fabrique `create<Nom>Bridge(container, machine): BridgeHandle` — pas d'acteur XState, pas d'événements sérialisés, des appels de méthode directs dans les deux sens. `machine` est l'`ActorRefFrom<typeof controllerMachine>` déjà démarré ; le contrôleur central émet (`emit()`/`setup({types:{emitted}})`, même patron déjà utilisé par `SequenceEditorController`) deux events que tout pont peut écouter via `machine.on(...)` :

- `sceneCommitted` — après application d'une transaction (`RUN_TRANSACTION`), écho post-commit.
- `sceneLoaded` — changement de document.

Créés une fois que leur conteneur DOM existe (au montage de la région React correspondante, §5), détruits uniquement au démontage complet de l'app.

### 3.1 Pont `sequenceEditor`

```ts
export function createSequenceEditorBridge(container: HTMLElement, machine: ActorRefFrom<typeof controllerMachine>): BridgeHandle {
  const controller = new SequenceEditorController(machine.getSnapshot().context.scene)
  const handle = mountSequenceEditor(container, controller, {
    onPlayheadChange: (timeMs) => machine.send({ type: 'SEEK', timelineMs: timeMs }),
  })
  const unsubscribeCommand = controller.onCommand((commands) => machine.send({ type: 'RUN_TRANSACTION', commands }))
  const unsubscribeSelection = controller.onSelectionRequest((itemIds, keyframeId) => machine.send({ type: 'SELECT_ITEM', itemIds, keyframeId }))
  const unsubscribeSync = machine.on('sceneCommitted', ({ scene, selection }) => controller.syncFromCenter(scene, selection))
  const unsubscribeLoad = machine.on('sceneLoaded', ({ scene }) => controller.deserialize(scene))

  return {
    destroy: () => {
      unsubscribeSync.unsubscribe(); unsubscribeLoad.unsubscribe()
      unsubscribeCommand(); unsubscribeSelection()
      handle.destroy(); controller.destroy()
    },
  }
}
```

### 3.2 Pont `decorEditor`

Même patron, sur `onDecorChange`/`attachItems` déjà existants. `subscribeToNode` passé à `mountDecorEditor` vient de `createAuthorApi(player).subscribeToNode` — couplage direct au pont `scenePlayer` : ce pont a besoin d'une référence à `authorApi`, disponible seulement après le premier `rebuild()` du player (§3.3). Un simple paramètre/callback transmis à la création, pas de souci de timing d'`input` d'acteur puisqu'il n'y a plus d'acteur.

### 3.3 Pont `scenePlayer` — rebuild à chaque commit (§2.1)

```ts
export function createScenePlayerBridge(mountTarget: HTMLElement, machine: ActorRefFrom<typeof controllerMachine>): ScenePlayerBridge {
  const player = new Player()
  let frame: SelectionFrameHandle | null = null
  let authorApi: AuthorApi | null = null

  async function rebuild(scene: EditorScene): Promise<void> {
    const { sceneDoc, styleSheet } = buildSceneDoc(scene)
    const styleSheetUrl = URL.createObjectURL(new Blob([styleSheet], { type: 'text/css' }))
    const compileResult = builder.compile({ scene: sceneDoc })
    if (!compileResult.ok) { machine.send({ type: 'BUILD_ERROR', error: compileResult.error }); return }
    await player.init({
      mountTarget,
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest,
      extraResources: [{ url: URL.createObjectURL(new Blob([styleSheet], { type: 'text/css' })), type: 'css', policy: { cache: 'no-store' } }],
    })
    authorApi = createAuthorApi(player)
    machine.send({ type: 'PLAYER_READY', authorApi })
  }

  const unsubscribeCommitted = machine.on('sceneCommitted', ({ scene }) => { void rebuild(scene) })
  const unsubscribeLoaded = machine.on('sceneLoaded', ({ scene }) => { void rebuild(scene) })

  function selectItem(itemIds: string[]) {
    frame?.destroy(); frame = null
    if (itemIds[0] && authorApi) {
      const adapter = createLibreAdapter({ authorApi, itemId: itemIds[0] })
      frame = createSelectionFrame({ itemId: itemIds[0], authorApi, sceneRoot: mountTarget, adapter })
    }
  }

  function seek(timelineMs: number) {
    void player.seek({ timelineMs })
  }

  void rebuild(machine.getSnapshot().context.scene)

  return {
    selectItem,
    seek,
    destroy: () => {
      unsubscribeCommitted.unsubscribe(); unsubscribeLoaded.unsubscribe()
      frame?.destroy(); void player.destroy()
    },
  }
}
```

`createLibreAdapter` suppose un item en position libre (pas en zone) — seul adapter dont l'usage est démontré ; le choix d'adapter selon le contexte réel (zone vs libre) est un chantier séparé.

**Point ouvert** : le debounce entre geste utilisateur et `sceneCommitted` (déjà accepté en principe, §2.1) — son point d'insertion exact (dans le contrôleur central avant de committer, ou en amont dans chaque pont avant d'émettre `RUN_TRANSACTION`) reste à trancher à l'implémentation.

### 3.4 Ordre de création

```
SCENE_LOADED (contrôleur central, une fois le document initial chargé)
  ├─▶ createScenePlayerBridge(sceneRegionEl, machine)    ──▶ envoie PLAYER_READY (authorApi disponible)
  ├─▶ createSequenceEditorBridge(timelineRegionEl, machine)  (indépendant, ne dépend pas du player)
  └─▶ createDecorEditorBridge(panelRegionEl, machine, getAuthorApi)  (subscribeToNode réel dès PLAYER_READY,
                                                                       inerte avant)
```

---

## 4. Sélection commune

Timeline (`sequenceEditor`) et player (`scenePlayer`, via `selection-frame`) émettent tous deux vers le contrôleur central (`SELECT_ITEM`), qui reste l'unique possesseur de `selection`. Redescend vers `decorEditor` (`attachItems`) et `scenePlayer` (`createSelectionFrame` sur le node correspondant) — jamais un canal direct entre îlots.

---

## 5. Régions React → ponts

`AppLayout.tsx` remplace `DemoMenuRegion`/`DemoPanelRegion` (démos temporaires de l'étape 2) par les vraies régions scène/timeline/panneau. Chaque région pose un `ref` sur son conteneur DOM ; dès que le ref est connu (montage React de la région), elle appelle directement `create<Nom>Bridge(container, machine)` — un simple appel de fonction, pas de configuration statique à satisfaire (contrairement à `invoke`, aucune friction de timing ici). La région elle-même ne porte aucune logique, les ponts possèdent tout.

Régions menu/chutier/telco : pas construites ici, hors périmètre.

---

## 6. Le jalon « un item qui vit » — ce qui est atteignable

1. **Document → Builder → player** — `RUN_COMMAND(createItem)` + `assignType` + `assignContent` (seul `type: 'text'` supporté par `buildSceneDoc` actuellement) → `scenePlayer` affiche l'item. Atteignable (§3.3).
2. **Sélection commune** — atteignable (§4).
3. **dedit → façade → document → rebuild** — la mutation du document fonctionne et est vérifiable ; son reflet visuel dans la scène jouée est atteignable (rebuild à chaque commit, §2.1/§3.3).
4. **Playhead → seek** — `seek()` est une méthode `PlayerApi` publique, non-destructive par construction (ne re-exécute jamais les straps/effects). Atteignable.

Les quatre points sont atteignables avec l'état actuel de `Player` et des contrôleurs.

---

## 7. Ordre de travail

1. Pont `sequenceEditor` (§3.1), région timeline réelle — valide le point 1 partiellement (document change, pas encore vu dans une scène jouée).
2. Pont `scenePlayer` (§3.3) — valide le point 1 complet et le point 3 (rebuild sur commit).
3. Sélection commune (§4).
4. Pont `decorEditor` (§3.2).
5. Playhead → seek — valide le point 4.
6. Remplacer `DemoMenuRegion`/`DemoPanelRegion` par les vraies régions (§5).

Chaque étape validée (test + rendu Safari) avant la suivante.

---

## 8. Hors périmètre

- `packages/codplay` — non lu, non modifié. Contrainte de travail générale pour ce plan.
- Vocabulaire d'intentions plus fin que « une scène remplace l'autre » pour `onCommand` — évolution possible si l'historien (étape 4 du plan général) en a besoin.
- Rebuild incrémental/partiel du player — le rebuild complet (§2.1) est le mécanisme accepté ; un chemin incrémental n'est pas un besoin identifié aujourd'hui.
- Correction de l'accumulation de tags `<style>` côté `Player`/`extraResources` — défaut réel (§2.1) mais chantier `codplay`, pas de ce plan ; consigné dans `docs/evolution/lots/backlog.md`.
- Régions menu/chutier/telco.
- Choix d'adapter selon zone vs position libre (`createFlexAdapter`, `createGridPlacementAdapter`) — l'embryon minimal n'a pas de zones.
