import type { SceneDoc } from '../../player/types'

/**
 * Creates one reference scene with one list container and deterministic timeline event.
 */
export function createS2ReferenceScene(): SceneDoc {
  return {
    id: 's2-reference-scene',
    initialStoryId: 's2-reference-story',
    stories: {
      's2-reference-story': {
        id: 's2-reference-story',
        items: {
          'reference-list': {
            id: 'reference-list',
            type: 'list',
            initial: {
              id: 'reference-list',
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
          'reference-title': {
            id: 'reference-title',
            type: 'text',
            initial: {
              id: 'reference-title',
              tag: 'h2',
              content: 'Reference Scene',
              move: {
                parentId: 'reference-list',
                mode: 'append'
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
          'reference-caption': {
            id: 'reference-caption',
            type: 'text',
            initial: {
              id: 'reference-caption',
              tag: 'p',
              content: 'Ready for builder -> player integration.',
              move: {
                parentId: 'reference-list',
                mode: 'append'
              }
            },
            actions: {}
          }
        }
      }
    },
    tracks: {
      'track-reference': {
        id: 'track-reference',
        source: 'story',
        order: 0,
        events: [
          {
            id: 'evt-reference-start',
            ms: 0,
            name: 'sequence:reference:start',
            index: 0,
            source: 'story'
          }
        ]
      }
    }
  }
}
