import type { StrapCollection } from '../../player'
import type { PlayerSceneLifecycleOptions, SceneDoc, StrictSceneDoc } from '../../player/types'

export function createS5DragScene(): SceneDoc {
  return {
    id: 's5-drag-scene',
    rootStories: ['s5-drag-story'],
    initial: undefined,
    straps: ['apply-drag'],
    listen: [
      { on: 'drag:moved', straps: ['apply-drag'] }
    ],
    stories: {
      's5-drag-story': {
        id: 's5-drag-story',
        entries: ['draggable'],
        initial: undefined,
        straps: undefined,
        listen: [],
        eventimes: [
          { name: 'sequence:end', startAt: 60000 }
        ],
        persos: [
          {
            id: 'draggable',
            type: 'text',
            initial: {
              content: 'Déplacez-moi',
              style: {
                position: 'absolute',
                top: '200px',
                left: '200px',
                padding: '12px 20px',
                background: '#4f46e5',
                color: '#fff',
                borderRadius: '8px',
                cursor: 'grab',
                userSelect: 'none'
              }
            },
            emit: {
              pointerdown: {
                event: { name: 'drag:started', cascade: true },
                capture: {
                  event: { name: 'drag:moved', cascade: true },
                  trackEvent: { name: 'drag:tracking', cascade: true },
                  duration: 400,
                  snapAt: 'start'
                }
              }
            },
            actions: {
              'drag:apply': {},
              'drag:tracking': {}
            }
          }
        ]
      }
    },
    init(scene: StrictSceneDoc, options: PlayerSceneLifecycleOptions) {
      options.mount(scene.rootStories[0])
    },
    tracks: {}
  } as unknown as SceneDoc
}

export const s5DragStraps: StrapCollection = {
  'apply-drag': ({ event }) => {
    const data = event.data as {
      fromX: number
      fromY: number
      toX: number
      toY: number
      duration: number
    }

    return {
      events: [
        {
          name: 'drag:apply',
          cascade: true,
          data: {
            style: {
              x: { from: data.fromX, to: data.toX, duration: data.duration },
              y: { from: data.fromY, to: data.toY, duration: data.duration }
            }
          }
        }
      ]
    }
  }
}
