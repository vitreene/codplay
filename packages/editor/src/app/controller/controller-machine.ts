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

import { assign, setup } from 'xstate'
import { runCommand, transaction } from '../commands/facade'
import { EMPTY_SELECTION } from './types'
import type { ControllerContext, ControllerEvent, EditPanel } from './types'

export const controllerMachine = setup({
  types: {} as {
    context: ControllerContext
    events: ControllerEvent
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
  },
  on: {
    /** Ces événements sont valides quel que soit le mode courant — ni la sélection ni les panneaux ne dépendent du mode de geste. */
    SELECT_ITEM: { actions: 'selectItem' },
    CLEAR_SELECTION: { actions: 'clearSelection' },
    TOGGLE_ZONES_VISIBLE: { actions: 'toggleZonesVisible' },
    SET_EDIT_GESTURE: { actions: 'setEditGesture' },
    OPEN_PANEL: { actions: 'openPanel' },
    CLOSE_PANEL: { actions: 'closePanel' },
    RUN_COMMAND: { actions: 'runCommand' },
    RUN_TRANSACTION: { actions: 'runTransaction' },
    LOAD_SCENE: {},
    SCENE_LOADED: { actions: 'sceneLoaded' },
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
