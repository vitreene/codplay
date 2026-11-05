import type { Actor } from 'xstate'
import { createEditorContextProvider } from '../../../core/authoring/editor-context'
import { createQuizHuntControllerMachine } from '../authoring/quiz-hunt-controller'
import type { QuizHuntEditorFacade } from '../authoring/quiz-hunt-editor-facade'

export const QuizHuntEditorContextProvider = createEditorContextProvider<
  Actor<ReturnType<typeof createQuizHuntControllerMachine>>,
  QuizHuntEditorFacade
>()
