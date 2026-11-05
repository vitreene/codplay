import { createActor } from 'xstate'
import type { RemixNode } from 'remix/component'
import { createQuizHuntControllerMachine } from '../authoring/quiz-hunt-controller'
import { QuizHuntEditorFacade } from '../authoring/quiz-hunt-editor-facade'
import { createQuizHuntDocumentStore } from '../persistence/quiz-hunt-document-store'
import { createQuizHuntProjectSessionCoordinator } from '../persistence/quiz-hunt-project-session-coordinator'
import { QuizHuntEditorContextProvider } from './quiz-hunt-editor-context'
import { QuizHuntProjectApplication } from '../authoring/quiz-hunt-project-application'

export interface QuizHuntAuthoringComposition {
  readonly authoringRoot: RemixNode
  dispose(): Promise<void>
}

/** Builds the Quiz Hunt browser composition over the shared project session and actor. */
export async function createQuizHuntAuthoringComposition(): Promise<QuizHuntAuthoringComposition> {
  const documentStore = createQuizHuntDocumentStore()
  try {
    await documentStore.deleteOrphanedMedia()
  } catch (error) {
    console.error('Le nettoyage des médias locaux Quiz Hunt a échoué.', error)
  }

  const projectSession = createQuizHuntProjectSessionCoordinator(documentStore)
  const controller = createActor(createQuizHuntControllerMachine(), { input: { documentStore, projectSession } })
  const actions = new QuizHuntEditorFacade(controller)
  controller.start()

  await projectSession.attach(controller)
  actions.core.bootstrapProjects(projectSession.rememberedProjectId())

  const authoringRoot = <QuizHuntEditorContextProvider controller={controller} actions={actions}>
    <div id="quiz-hunt-remix-route-root">
      <QuizHuntProjectApplication />
    </div>
  </QuizHuntEditorContextProvider>

  return {
    authoringRoot,
    dispose: async () => {
      await projectSession.dispose()
      controller.stop()
    },
  }
}
