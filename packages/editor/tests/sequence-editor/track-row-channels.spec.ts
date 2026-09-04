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

/** Builds an item with two explicit temporal channels and one pose KF carrying decoration. */
function dualChannelScene(): EditorScene {
  return {
    id: 'dual-channel-row',
    meta: {
      title: 'Dual channel row',
      durationMs: 2000,
      durationSource: 'arbitrary',
      timeUnit: 'ms',
      capsuleOrder: 'forward',
    },
    items: [{
      id: 'item-1',
      type: 'text',
      label: 'Item',
      parentId: null,
      order: 'a',
      visible: true,
      contentId: null,
      initialDecorId: 'decor-a',
      keyframes: [
        { id: 'kf-a', timeMs: 0, decorId: 'decor-a', channel: 'pose' },
        { id: 'kf-c', timeMs: 1000, decorId: 'decor-c', channel: 'decor' },
        { id: 'kf-b', timeMs: 2000, decorId: 'decor-b', channel: 'pose' },
      ],
    }],
    contents: {},
    decors: {
      'decor-a': { id: 'decor-a', style: { color: 'white' } },
      'decor-c': { id: 'decor-c', style: { color: 'red' } },
      'decor-b': { id: 'decor-b', style: { color: 'green' } },
    },
    zones: {},
    markerTracks: {},
  }
}

/** Returns the y coordinates encoded by one timeline diamond polygon. */
function polygonYCoordinates(handle: SVGGElement): number[] {
  return (handle.querySelector('polygon')?.getAttribute('points') ?? '')
    .split(' ')
    .map((point) => Number(point.split(',')[1]))
}

describe('sequence-editor — lanes pose/décor sur une seule row', () => {
  let controller: SequenceEditorController | undefined
  let handle: { destroy(): void } | undefined

  afterEach(() => {
    handle?.destroy()
    controller?.destroy()
    handle = undefined
    controller = undefined
    document.body.replaceChildren()
  })

  it('sépare les deux lanes sans dupliquer un KF pose qui porte aussi du décor', () => {
    controller = new SequenceEditorController(dualChannelScene())
    const container = document.createElement('div')
    document.body.append(container)
    handle = mountSequenceEditor(container, controller)

    const row = container.querySelector<HTMLElement>('.seq-row[data-track-id="item-1"]')!
    expect(row.dataset.dualChannel).toBe('true')
    expect(row.querySelectorAll('.seq-row__channel-divider')).toHaveLength(1)
    expect(row.querySelectorAll('[data-kf-id="kf-a"]')).toHaveLength(1)
    expect(row.querySelectorAll('[data-kf-id="kf-b"]')).toHaveLength(1)
    expect(row.querySelectorAll('[data-kf-id="kf-c"]')).toHaveLength(1)

    const rowHeight = Number.parseFloat(row.style.height)
    const decorY = polygonYCoordinates(row.querySelector<SVGGElement>('[data-kf-id="kf-c"]')!)
    const poseY = polygonYCoordinates(row.querySelector<SVGGElement>('[data-kf-id="kf-a"]')!)
    expect(decorY.every((value) => value < rowHeight / 2)).toBe(true)
    expect(poseY.every((value) => value > rowHeight / 2)).toBe(true)
    expect(row.querySelectorAll('.seq-row__segment--decor')).toHaveLength(2)
    expect(row.querySelectorAll('.seq-row__segment--pose')).toHaveLength(1)
  })

  it('garde une row unique sans séparation lorsqu’un seul canal est présent', () => {
    const scene = dualChannelScene()
    scene.items[0] = {
      ...scene.items[0]!,
      keyframes: scene.items[0]!.keyframes
        .filter((keyframe) => keyframe.channel === 'pose')
        .map((keyframe) => ({ ...keyframe, channel: undefined })),
    }
    controller = new SequenceEditorController(scene)
    const container = document.createElement('div')
    document.body.append(container)
    handle = mountSequenceEditor(container, controller)

    const row = container.querySelector<HTMLElement>('.seq-row[data-track-id="item-1"]')!
    expect(row.dataset.dualChannel).toBeUndefined()
    expect(row.querySelector('.seq-row__channel-divider')).toBeNull()
    expect(row.querySelectorAll('.seq-row__segment')).toHaveLength(1)
    expect(polygonYCoordinates(row.querySelector<SVGGElement>('[data-kf-id="kf-a"]')!).every((value) => (
      value > 0 && value < Number.parseFloat(row.style.height)
    ))).toBe(true)
  })
})
