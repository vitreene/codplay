/**
 * Le contrôleur central — `plan/app/2026-07-12-app-controller-definition.md`. Possède le document
 * (`EditorScene`), la sélection, et l'état d'édition partagé de l'app. Toute mutation du document
 * passe par `runCommand`/`transaction` (§4 — voie d'écriture unique) ; rien d'autre n'écrit
 * `context.scene`.
 *
 * §3 — un seul découpage en états macro (`idle`/`creating`) : la sélection, le panneau ouvert, le
 * document courant sont des valeurs de CONTEXTE, pas des états, parce qu'ils ne changent pas ce que
 * les événements font. Seul le mode de geste actif (idle vs tracé de création) change ça.
 */

import { assign, emit, enqueueActions, setup } from 'xstate'
import { runCommand, transaction } from '../commands/facade'
import { EMPTY_SELECTION } from './types'
import type { ControllerContext, ControllerEmitted, ControllerEvent, EditPanel } from './types'

export const controllerMachine = setup({
  types: {} as {
    context: ControllerContext
    events: ControllerEvent
    emitted: ControllerEmitted
  },
  actions: {
    /** §5 — deux émetteurs (timeline, player via selection-frame) convergent ici, un seul point de vérité. */
    selectItem: assign({
      selection: ({ event }) => {
        if (event.type !== 'SELECT_ITEM') return EMPTY_SELECTION
        return { itemIds: event.itemIds, keyframeId: event.keyframeId }
      },
    }),
    clearSelection: assign({ selection: () => EMPTY_SELECTION }),

    toggleZonesVisible: assign({
      zonesVisible: ({ context }) => !context.zonesVisible,
    }),

    setEditGesture: assign({
      editGesture: ({ event }) => (event.type === 'SET_EDIT_GESTURE' ? event.gesture : null),
    }),

    enterCreateMode: assign({
      creatingType: ({ event }) => (event.type === 'CREATE_MODE_ENTER' ? event.itemType : null),
    }),
    exitCreateMode: assign({ creatingType: () => null }),

    openPanel: assign({
      openPanels: ({ context, event }) => {
        if (event.type !== 'OPEN_PANEL') return context.openPanels
        const panel: EditPanel = event.panel
        return context.openPanels.includes(panel) ? context.openPanels : [...context.openPanels, panel]
      },
    }),
    closePanel: assign({
      openPanels: ({ context, event }) =>
        event.type === 'CLOSE_PANEL' ? context.openPanels.filter((p) => p !== event.panel) : context.openPanels,
    }),

    /** §4 — la seule action qui écrit le document : dispatch vers la façade, jamais une mutation directe. */
    runCommand: assign({
      scene: ({ context, event }) => {
        if (event.type !== 'RUN_COMMAND' || !context.scene) return context.scene
        return runCommand(context.scene, event.command)
      },
    }),
    runTransaction: assign({
      scene: ({ context, event }) => {
        if (event.type !== 'RUN_TRANSACTION' || !context.scene) return context.scene
        return transaction(context.scene, event.commands)
      },
    }),

    /** §6 — chargement d'un document (une seule scène chargée à la fois à cette étape, cf. §6 du document contrôleur). */
    sceneLoaded: assign({
      scene: ({ event }) => (event.type === 'SCENE_LOADED' ? event.scene : null),
      currentSceneId: ({ event }) => (event.type === 'SCENE_LOADED' ? event.scene.id : null),
    }),

    /**
     * `bridge-plan.md` §3 — les ponts se resynchronisent via ces deux events émis, jamais via un
     * `subscribe()` sur chaque snapshot. Placées APRÈS `runCommand`/`runTransaction`/`selectItem`/
     * `clearSelection` dans chaque liste `actions` : XState v5 exécute un tableau d'actions dans
     * l'ordre, un `assign` antérieur est donc déjà visible ici. `enqueueActions` (pas un simple
     * `emit`) : ces transitions (`SELECT_ITEM` notamment) restent valides sans document chargé
     * (sélection = état d'UI, pas dépendant du document) — rien à émettre dans ce cas, sans pour
     * autant bloquer toute la transition derrière un `guard`.
     */
    emitSceneCommitted: enqueueActions(({ context, enqueue }) => {
      if (!context.scene) return
      enqueue.emit({ type: 'sceneCommitted', scene: context.scene, selection: context.selection })
    }),
    emitSceneLoaded: emit(({ context }) => ({ type: 'sceneLoaded' as const, scene: context.scene! })),

    /** Relais pur (§7 étape 5) — `playheadMs` n'est jamais stocké ici, `sequence-editor` en reste l'unique possesseur. */
    emitSeek: emit(({ event }) => ({ type: 'seek' as const, timelineMs: event.type === 'SEEK' ? event.timelineMs : 0 })),

    /** §7 étape 4 — posé une fois par `scenePlayer`, stocké (contrairement à `seek`) : un pont `decorEditor` créé après coup doit pouvoir le lire immédiatement via `getSnapshot()`, pas seulement via l'émission. */
    setAuthorApi: assign({
      authorApi: ({ event }) => (event.type === 'PLAYER_READY' ? event.authorApi : null),
      referenceWidthPx: ({ event }) => (event.type === 'PLAYER_READY' ? event.referenceWidthPx : 0),
    }),
    emitAuthorApiReady: enqueueActions(({ event, enqueue }) => {
      if (event.type !== 'PLAYER_READY') return
      enqueue.emit({ type: 'authorApiReady', authorApi: event.authorApi, referenceWidthPx: event.referenceWidthPx })
    }),
  },
}).createMachine({
  id: 'controller',
  initial: 'idle',
  context: {
    documents: {},
    currentSceneId: null,
    scene: null,

    selection: EMPTY_SELECTION,
    openPanels: [],
    editGesture: null,
    zonesVisible: false,
    creatingType: null,

    authorApi: null,
    referenceWidthPx: 0,
  },
  on: {
    /** Ces événements sont valides quel que soit le mode courant — ni la sélection ni les panneaux ne dépendent du mode de geste. */
    /**
     * La sélection émet aussi `sceneCommitted` (scène inchangée, `selection` à jour) — sans ça, le
     * round-trip d'un pont qui a lui-même émis `selectionRequested` (§4) ne se referme jamais : sa
     * propre projection locale de `selection.trackId`/`.keyframeId` resterait périmée.
     */
    SELECT_ITEM: { actions: ['selectItem', 'emitSceneCommitted'] },
    CLEAR_SELECTION: { actions: ['clearSelection', 'emitSceneCommitted'] },
    TOGGLE_ZONES_VISIBLE: { actions: 'toggleZonesVisible' },
    SET_EDIT_GESTURE: { actions: 'setEditGesture' },
    OPEN_PANEL: { actions: 'openPanel' },
    CLOSE_PANEL: { actions: 'closePanel' },
    RUN_COMMAND: { actions: ['runCommand', 'emitSceneCommitted'] },
    RUN_TRANSACTION: { actions: ['runTransaction', 'emitSceneCommitted'] },
    LOAD_SCENE: {},
    SCENE_LOADED: { actions: ['sceneLoaded', 'emitSceneLoaded'] },
    SEEK: { actions: 'emitSeek' },
    PLAYER_READY: { actions: ['setAuthorApi', 'emitAuthorApiReady'] },
  },
  states: {
    idle: {
      on: {
        CREATE_MODE_ENTER: { target: 'creating', actions: 'enterCreateMode' },
      },
    },
    creating: {
      on: {
        CREATE_COMMIT: { target: 'idle', actions: 'exitCreateMode' },
        CREATE_CANCEL: { target: 'idle', actions: 'exitCreateMode' },
      },
    },
  },
})
