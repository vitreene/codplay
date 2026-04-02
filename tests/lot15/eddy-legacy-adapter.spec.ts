import { describe, expect, it } from 'vitest'

import { adaptEddySnapshot, convertEddySnapshotToScene } from '../../src/integration/eddy-legacy-adapter'
import { eddySnapshotManual } from '../../src/integration/fixtures/eddy-snapshot-manual'

describe('Lot 15 - adaptation script animation Eddy', () => {
  it('L15-T1 adapts persos array into converter-compatible input', () => {
    const adapted = adaptEddySnapshot({
      persos: [
        {
          type: 'TEXT',
          initial: { id: 'item-1' },
          actions: { intro: true }
        }
      ],
      eventtimes: {
        0: { name: 'intro' }
      }
    })

    expect(adapted.ok).toBe(true)
    if (!adapted.ok) {
      throw new Error('Expected adaptation to succeed')
    }

    expect(Object.keys(adapted.data.legacyInput.persos)).toEqual(['item-1'])
  })

  it('L15-T2 empty eventtimes is normalized in preview mode', () => {
    const adapted = adaptEddySnapshot({
      persos: [
        {
          type: 'TEXT',
          initial: { id: 'item-1' },
          actions: { intro: true }
        }
      ],
      eventtimes: {}
    })

    expect(adapted.ok).toBe(true)
    if (!adapted.ok) {
      throw new Error('Expected adaptation to succeed')
    }

    expect(adapted.data.warnings.some((warning) => warning.code === 'W_EVENTTIMES_EMPTY_PREVIEW_NORMALIZED')).toBe(true)
    expect(Object.keys(adapted.data.legacyInput.eventtimes as Record<string, unknown>)).toEqual(['0'])
  })

  it('L15-T3 conversion fails on empty eventtimes when preview normalization is disabled', () => {
    const converted = convertEddySnapshotToScene(
      {
        persos: [
          {
            type: 'TEXT',
            initial: { id: 'item-1' },
            actions: { intro: true }
          }
        ],
        eventtimes: {}
      },
      {
        allowEmptyEventtimesPreview: false
      }
    )

    expect(converted.ok).toBe(false)
    if (converted.ok) {
      throw new Error('Expected conversion to fail without preview normalization')
    }

    expect(converted.error.code).toBe('E_NO_EVENTTIMES')
  })

  it('L15-T4 provided Eddy snapshot converts to player scene for manual visual run', () => {
    const converted = convertEddySnapshotToScene(eddySnapshotManual)

    expect(converted.ok).toBe(true)
    if (!converted.ok) {
      throw new Error('Expected provided snapshot to convert')
    }

    expect(converted.data.scene.id).toBe('scene-main')
    expect(converted.data.scene.initialStoryId).toBe('story-main')
    expect(Object.keys(converted.data.scene.stories['story-main']?.items ?? {})).toContain('capsule__1')

    const events = converted.data.scene.tracks?.['track-story-main'] as { events?: Array<{ name: string }> } | undefined
    expect(events?.events).toHaveLength(18)
    expect(events?.events?.[0]?.name).toBe('intro')
    expect(events?.events?.[17]?.name).toBe('__scene_end__')
    expect(converted.data.conversionWarnings.filter((warning) => warning.code === 'W_DUPLICATE_EVENT_SAME_MS_NAME')).toHaveLength(5)
  })
})
