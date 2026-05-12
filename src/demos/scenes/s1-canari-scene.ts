import type { SceneDoc } from '../../player/types'

/**
 * Creates one minimal canary scene used to validate the V1 loading path.
 */
export function createS1CanariScene(): SceneDoc {
  return {
    id: 's1-canari-scene',
    initialStoryId: 's1-canari-story',
    stories: {
      's1-canari-story': {
        id: 's1-canari-story',
        items: {
          'canari-title': {
            id: 'canari-title',
            type: 'text',
            initial: {
              id: 'canari-title',
              tag: 'h1',
              content: 'Canari',
              style: {
                color: '#102643'
              }
            },
            actions: {}
          }
        }
      }
    },
    tracks: {}
  }
}
