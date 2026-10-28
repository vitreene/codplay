import { createActor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'
import { createLearningDocumentCommandService } from '../commands/learning-command-composition'
import { createLearningControllerMachine } from './learning-controller-machine'

describe('Learning controller composition', () => {
  it('uses the command service supplied to its machine factory', () => {
    const documentCommands = createLearningDocumentCommandService()
    const applyCommand = vi.spyOn(documentCommands, 'applyCommand')
    const controller = createActor(createLearningControllerMachine(documentCommands), { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })

    controller.send({ type: 'document.apply', command: { type: 'document.rename', name: 'Composition injectée' } })

    expect(applyCommand).toHaveBeenCalledOnce()
    expect(controller.getSnapshot().context.document.data.name).toBe('Composition injectée')
    controller.stop()
  })
})
