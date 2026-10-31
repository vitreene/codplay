import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { controllerMachine } from '../../src/app/controller/controller-machine'
import { EditorActionsFacade } from '../../src/app/facades/editor-actions-facade'
import { applyDefaultTextFontSize } from '../../src/app/commands/default-decor-presets'
import type { EditorScene } from '../../src/app/commands/types'

/** Creates a sparse legacy scene whose text source has no authored size. */
function legacyTextScene(): EditorScene {
  return {
    id: 'legacy-text-scene',
    meta: { title: 'Legacy text', durationMs: 5000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items: [{
      id: 'text-item', type: 'text', parentId: null, order: 'a', visible: true,
      contentId: null, initialDecorId: 'text-source',
      keyframes: [{ id: 'text-target-kf', timeMs: 5000, decorId: 'text-target' }],
    }],
    contents: {},
    decors: {
      'text-source': { id: 'text-source', style: { color: 'red' } },
      'text-target': { id: 'text-target', style: { 'font-size': '8cqw' } },
    },
    zones: {},
    markerTracks: {},
  }
}

describe('applyDefaultTextFontSize', () => {
  it('adds the responsive default only to a text item initial decor with no authored font size', () => {
    const scene = legacyTextScene()

    const result = applyDefaultTextFontSize(scene)

    expect(result.decors['text-source']).toEqual({
      id: 'text-source', style: { color: 'red', 'font-size': '3cqw' },
    })
    expect(scene.decors['text-source']).toEqual({ id: 'text-source', style: { color: 'red' } })
    expect(result.decors['text-target']).toBe(scene.decors['text-target'])
    expect(result.items).toBe(scene.items)
  })

  it('preserves explicit style and custom font sizes and returns the same scene when no default is needed', () => {
    const scene = legacyTextScene()
    scene.items.push({
      id: 'explicit-text', type: 'text', parentId: null, order: 'b', visible: true,
      contentId: null, initialDecorId: 'explicit-source', keyframes: [],
    }, {
      id: 'custom-text', type: 'text', parentId: null, order: 'c', visible: true,
      contentId: null, initialDecorId: 'custom-source', keyframes: [],
    })
    scene.decors['explicit-source'] = { id: 'explicit-source', style: { 'font-size': '2cqw' } }
    scene.decors['custom-source'] = { id: 'custom-source', custom: 'font-size: 2cqw;' }

    const result = applyDefaultTextFontSize(scene)

    expect(result.decors['text-source']?.style?.['font-size']).toBe('3cqw')
    expect(result.decors['explicit-source']?.style?.['font-size']).toBe('2cqw')
    expect(result.decors['custom-source']?.custom).toBe('font-size: 2cqw;')
    expect(applyDefaultTextFontSize(result)).toBe(result)
  })
})

describe('EditorActionsFacade.loadScene', () => {
  it('materializes the responsive text default before the scene reaches the controller', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    const actions = new EditorActionsFacade(actor)

    actions.loadScene(legacyTextScene())

    expect(actor.getSnapshot().context.scene?.decors['text-source']?.style?.['font-size']).toBe('3cqw')

    actions.destroy()
    actor.stop()
  })
})
