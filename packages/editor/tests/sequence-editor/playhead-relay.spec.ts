// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SequenceEditorController } from '../../src/sequence-editor/controller'
import { mountSequenceEditor } from '../../src/sequence-editor/mount'
import type { EditorScene } from '../../src/sequence-editor/types'

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
  }
})

/** An empty scene: only the author playhead matters here. */
function scene(): EditorScene {
  return {
    id: 'playhead-relay',
    meta: { title: 'Relay', durationMs: 5000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items: [],
    contents: {},
    decors: {},
    zones: {},
    markerTracks: {},
  }
}

describe('sequence-editor — author seeks are relayed to the player', () => {
  let controller: SequenceEditorController | undefined
  let mounted: { destroy(): void } | undefined

  afterEach(() => {
    mounted?.destroy()
    controller?.destroy()
    mounted = undefined
    controller = undefined
    document.body.replaceChildren()
  })

  it('relays a seek back to 0 after playback ended, although 0 was the last relayed time', () => {
    controller = new SequenceEditorController(scene())
    const relayed: number[] = []
    const container = document.createElement('div')
    document.body.append(container)
    mounted = mountSequenceEditor(container, controller, { onPlayheadChange: (timeMs) => relayed.push(timeMs) })
    expect(relayed).toEqual([0])

    // Playback ran to the end and its time was adopted without any seek being relayed.
    controller.reconcilePlaybackTime(5000)
    expect(relayed).toEqual([0])

    // The author goes back to 0 (a ghost click, a scrub): the player is at 5 000 and must move.
    controller.seek(0)
    expect(relayed).toEqual([0, 0])
  })

  it('does not relay the time a pause adopted from the player, which is already presented', () => {
    controller = new SequenceEditorController(scene())
    const relayed: number[] = []
    const container = document.createElement('div')
    document.body.append(container)
    mounted = mountSequenceEditor(container, controller, { onPlayheadChange: (timeMs) => relayed.push(timeMs) })

    controller.reconcilePlaybackTime(2300)
    controller.seek(2300)
    expect(relayed).toEqual([0])
  })
})
