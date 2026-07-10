import { setup, assign } from 'xstate'

/**
 * Pure logical state of one zone editor instance. The machine never touches
 * the DOM (same discipline as `csMachine`) — the module observes snapshot
 * transitions and drives its own rendering.
 *
 *   idle ── NODE_APPEARED ──▶ active (still / tracing / resizing / moving)
 *   active ── NODE_DISAPPEARED ──▶ suspended ── NODE_APPEARED ──▶ active
 */

export type ZoneMachineContext = {
  selectedNames: string[]
  gridVisible: boolean
  zonesVisible: boolean
  labelsVisible: boolean
}

export type ZoneMachineEvent =
  | { type: 'NODE_APPEARED' }
  | { type: 'NODE_DISAPPEARED' }
  | { type: 'TRACE_START' }
  | { type: 'TRACE_END' }
  | { type: 'TRACE_ABORT' }
  | { type: 'RESIZE_START' }
  | { type: 'RESIZE_END' }
  | { type: 'MOVE_START' }
  | { type: 'MOVE_END' }
  | { type: 'ZONE_ADDED'; name: string }
  | { type: 'ZONE_REMOVED'; name: string }
  | { type: 'CONTAINER_CREATED'; name: string }
  | { type: 'CONTAINER_BROKEN'; name: string }
  | { type: 'SELECTION_CHANGED'; names: string[] }
  | { type: 'STATE_REPLACED' }
  | { type: 'VISIBILITY_CHANGED'; part: 'grid' | 'zones' | 'labels'; visible: boolean }

export const zoneMachine = setup({
  types: {
    context: {} as ZoneMachineContext,
    events: {} as ZoneMachineEvent
  },
  actions: {
    applySelection: assign({
      selectedNames: ({ event }) => (event.type === 'SELECTION_CHANGED' ? event.names : [])
    }),
    applyVisibility: assign(({ event }) => {
      if (event.type !== 'VISIBILITY_CHANGED') return {}
      if (event.part === 'grid') return { gridVisible: event.visible }
      if (event.part === 'labels') return { labelsVisible: event.visible }
      return { zonesVisible: event.visible }
    }),
    deselectRemoved: assign({
      selectedNames: ({ context, event }) => {
        if (event.type !== 'ZONE_REMOVED') return context.selectedNames
        return context.selectedNames.filter((name) => name !== event.name)
      }
    })
  }
}).createMachine({
  id: 'zone-editor',
  initial: 'idle',
  context: {
    selectedNames: [],
    gridVisible: true,
    zonesVisible: true,
    labelsVisible: true
  },
  on: {
    SELECTION_CHANGED: { actions: 'applySelection' },
    VISIBILITY_CHANGED: { actions: 'applyVisibility' },
    ZONE_REMOVED: { actions: 'deselectRemoved' },
    // ZONE_ADDED and STATE_REPLACED carry no context of their own here — the
    // real state (grid + zones) lives in the module's own ZoneEditorState,
    // not duplicated into the machine. These events exist for callers that
    // want to observe the transition (e.g. a future host UI), not to drive it.
    ZONE_ADDED: {},
    STATE_REPLACED: {},
    // Same observation-only role for containers — `divideZone`/`breakContainer` mutate
    // `state.containers` directly; these events exist only so an observer can tell a container
    // was created/broken without diffing state itself.
    CONTAINER_CREATED: {},
    CONTAINER_BROKEN: {}
  },
  states: {
    idle: {
      on: { NODE_APPEARED: { target: 'active' } }
    },
    active: {
      initial: 'still',
      on: { NODE_DISAPPEARED: { target: 'suspended' } },
      states: {
        still: {
          on: {
            TRACE_START: { target: 'tracing' },
            RESIZE_START: { target: 'resizing' },
            MOVE_START: { target: 'moving' }
          }
        },
        tracing: {
          on: {
            TRACE_END: { target: 'still' },
            TRACE_ABORT: { target: 'still' }
          }
        },
        resizing: {
          on: { RESIZE_END: { target: 'still' } }
        },
        moving: {
          on: { MOVE_END: { target: 'still' } }
        }
      }
    },
    suspended: {
      on: { NODE_APPEARED: { target: 'active' } }
    }
  }
})
