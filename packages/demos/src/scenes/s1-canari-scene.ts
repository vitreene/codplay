import type { SceneDoc } from 'codplay/player/types'

/**
 * Creates one minimal canary scene used to validate the V1 loading path.
 */
export function createS1CanariScene(): SceneDoc {
  return {
    id: 's1-canari-scene',
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      's1-canari-story': {
        id: 's1-canari-story',
        initial: { move: '@root' },
        persos: [
          {
            id: 'canari-title',
            type: 'text',
            initial: {
              tag: 'h1',
              move: '@root',
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
    tracks: {}
  }
}
