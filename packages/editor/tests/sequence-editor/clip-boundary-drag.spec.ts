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

function capsuleScene(): EditorScene {
  return {
    id: 'capsule-boundaries',
    meta: { title: 'Capsule', durationMs: 10000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items: [{
      id: 'capsule',
      type: 'capsule',
      label: 'Capsule',
      parentId: null,
      order: 'a',
      visible: true,
      contentId: null,
      initialDecorId: 'decor',
      keyframes: [
        { id: 'entry', timeMs: 1000, decorId: 'decor', name: 'intro' },
        { id: 'exit', timeMs: 5000, decorId: 'decor', name: 'outro' },
      ],
      capsule: { kind: 'rangee', distribution: { mode: 'sequential' } },
    }],
    contents: {},
    decors: { decor: { id: 'decor' } },
    zones: {},
    markerTracks: {},
  }
}

describe('sequence-editor — glisser une borne de capsule', () => {
  let controller: SequenceEditorController | undefined
  let mounted: { destroy(): void } | undefined

  afterEach(() => {
    mounted?.destroy()
    controller?.destroy()
    mounted = undefined
    controller = undefined
    document.body.replaceChildren()
  })

  it('route le pointerdown du losange vers le KF visé, sans démarrer le tracé de plage', () => {
    controller = new SequenceEditorController(capsuleScene())
    const container = document.createElement('div')
    document.body.append(container)
    mounted = mountSequenceEditor(container, controller)

    const exitDiamond = container.querySelector<SVGPolygonElement>('.seq-row[data-track-id="capsule"] [data-kf-id="exit"] polygon')!
    exitDiamond.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))

    expect(controller.getSnapshot().value).toBe('dragging-keyframe')
    expect(controller.getSnapshot().context.interaction).toMatchObject({
      kind: 'dragging-keyframe',
      trackId: 'capsule',
      keyframeId: 'exit',
    })
  })
})
