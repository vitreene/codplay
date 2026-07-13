// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SequenceEditorController } from '../../src/sequence-editor/controller'
import { mountSequenceEditor } from '../../src/sequence-editor/mount'
import type { EditorScene } from '../../src/sequence-editor/types'

// jsdom does not implement ResizeObserver (https://github.com/jsdom/jsdom/issues/3368) — a
// no-op stub is enough here, `mountSequenceEditor` only uses it to react to real layout changes,
// which don't occur in a headless test DOM anyway.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
  }
})

function minimalScene(): EditorScene {
  return {
    id: 'scene-1',
    meta: {
      title: 'Scène minimale',
      durationMs: 3000,
      durationSource: 'arbitrary',
      timeUnit: 's',
      capsuleOrder: 'forward',
    },
    items: [
      {
        id: 'item-1',
        type: 'text',
        label: 'Item',
        parentId: null,
        order: 'a',
        visible: true,
        contentId: null,
        initialDecorId: 'decor-1',
        keyframes: [{ id: 'kf-1', timeMs: 0, decorId: 'decor-1' }],
      },
    ],
    contents: {},
    decors: { 'decor-1': { id: 'decor-1' } },
    zones: {},
    markerTracks: {},
  }
}

describe('mountSequenceEditor', () => {
  let container: HTMLElement
  let controller: SequenceEditorController

  afterEach(() => {
    controller?.destroy()
  })

  it('renders the toolbar and the track label for the given scene', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())

    const handle = mountSequenceEditor(container, controller)

    expect(container.querySelector('.seq-toolbar')).not.toBeNull()
    expect(container.querySelector('.seq-timeline')).not.toBeNull()
    expect(container.textContent).toContain('Item')

    handle.destroy()
  })

  it('destroy() empties the container and stops observing', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())

    const handle = mountSequenceEditor(container, controller)
    handle.destroy()

    expect(container.innerHTML).toBe('')
  })

  it('selecting a track only updates the rendered infobar once the central controller echoes it back (§"unicité de la source" — selectTrack alone only emits, never self-applies)', () => {
    container = document.createElement('div')
    const scene = minimalScene()
    controller = new SequenceEditorController(scene)
    const handle = mountSequenceEditor(container, controller)

    // Simule le pont vers le contrôleur central : celui-ci reçoit la demande de sélection et la
    // renvoie par écho (`syncFromCenter`) — c'est ce round-trip, pas `selectTrack` seul, qui met
    // effectivement à jour la sélection lue par le rendu.
    controller.onSelectionRequest((itemIds, keyframeId) => {
      controller.syncFromCenter(scene, { itemIds, keyframeId })
    })

    controller.selectTrack('item-1')
    expect(container.querySelector('.seq-infobar')?.textContent).toContain('Item')

    handle.destroy()
  })

  it('selectTrack alone (no bridge listening) does not change the rendered infobar — confirms it only emits', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())
    const handle = mountSequenceEditor(container, controller)

    controller.selectTrack('item-1')
    expect(container.querySelector('.seq-infobar')?.textContent ?? '').not.toContain('Item')

    handle.destroy()
  })

  it('calls onPlayheadChange when the playhead moves', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())
    const observed: number[] = []

    const handle = mountSequenceEditor(container, controller, { onPlayheadChange: (ms) => observed.push(ms) })
    controller.seek(1200)

    expect(observed).toContain(1200)

    handle.destroy()
  })

  it('does not call onPlayheadChange when unrelated state changes (only on an actual playhead change)', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())
    const observed: number[] = []

    const handle = mountSequenceEditor(container, controller, { onPlayheadChange: (ms) => observed.push(ms) })
    const callsAfterMount = observed.length
    controller.selectTrack('item-1')

    expect(observed.length).toBe(callsAfterMount)

    handle.destroy()
  })
})
