import type { SceneDoc } from '../../player/types'

/**
 * Creates one robustness scene with two lists and one transferable card perso.
 */
export function createS3RobustesseScene(): SceneDoc {
  return {
    id: 's3-robustesse-scene',
    initialStoryId: 's3-robustesse-story',
    stories: {
      's3-robustesse-story': {
        id: 's3-robustesse-story',
        items: {
          'robust-stage': {
            id: 'robust-stage',
            type: 'list',
            initial: {
              id: 'robust-stage',
              className: 'robust-stage'
            },
            actions: {}
          },
          'robust-overlay': {
            id: 'robust-overlay',
            type: 'list',
            initial: {
              id: 'robust-overlay',
              className: 'robust-overlay'
            },
            actions: {}
          },
          'robust-card': {
            id: 'robust-card',
            type: 'text',
            initial: {
              id: 'robust-card',
              tag: 'div',
              content: 'CARD',
              move: {
                parentId: 'robust-stage',
                mode: 'append'
              }
            },
            actions: {
              'sequence:robustesse:promote': {
                move: {
                  parentId: 'robust-overlay',
                  mode: 'append',
                  flipMode: 'overlay-world'
                }
              },
              'sequence:robustesse:return': {
                move: {
                  parentId: 'robust-stage',
                  mode: 'append',
                  flipMode: 'overlay-world'
                }
              }
            }
          }
        }
      }
    },
    tracks: {}
  }
}
