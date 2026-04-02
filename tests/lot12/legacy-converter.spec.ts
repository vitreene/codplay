import { describe, expect, it } from 'vitest'

import { convertLegacyToV1, type LegacyInput } from '../../src/legacy-converter/convert-legacy-to-v1'

/**
 * Creates a deterministic legacy fixture for converter tests.
 */
function createLegacyFixture(): LegacyInput {
  return {
    persos: {
      'capsule-key': {
        type: 'LIST',
        initial: {
          id: 'capsule-main',
          className: 'capsule',
          style: {
            order: 1
          }
        },
        actions: {
          intro: true
        }
      },
      'item-key': {
        type: 'TEXT',
        initial: {
          id: 'item-a',
          move: 'capsule-main',
          style: {
            order: 2
          }
        },
        actions: {
          intro: {
            style: {
              opacity: {
                from: 0,
                to: 1,
                duration: 300
              }
            }
          }
        },
        media: {
          src: '/audio/voice.mp3'
        }
      }
    },
    eventtimes: new Map([
      [460, [{ name: 'intro' }, { name: 'intro' }, { name: 'outro' }]],
      [120, { name: 'boot' }]
    ])
  }
}

describe('Lot 12 - convertisseur legacy outillage', () => {
  it('L12-T1 same input always yields same output JSON', () => {
    const input = createLegacyFixture()
    const first = convertLegacyToV1(input)
    const second = convertLegacyToV1(input)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })

  it('L12-T2 events are sorted by ms and assigned monotonic indexes', () => {
    const result = convertLegacyToV1({
      persos: {
        title: {
          type: 'TEXT',
          initial: { id: 'title' },
          actions: {}
        }
      },
      eventtimes: new Map([
        [100, [{ name: 'e-b' }, { name: 'e-c' }]],
        [40, { name: 'e-a' }]
      ])
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected conversion to succeed')
    }

    const events = result.data.scene.tracks['track-story-main'].events
    expect(events.map((event) => event.name)).toEqual(['e-a', 'e-b', 'e-c'])
    expect(events.map((event) => event.index)).toEqual([0, 1, 2])
  })

  it('L12-T3 duplicate events (ms,name) are deduped with warning', () => {
    const result = convertLegacyToV1({
      persos: {
        title: {
          type: 'TEXT',
          initial: { id: 'title' },
          actions: {}
        }
      },
      eventtimes: {
        460: [{ name: 'intro' }, { name: 'intro' }, { name: 'intro' }]
      }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected conversion to succeed')
    }

    expect(result.data.scene.tracks['track-story-main'].events).toHaveLength(1)
    expect(result.data.conversion.warnings.filter((warning) => warning.code === 'W_DUPLICATE_EVENT_SAME_MS_NAME')).toHaveLength(2)
  })

  it('L12-T4 missing initial parent creates synthetic list container', () => {
    const result = convertLegacyToV1({
      persos: {
        'item-key': {
          type: 'TEXT',
          initial: {
            id: 'item-a',
            move: 'container-scene'
          },
          actions: {}
        }
      },
      eventtimes: {
        0: { name: 'intro' }
      }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected conversion to succeed')
    }

    const items = result.data.scene.stories['story-main'].items
    expect(items['container-scene']).toMatchObject({
      id: 'container-scene',
      type: 'list'
    })
    expect(items['container-scene']?.children).toEqual(['item-a'])
    expect(result.data.conversion.warnings.some((warning) => warning.code === 'W_PARENT_SYNTHETIC_CREATED')).toBe(true)
  })

  it('L12-T5 action.move with auto payload is preserved as-is', () => {
    const result = convertLegacyToV1({
      persos: {
        parent: {
          type: 'LIST',
          initial: { id: 'parent' },
          actions: {}
        },
        child: {
          type: 'TEXT',
          initial: { id: 'child', move: 'parent' },
          actions: {
            intro: {
              move: {
                mode: 'auto'
              }
            }
          }
        }
      },
      eventtimes: {
        0: { name: 'intro' }
      }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected conversion to succeed')
    }

    const movePayload = result.data.scene.stories['story-main'].items.child.actions.intro.move
    expect(movePayload).toEqual({ mode: 'auto' })
  })

  it('L12-T6 conversion always builds story-main and minimal scenario graph', () => {
    const result = convertLegacyToV1(createLegacyFixture())

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected conversion to succeed')
    }

    expect(result.data.scene.stories['story-main']).toBeDefined()
    expect(result.data.scene.scenario).toEqual({
      initialNodeId: 'node-main',
      nodes: {
        'node-main': {
          id: 'node-main',
          storyRef: {
            storyId: 'story-main',
            instanceId: 'story-main#1'
          },
          transitions: []
        }
      }
    })
  })
})
