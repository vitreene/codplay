import type { SceneDoc } from '../../player/types'

/**
 * Creates one minimal canary scene used to validate the V1 loading path.
 */
export function createS1CanariScene(): SceneDoc {
  return {
    id: 's1-canari-scene',
    rootStories: ['s1-canari-story'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      's1-canari-story': {
        id: 's1-canari-story',
        entries: ['canari-title'],
        initial: undefined,
        persos: [
          {
            id: 'canari-title',
            type: 'text',
            initial: {
              tag: 'h1',
              content: 'Canari',
              style: {
                color: '#102643'
              }
            },
            actions: {}
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
