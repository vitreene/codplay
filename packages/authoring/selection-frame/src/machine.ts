import { setup, assign } from 'xstate'
import type { CapabilityPreset, CsCapability } from './types'

/**
 * Pure logical state of one SelectionFrame. The machine never touches the
 * DOM: the frame observes snapshot transitions and drives effects itself.
 *
 *   idle ── NODE_APPEARED ──▶ active (still / dragging / resizing / rotating)
 *   active ── NODE_DISAPPEARED ──▶ suspended ── NODE_APPEARED ──▶ active
 */

export type CsMachineContext = {
  capabilities: CsCapability[]
  disabledOperations: string[]
  elementVisible: boolean
  csVisible: boolean
  csActive: boolean
}

export type CsMachineEvent =
  | { type: 'NODE_APPEARED' }
  | { type: 'NODE_DISAPPEARED' }
  | { type: 'DRAG_START' }
  | { type: 'DRAG_MOVE' }
  | { type: 'DRAG_END' }
  | { type: 'RESIZE_START' }
  | { type: 'RESIZE_END' }
  | { type: 'ROTATE_START' }
  | { type: 'ROTATE_END' }
  | { type: 'SYNC' }
  | { type: 'PRESET_APPLIED'; preset: CapabilityPreset }
  | { type: 'ADAPTER_CHANGED' }
  | { type: 'VISIBILITY_CHANGED'; part: 'element' | 'cs'; visible: boolean }
  | { type: 'CS_ACTIVE_CHANGED'; active: boolean }
  | { type: 'OPERATION_ENABLED_CHANGED'; op: string; enabled: boolean }
  // ── creation mode (v1 plan, "Cycle après création") ──────────────────────
  | { type: 'CREATE_ARMED' }
  | { type: 'TRACE_START' }
  | { type: 'TRACE_END' }
  | { type: 'TRACE_ABORT' }
  | { type: 'CREATION_GEOMETRY_APPLIED' }
  | { type: 'ITEM_ATTACHED' }

export const DEFAULT_CAPABILITIES: CsCapability[] = [
  'move',
  'rotate',
  'rotation-origin',
  'resize',
  'scale'
]

export const csMachine = setup({
  types: {
    context: {} as CsMachineContext,
    events: {} as CsMachineEvent
  },
  actions: {
    applyPreset: assign({
      capabilities: ({ context, event }) =>
        event.type === 'PRESET_APPLIED' ? event.preset.capabilities : context.capabilities
    }),
    applyVisibility: assign(({ event }) => {
      if (event.type !== 'VISIBILITY_CHANGED') return {}
      if (event.part === 'element') return { elementVisible: event.visible }
      return { csVisible: event.visible }
    }),
    applyCsActive: assign({
      csActive: ({ context, event }) =>
        event.type === 'CS_ACTIVE_CHANGED' ? event.active : context.csActive
    }),
    applyOperationEnabled: assign({
      disabledOperations: ({ context, event }) => {
        if (event.type !== 'OPERATION_ENABLED_CHANGED') return context.disabledOperations
        const without = context.disabledOperations.filter((op) => op !== event.op)
        return event.enabled ? without : [...without, event.op]
      }
    })
  },
  guards: {
    canMove: ({ context }) =>
      context.csActive &&
      context.capabilities.includes('move') &&
      !context.disabledOperations.includes('move'),
    canResize: ({ context }) =>
      context.csActive &&
      (context.capabilities.includes('resize') || context.capabilities.includes('scale')) &&
      !context.disabledOperations.includes('resize'),
    canRotate: ({ context }) =>
      context.csActive &&
      context.capabilities.includes('rotate') &&
      !context.disabledOperations.includes('rotate')
  }
}).createMachine({
  id: 'selection-frame',
  initial: 'idle',
  context: {
    capabilities: DEFAULT_CAPABILITIES,
    disabledOperations: [],
    elementVisible: true,
    csVisible: true,
    csActive: true
  },
  on: {
    PRESET_APPLIED: { actions: 'applyPreset' },
    VISIBILITY_CHANGED: { actions: 'applyVisibility' },
    CS_ACTIVE_CHANGED: { actions: 'applyCsActive' },
    OPERATION_ENABLED_CHANGED: { actions: 'applyOperationEnabled' }
  },
  states: {
    idle: {
      on: {
        NODE_APPEARED: { target: 'active' },
        CREATE_ARMED: { target: 'creating' }
      }
    },
    // Create mode (v1 plan, "Cycle après création") : the cs is traced into
    // existence before any item exists. armed = capture active, no geometry
    // yet; tracing = a drag session is live; awaitingItem = a geometry was
    // committed (trace release or applyCreationGeometry) and the cs stays
    // visible while the editor creates the perso. ITEM_ATTACHED hands off to
    // the regular active/suspended flow with the SAME cs node — no
    // disappearance/reappearance.
    creating: {
      initial: 'armed',
      states: {
        armed: {
          on: {
            TRACE_START: { target: 'tracing' },
            CREATION_GEOMETRY_APPLIED: { target: 'awaitingItem' }
          }
        },
        tracing: {
          on: {
            TRACE_END: { target: 'awaitingItem' },
            TRACE_ABORT: { target: 'armed' }
          }
        },
        awaitingItem: {
          on: {
            // A new trace (or a new applied geometry) overwrites the pending one.
            TRACE_START: { target: 'tracing' },
            CREATION_GEOMETRY_APPLIED: { target: 'awaitingItem' },
            ITEM_ATTACHED: { target: '#selection-frame.active' }
          }
        }
      }
    },
    active: {
      initial: 'still',
      on: {
        NODE_DISAPPEARED: { target: 'suspended' }
      },
      states: {
        still: {
          on: {
            DRAG_START: { target: 'dragging', guard: 'canMove' },
            RESIZE_START: { target: 'resizing', guard: 'canResize' },
            ROTATE_START: { target: 'rotating', guard: 'canRotate' }
          }
        },
        dragging: {
          on: {
            DRAG_END: { target: 'still' }
          }
        },
        resizing: {
          on: {
            RESIZE_END: { target: 'still' }
          }
        },
        rotating: {
          on: {
            ROTATE_END: { target: 'still' }
          }
        }
      }
    },
    suspended: {
      on: {
        NODE_APPEARED: { target: 'active' }
      }
    }
  }
})
