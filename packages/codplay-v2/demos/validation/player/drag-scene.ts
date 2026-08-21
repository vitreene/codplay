import type {
  AuthorCaptureEndFunction,
  AuthorCaptureInitFunction,
  AuthorCaptureTrackFunction,
} from '../../../src/scene/capture/authoring-types'
import type { SceneDoc } from '../../../src/scene/types'
import type { StrapCollection } from '../../../src/runtime/player'

const DRAG_START_X = 80
const DRAG_START_Y = 72

type DragStoryState = Readonly<{
  draggableX: number
  draggableY: number
}>

type DragCaptureState = Readonly<{
  x: number
  y: number
}>

/** Initializes the live drag position from the owning story state. */
const initDragCaptureState: AuthorCaptureInitFunction = ({ state }) => {
  const dragState = state as DragStoryState
  return {
    x: typeof dragState.draggableX === 'number' ? dragState.draggableX : DRAG_START_X,
    y: typeof dragState.draggableY === 'number' ? dragState.draggableY : DRAG_START_Y,
  }
}

/** Applies one native pointer delta through the ordinary live action path. */
const trackDrag: AuthorCaptureTrackFunction = ({ sample, captureState }) => {
  const previous = captureState as DragCaptureState
  const movementX = typeof sample.movementX === 'number' ? sample.movementX : 0
  const movementY = typeof sample.movementY === 'number' ? sample.movementY : 0
  const x = previous.x + movementX
  const y = previous.y + movementY

  return {
    action: {
      actionName: 'capture_draggable_move',
      data: { style: { x, y } },
    },
    captureState: { x, y },
  }
}

/** Produces the ordinary end event that commits the final position and seek. */
const endDragCapture: AuthorCaptureEndFunction = ({ captureState, state }) => {
  const end = captureState as DragCaptureState
  const dragState = state as DragStoryState

  return {
    events: [{
      name: 'drag:dropped',
      mode: 'apply-now',
      data: {
        x: end.x,
        y: end.y,
        captureState: { x: end.x, y: end.y },
        style: {
          x: { from: dragState.draggableX, to: end.x },
          y: { from: dragState.draggableY, to: end.y },
        },
      },
    }],
    durationMode: 'capture',
  }
}

/** Persists the last captured position for the next capture session. */
export const dragStraps: StrapCollection = {
  'drag-settle': ({ event }) => {
    const captureState = event.data?.captureState
    if (typeof captureState !== 'object' || captureState === null) return undefined
    const position = captureState as Partial<DragCaptureState>
    if (typeof position.x !== 'number' || typeof position.y !== 'number') return undefined
    return { update: { draggableX: position.x, draggableY: position.y } }
  },
}

/** Builds the V2 authoring scene corresponding to the V1 classic drag demo. */
export function createDragCaptureScene(): SceneDoc {
  return {
    id: 'drag-capture-scene',
    stories: {
      main: {
        id: 'main',
        state: { draggableX: DRAG_START_X, draggableY: DRAG_START_Y },
        straps: ['drag-settle'],
        listen: [{ on: 'drag:dropped', straps: ['drag-settle'] }],
        eventimes: [{ name: 'sequence:end', startAt: 6000 }],
        persos: [{
          id: 'draggable',
          type: 'tag',
          initial: {
            tag: 'button',
            move: '@root',
            content: 'Déplacez-moi',
            className: 'drag-target',
            attr: { type: 'button' },
            style: {
              position: 'absolute',
              left: '0px',
              top: '0px',
              x: DRAG_START_X,
              y: DRAG_START_Y,
              padding: '14px 22px',
              border: '0',
              borderRadius: '10px',
              background: '#4f46e5',
              color: '#fff',
              font: '600 16px/1.2 system-ui, sans-serif',
              cursor: 'grab',
              userSelect: 'none',
              touchAction: 'none',
            },
          },
          emit: {
            pointerdown: {
              event: { name: 'drag:started', cascade: true },
              capture: {
                trackOn: ['pointermove'],
                endOn: ['pointerup'],
                initCaptureState: initDragCaptureState,
                trackCommand: trackDrag,
                endCapture: endDragCapture,
              },
            },
          },
          actions: {
            capture_draggable_move: {},
            'drag:dropped': {},
          },
        }],
      },
    },
  }
}

/** Exposes the authored initial position for the validation readout. */
export const dragStartPosition = { x: DRAG_START_X, y: DRAG_START_Y }
