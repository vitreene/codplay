import type { SceneDoc } from 'codplay/player/types'

/**
 * Creates one reference scene with one list container and deterministic timeline event.
 */
export function createS2ReferenceScene(): SceneDoc {
  return {
    id: 's2-reference-scene',
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      's2-reference-story': {
        id: 's2-reference-story',
        initial: { move: '@root' },
        persos: [
          {
            id: 'reference-list',
            type: 'list',
            initial: {
              move: '@root',
              className: 'reference-list',
              style: {
                width: '360px',
                minHeight: '180px'
              }
            },
            actions: {
              'sequence:reference:start': {
                className: { add: 'reference-list-live' }
              }
            }
          },
          {
            id: 'reference-title',
            type: 'text',
            initial: {
              tag: 'h2',
              content: 'Reference Scene',
              move: {
                parentId: 'reference-list',
              }
            },
            actions: {
              'sequence:reference:start': {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 400
                  }
                }
              }
            }
          },
          {
            id: 'reference-caption',
            type: 'text',
            initial: {
              tag: 'p',
              content: 'Ready for builder -> player integration.',
              move: {
                parentId: 'reference-list',
              }
            },
            actions: {}
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          {
            name: 'sequence:reference:start',
            startAt: 0
          }
        ]
      }
    },
    tracks: {}
  }
}
