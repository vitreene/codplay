import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import { csMachine } from '../src/machine'

describe('selection-frame machine', () => {
  it('starts idle and activates on NODE_APPEARED', () => {
    const actor = createActor(csMachine)
    actor.start()

    expect(actor.getSnapshot().matches('idle')).toBe(true)
    actor.send({ type: 'NODE_APPEARED' })
    expect(actor.getSnapshot().matches({ active: 'still' })).toBe(true)
  })

  it('suspends on NODE_DISAPPEARED and reactivates on NODE_APPEARED', () => {
    const actor = createActor(csMachine)
    actor.start()
    actor.send({ type: 'NODE_APPEARED' })

    actor.send({ type: 'NODE_DISAPPEARED' })
    expect(actor.getSnapshot().matches('suspended')).toBe(true)

    actor.send({ type: 'NODE_APPEARED' })
    expect(actor.getSnapshot().matches({ active: 'still' })).toBe(true)
  })

  it('enters dragging only when move capability is active and enabled', () => {
    const actor = createActor(csMachine)
    actor.start()
    actor.send({ type: 'NODE_APPEARED' })

    actor.send({ type: 'DRAG_START' })
    expect(actor.getSnapshot().matches({ active: 'dragging' })).toBe(true)
    actor.send({ type: 'DRAG_END' })

    actor.send({ type: 'OPERATION_ENABLED_CHANGED', op: 'move', enabled: false })
    actor.send({ type: 'DRAG_START' })
    expect(actor.getSnapshot().matches({ active: 'still' })).toBe(true)

    actor.send({ type: 'OPERATION_ENABLED_CHANGED', op: 'move', enabled: true })
    actor.send({ type: 'DRAG_START' })
    expect(actor.getSnapshot().matches({ active: 'dragging' })).toBe(true)
  })

  it('blocks gestures whose capability is absent from the preset', () => {
    const actor = createActor(csMachine)
    actor.start()
    actor.send({ type: 'NODE_APPEARED' })
    actor.send({ type: 'PRESET_APPLIED', preset: { name: 'move-only', capabilities: ['move'] } })

    actor.send({ type: 'RESIZE_START' })
    expect(actor.getSnapshot().matches({ active: 'still' })).toBe(true)

    actor.send({ type: 'ROTATE_START' })
    expect(actor.getSnapshot().matches({ active: 'still' })).toBe(true)

    actor.send({ type: 'DRAG_START' })
    expect(actor.getSnapshot().matches({ active: 'dragging' })).toBe(true)
  })

  it('blocks all gestures when the cs is inactive', () => {
    const actor = createActor(csMachine)
    actor.start()
    actor.send({ type: 'NODE_APPEARED' })
    actor.send({ type: 'CS_ACTIVE_CHANGED', active: false })

    actor.send({ type: 'DRAG_START' })
    expect(actor.getSnapshot().matches({ active: 'still' })).toBe(true)

    actor.send({ type: 'CS_ACTIVE_CHANGED', active: true })
    actor.send({ type: 'DRAG_START' })
    expect(actor.getSnapshot().matches({ active: 'dragging' })).toBe(true)
  })

  it('tracks part visibility in context', () => {
    const actor = createActor(csMachine)
    actor.start()

    actor.send({ type: 'VISIBILITY_CHANGED', part: 'cs', visible: false })
    expect(actor.getSnapshot().context.csVisible).toBe(false)
    expect(actor.getSnapshot().context.elementVisible).toBe(true)

    actor.send({ type: 'VISIBILITY_CHANGED', part: 'element', visible: false })
    expect(actor.getSnapshot().context.elementVisible).toBe(false)
  })
})
