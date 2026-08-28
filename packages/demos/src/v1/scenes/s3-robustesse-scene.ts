import type { SceneDoc } from 'codplay-v1/player/types'

/**
 * Creates one robustness scene with two lists and one transferable card perso.
 */
export function createS3RobustesseScene(): SceneDoc {
  return {
    id: 's3-robustesse-scene',
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      's3-robustesse-story': {
        id: 's3-robustesse-story',
        initial: { move: '@root' },
        persos: [
          {
            id: 'robust-stage',
            type: 'list',
            initial: {
              move: '@root',
              className: 'robust-stage'
            },
            actions: {}
          },
          {
            id: 'robust-overlay',
            type: 'list',
            initial: {
              move: '@root',
              className: 'robust-overlay'
            },
            actions: {}
          },
          {
            id: 'robust-card',
            type: 'text',
            initial: {
              tag: 'div',
              content: 'CARD',
              move: {
                parentId: 'robust-stage',
              }
            },
            actions: {
              'sequence:robustesse:promote': {
                move: {
                  parentId: 'robust-overlay',
                  flipMode: 'overlay-world'
                }
              },
              'sequence:robustesse:return': {
                move: {
                  parentId: 'robust-stage',
                  flipMode: 'overlay-world'
                }
              }
            }
          }
        ],
        straps: undefined,
        listen: []
      }
    },
    tracks: {}
  }
}
