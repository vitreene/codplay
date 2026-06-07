import type { SceneDoc } from '../../player/types'

/**
 * Creates one robustness scene with two lists and one transferable card perso.
 */
export function createS3RobustesseScene(): SceneDoc {
  return {
    id: 's3-robustesse-scene',
    rootStories: ['s3-robustesse-story'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      's3-robustesse-story': {
        id: 's3-robustesse-story',
        entries: ['robust-stage', 'robust-overlay', 'robust-card'],
        initial: undefined,
        persos: [
          {
            id: 'robust-stage',
            type: 'list',
            initial: {
              className: 'robust-stage'
            },
            actions: {}
          },
          {
            id: 'robust-overlay',
            type: 'list',
            initial: {
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
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    tracks: {}
  }
}
