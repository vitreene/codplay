import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { controllerMachine } from './controller-machine'

describe('Elcé controller', () => {
  it('starts with the application ready for a document', () => {
    const actor = createActor(controllerMachine)

    actor.start()

    expect(actor.getSnapshot().value).toBe('ready')
    expect(actor.getSnapshot().context.documentId).toBeNull()

    actor.stop()
  })
})
