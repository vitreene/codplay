import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { runCommand, transaction } from '../../src/app/commands/facade'
import { controllerMachine } from '../../src/app/controller/controller-machine'
import type { EditorScene } from '../../src/app/commands/types'

/** One item with a keyframe at 2 000 ms, enough to exercise commands that can change nothing. */
function scene(): EditorScene {
  return {
    id: 'unchanged',
    meta: { title: 'Unchanged', durationMs: 5000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items: [{
      id: 'item',
      type: 'bloc',
      parentId: null,
      order: 'a',
      visible: true,
      contentId: null,
      initialDecorId: 'decor',
      keyframes: [{ id: 'kf', timeMs: 2000, decorId: 'decor', channel: 'pose' }],
    }],
    contents: {},
    decors: { decor: { id: 'decor', style: { color: 'red' } } },
    zones: {},
    markerTracks: {},
  }
}

describe('commands without effect keep the previous document', () => {
  it('returns the same reference for a keyframe moved to its own time', () => {
    const before = scene()
    const after = runCommand(before, { name: 'moveKeyframe', args: { itemId: 'item', keyframeId: 'kf', timeMs: 2000 } })
    expect(after).toBe(before)
  })

  it('returns the same reference for a decor edit that writes the same values', () => {
    const before = scene()
    const after = runCommand(before, { name: 'setDecor', args: { decorId: 'decor', patch: { style: { color: 'red' } } } })
    expect(after).toBe(before)
  })

  it('returns a new document as soon as one value changes', () => {
    const before = scene()
    const after = runCommand(before, { name: 'moveKeyframe', args: { itemId: 'item', keyframeId: 'kf', timeMs: 2500 } })
    expect(after).not.toBe(before)
    expect(after.items[0]!.keyframes[0]!.timeMs).toBe(2500)
  })

  it('keeps the previous document for a transaction whose commands change nothing', () => {
    const before = scene()
    const after = transaction(before, [
      { name: 'moveKeyframe', args: { itemId: 'item', keyframeId: 'kf', timeMs: 2000 } },
      { name: 'renameKeyframe', args: { itemId: 'item', keyframeId: 'kf', name: null } },
    ])
    expect(after).toBe(before)
  })

  it('does not commit, so nothing is saved or rebuilt, when the controller runs such a command', () => {
    const before = scene()
    const controller = createActor(controllerMachine)
    const committed: unknown[] = []
    controller.on('documentCommitted', (event) => committed.push(event))
    controller.start()
    controller.send({ type: 'SCENE_LOADED', scene: before })
    controller.send({
      type: 'RUN_COMMAND',
      command: { name: 'moveKeyframe', args: { itemId: 'item', keyframeId: 'kf', timeMs: 2000 } },
    })

    expect(committed).toEqual([])
    expect(controller.getSnapshot().context.scene).toBe(before)
  })
})
