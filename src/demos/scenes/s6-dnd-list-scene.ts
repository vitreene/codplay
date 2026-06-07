import type { TransformFn, StrapCollection } from '../../player/strap-types'
import type { SceneDoc } from '../../player/types'
import type { PlayerSceneLifecycleOptions, StrictSceneDoc } from '../../player/types'

const DROP_ZONES: Record<string, 'a' | 'b'> = {
  'list-a': 'a',
  'list-b': 'b',
}

// ─── transforms ──────────────────────────────────────────────────────────────

// Tracking live : un seul listen, persoId injecté par la capture session.
const trackMove: TransformFn = (event) => {
  const { dx, dy, baseX, baseY, persoId } = event.data as {
    dx: number; dy: number; baseX: number; baseY: number; persoId: string
  }
  return [{
    name: `item:drag:tracking:${persoId}`,
    cascade: true,
    data: {
      style: {
        x: { to: baseX + dx, duration: 0 },
        y: { to: baseY + dy, duration: 0 },
        zIndex: '10',
      },
    },
  }]
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
          event: { name: 'item:drag:tracking' },
          endEvent: { name: 'item:drag:end' },
          duration: 400,
          snapAt: 'end',
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
    rootStories: ['s6-main-story'],
    initial: undefined,
    straps: [],
    listen: [],
    stories: {
      's6-main-story': {
        id: 's6-main-story',
        entries: ['s6-shell'],
        state: {
          assignments: { 'item-1': 'a', 'item-2': 'a', 'item-3': 'a' },
        },
        initial: undefined,
        straps: [],
        listen: [
          { on: 'item:drag:tracking', transform: [trackMove] },
          { on: 'item:drag:end', straps: ['drop-resolver'] },
        ],
        eventimes: [{ name: 'sequence:end', startAt: 60000 }],
        persos: [

          // ── conteneur principal (grille 2×2) ────────────────────────────
          {
            id: 's6-shell',
            type: 'layout',
            initial: {
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
    init(scene: StrictSceneDoc, options: PlayerSceneLifecycleOptions) {
      options.mount(scene.rootStories[0])
    },
  } as unknown as SceneDoc
}
