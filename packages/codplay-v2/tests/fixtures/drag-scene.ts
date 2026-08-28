import type {
  AuthorCaptureEndFunction,
  AuthorCaptureInitFunction,
} from '../../src/scene/capture/authoring-types'
import type { PersoDoc, SceneDoc } from '../../src/scene/types'
import type { StrapCollection } from '../../src/runtime/player'

/** Candidate lists and items retained by the single S6 validation fixture. */
export const LIST_IDS = ['list-a', 'list-b'] as const
export const ITEM_IDS = ['item-1', 'item-2', 'item-3'] as const

const MOVE_DURATION_MS = 420

type S6DndState = Readonly<{
  itemListById: Readonly<Record<string, string>>
}>

/** Updates list membership and derives the two visible counters after a drop. */
export const s6Straps: StrapCollection = {
  'update-list-counts': ({ state, event }) => {
    const data = event.data
    const persoId = typeof data?.persoId === 'string' ? data.persoId : undefined
    const move = data?.move
    const target = typeof move === 'object' && move !== null && 'target' in move
      ? (move as { target?: unknown }).target
      : undefined
    if (persoId === undefined || typeof target !== 'string') return undefined

    const current = state as S6DndState
    const itemListById = { ...current.itemListById, [persoId]: target }
    const countA = Object.values(itemListById).filter((listId) => listId === 'list-a').length
    const countB = Object.values(itemListById).filter((listId) => listId === 'list-b').length
    return {
      update: { itemListById },
      events: [
        { name: 'count:update:a', data: { content: String(countA) } },
        { name: 'count:update:b', data: { content: String(countB) } },
      ],
    }
  },
}

/** Initializes the ordinary capture guard and its author-selected transition. */
const initListDndCaptureState: AuthorCaptureInitFunction = () => ({
  dropIn: [...LIST_IDS],
  move: {
    transition: {
      duration: MOVE_DURATION_MS,
      ease: 'out(2)',
    },
  },
  ghost: {
    className: 'codplay-dnd-ghost',
    style: {
      opacity: '0.42',
      border: '2px dashed currentColor',
      borderRadius: '8px',
    },
  },
})

/** Creates the replayable source-to-target event for one completed list move. */
function createListDndEndCapture(id: string): AuthorCaptureEndFunction {
  return ({ captureState }) => ({
    events: [{
      name: `item:persisted:${id}`,
      data: { ...captureState },
    }],
    durationMode: 'capture',
  })
}

/** Builds one item using the ordinary pointer capture declaration. */
function makeItemPerso(id: string, label: string, background: string): PersoDoc {
  return {
    id,
    type: 'tag',
    initial: {
      tag: 'div',
      move: { target: 'list-a' },
      content: label,
      className: 's6-dnd-item',
      style: {
        padding: '10px 14px',
        background,
        color: '#fff',
        borderRadius: '8px',
        fontWeight: '600',
        cursor: 'grab',
        touchAction: 'none',
      },
    },
    emit: {
      pointerdown: {
        event: { name: 'item:drag:start', cascade: true },
        capture: {
          stateScope: 'story',
          initCaptureState: initListDndCaptureState,
          endCapture: createListDndEndCapture(id),
          endEmit: { name: `item:dropped:${id}` },
        },
      },
    },
    // The persist-only event carries only the replayable source-to-target
    // move. The normal endEmit carries the live release handoff and the
    // state/count updates.
    actions: {
      [`item:persisted:${id}`]: {},
      [`item:dropped:${id}`]: {},
    },
  }
}

/** Creates the V2 S6 DnD list validation scene. */
export function createDragCaptureScene(): SceneDoc {
  return {
    id: 's6-dnd-list-scene',
    stories: {
      main: {
        id: 'main',
        state: {
          itemListById: {
            'item-1': 'list-a',
            'item-2': 'list-a',
            'item-3': 'list-a',
          },
        },
        straps: ['update-list-counts'],
        listen: ITEM_IDS.map((id) => ({
          on: `item:dropped:${id}`,
          straps: ['update-list-counts'],
        })),
        eventimes: [{ name: 'sequence:end', startAt: 24000 }],
        persos: [
          {
            id: 's6-shell',
            type: 'tag',
            initial: {
              tag: 'section',
              move: '@root',
              className: 's6-shell',
              content: '',
            },
            actions: {},
          },
          {
            id: 'list-a',
            type: 'list',
            initial: {
              tag: 'section',
              move: { target: 's6-shell' },
              className: 's6-list',
              attr: { 'data-list-id': 'list-a' },
              style: { minHeight: '190px' },
            },
            actions: {},
          },
          {
            id: 'list-b',
            type: 'list',
            initial: {
              tag: 'section',
              move: { target: 's6-shell' },
              className: 's6-list',
              attr: { 'data-list-id': 'list-b' },
              style: { minHeight: '190px' },
            },
            actions: {},
          },
          {
            id: 'count-a',
            type: 'tag',
            initial: {
              tag: 'span',
              move: { target: 's6-shell' },
              content: '3',
              className: 's6-count',
            },
            actions: { 'count:update:a': {} },
          },
          {
            id: 'count-b',
            type: 'tag',
            initial: {
              tag: 'span',
              move: { target: 's6-shell' },
              content: '0',
              className: 's6-count',
            },
            actions: { 'count:update:b': {} },
          },
          makeItemPerso('item-1', 'Item 1', '#4f46e5'),
          makeItemPerso('item-2', 'Item 2', '#0891b2'),
          makeItemPerso('item-3', 'Item 3', '#059669'),
        ],
      },
    },
  }
}

/** Returns the initial list membership used by the validation readout. */
export const initialListMembership = {
  'item-1': 'list-a',
  'item-2': 'list-a',
  'item-3': 'list-a',
} as const
