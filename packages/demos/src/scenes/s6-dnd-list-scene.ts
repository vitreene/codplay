import type { StrapCollection } from 'codplay/player/strap-types'
import type { CaptureInitFn, CaptureTrackFn, PointerCaptureSample } from 'codplay/runtime/capture-types'
import type { SceneDoc } from 'codplay/player/types'

const DROP_ZONES: Record<string, 'a' | 'b'> = {
  'list-a': 'a',
  'list-b': 'b',
}

// ─── capture (drag pointeur, un cycle par item) ─────────────────────────────

type ItemDragCaptureState = { x: number; y: number; clientX: number; clientY: number; persoId: string }

/**
 * An item always sits at x:0/y:0 when idle — a successful drop reparents it
 * (`flipMode`, no explicit x/y reset needed) and an invalid drop resets it to
 * 0/0 (`item:drop-reset`). No `state` read needed: 0/0 is always the truth.
 * `persoId` is closed over `itemId` (a factory per item, like `makeItemPerso`
 * already does for everything else): neither `initCaptureState` nor
 * `trackCommand` receive it natively (`v1-capture-spec.md` regle 5), but
 * `drop-resolver` needs it in `endEmit`'s `captureState` fallback.
 */
function makeInitItemDragCaptureState(itemId: string): CaptureInitFn {
  return () => ({ x: 0, y: 0, clientX: 0, clientY: 0, persoId: itemId })
}

/**
 * `actionName` must be per-item (`item:drag:tracking:${itemId}`), never a
 * name shared by all three items: `v1-capture-spec.md` regle 5 routes a
 * `CaptureAction` to every perso declaring that `actionName` in `actions` —
 * a shared name would move all three items together. Mirrors the per-item
 * drop actions (`item:drop:${id}:to-a`) already used below.
 */
function makeTrackItemDrag(itemId: string): CaptureTrackFn {
  return ({ sample, captureState }) => {
    const pointerSample = sample as PointerCaptureSample
    const dragCaptureState = captureState as ItemDragCaptureState
    const x = dragCaptureState.x + pointerSample.movementX
    const y = dragCaptureState.y + pointerSample.movementY

    return {
      action: {
        actionName: `item:drag:tracking:${itemId}`,
        data: { style: { x, y, zIndex: '10' } },
      },
      captureState: {
        x,
        y,
        clientX: pointerSample.clientX,
        clientY: pointerSample.clientY,
        persoId: dragCaptureState.persoId,
      },
    }
  }
}

//─── straps ───────────────────────────────────────────────────────────────────

export const s6Straps: StrapCollection = {

  'drop-resolver': ({ event, state, context }) => {
    const data = event.data as { persoId: string; clientX: number; clientY: number }
    const itemId = data.persoId
    if (!itemId) return

    const hitId = context.api.getPersoIdAt(data.clientX, data.clientY, itemId)
    const targetList = hitId !== null ? DROP_ZONES[hitId] ?? null : null
    const oldAssignments = state.assignments as Record<string, string>

    if (targetList === null || oldAssignments[itemId] === targetList) {
      return {
        events: [{ name: `item:drop-reset:${itemId}`, data: {} }],
      }
    }

    const newAssignments = { ...oldAssignments, [itemId]: targetList }
    const countA = Object.values(newAssignments).filter((v) => v === 'a').length
    const countB = Object.values(newAssignments).filter((v) => v === 'b').length

    return {
      update: { assignments: newAssignments },
      events: [
        { name: `item:drop:${itemId}:to-${targetList}`, data: {} },
        { name: 'count:update:a', data: { content: String(countA) } },
        { name: 'count:update:b', data: { content: String(countB) } },
      ],
    }
  },
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeItemPerso(
  id: string,
  label: string,
  background: string
): Record<string, unknown> {
  return {
    id,
    type: 'text',
    initial: {
      tag: 'div',
      content: label,
      move: { parentId: 'list-a' },
      style: {
        padding: '10px 14px',
        background,
        color: '#fff',
        borderRadius: '8px',
        cursor: 'grab',
        fontWeight: '600',
        position: 'relative',
      },
    },
    emit: {
      pointerdown: {
        event: { name: 'item:drag:start', cascade: true },
        capture: {
          trackOn: ['pointermove'],
          endOn: ['pointerup'],
          stateScope: 'story',
          initCaptureState: makeInitItemDragCaptureState(id),
          trackCommand: makeTrackItemDrag(id),
          // `endEmit.data` absent falls back to `captureState`, which already
          // carries `persoId` (closed over `id` in `makeInitItemDragCaptureState`).
          endEmit: { name: 'item:drag:end' },
        },
      },
    },
    actions: {
      [`item:drag:tracking:${id}`]: {},
      // drop valide : même pattern que Player POC — flipMode seul, pas de reset x/y explicite
      [`item:drop:${id}:to-a`]: {
        move: { parentId: 'list-a', flipMode: 'overlay-world' },
        style: { zIndex: 'auto' },
      },
      [`item:drop:${id}:to-b`]: {
        move: { parentId: 'list-b', flipMode: 'overlay-world' },
        style: { zIndex: 'auto' },
      },
      // drop invalide ou même liste : retour à x/y=0
      [`item:drop-reset:${id}`]: {
        style: {
          x: { to: 0, duration: 250, ease: 'outQuad' },
          y: { to: 0, duration: 250, ease: 'outQuad' },
          zIndex: 'auto',
        },
      },
    },
  }
}

// ─── scene ───────────────────────────────────────────────────────────────────

export function createS6DndListScene(): SceneDoc {
  return {
    id: 's6-dnd-list-scene',
    initial: undefined,
    straps: [],
    listen: [],
    stories: {
      's6-main-story': {
        id: 's6-main-story',
        state: {
          assignments: { 'item-1': 'a', 'item-2': 'a', 'item-3': 'a' },
        },
        initial: { move: '@root' },
        straps: s6Straps,
        listen: [
          { on: 'item:drag:end', straps: ['drop-resolver'] },
        ],
        eventimes: [{ name: 'sequence:end', startAt: 60000 }],
        persos: [

          // ── conteneur principal (grille 2×2) ────────────────────────────
          {
            id: 's6-shell',
            type: 'layout',
            initial: {
              move: '@root',
              style: {
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: 'auto auto',
                gap: '12px 40px',
                padding: '24px',
                background: '#f1f5f9',
                borderRadius: '16px',
                userSelect: 'none',
                width: '480px',
              },
            },
            actions: {},
          },

          // ── listes (drop zones, ligne 1 de la grille) ────────────────────
          {
            id: 'list-a',
            type: 'list',
            initial: {
              move: { parentId: 's6-shell' },
              style: {
                minHeight: '180px',
                border: '2px dashed #94a3b8',
                borderRadius: '10px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(255,255,255,0.6)',
              },
            },
            actions: {},
          },
          {
            id: 'list-b',
            type: 'list',
            initial: {
              move: { parentId: 's6-shell' },
              style: {
                minHeight: '180px',
                border: '2px dashed #94a3b8',
                borderRadius: '10px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(255,255,255,0.6)',
              },
            },
            actions: {},
          },

          // ── compteurs (hors listes, ligne 2 de la grille) ────────────────
          {
            id: 'count-a',
            type: 'text',
            initial: {
              tag: 'span',
              content: '3',
              move: { parentId: 's6-shell' },
              style: { fontSize: '13px', color: '#64748b', pointerEvents: 'none' },
            },
            actions: { 'count:update:a': {} },
          },
          {
            id: 'count-b',
            type: 'text',
            initial: {
              tag: 'span',
              content: '0',
              move: { parentId: 's6-shell' },
              style: { fontSize: '13px', color: '#64748b', pointerEvents: 'none' },
            },
            actions: { 'count:update:b': {} },
          },

          // ── items draggables (initialement dans list-a) ──────────────────
          makeItemPerso('item-1', 'Item 1', '#4f46e5'),
          makeItemPerso('item-2', 'Item 2', '#0891b2'),
          makeItemPerso('item-3', 'Item 3', '#059669'),
        ],
      },
    },
    tracks: {},
  } as unknown as SceneDoc
}
