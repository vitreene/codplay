import type { Actor } from 'xstate'
import { createEditorContextProvider } from '../../../core/authoring/editor-context'
import { learningControllerMachine } from '../authoring/learning-controller-machine'
import type { LearningEditorFacade } from '../authoring/learning-editor-facade'

export const LearningEditorContextProvider = createEditorContextProvider<
  Actor<typeof learningControllerMachine>,
  LearningEditorFacade
>()
