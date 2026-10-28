import { createActor } from 'xstate'
import type { RemixNode } from 'remix/ui'
import { createLearningDocumentStore } from '../persistence/learning-document-store'
import { LearningProjectApiClient } from '../persistence/learning-project-api-client'
import { ProjectHttpTransport } from '../../../core/persistence/project-api/project-http-transport'
import { createLearningControllerMachine } from '../authoring/learning-controller-machine'
import { LearningEditorFacade } from '../authoring/learning-editor-facade'
import { LearningAuthoringService } from '../authoring/learning-authoring-service'
import { createLearningDocumentCommandService } from '../commands/learning-command-composition'
import { LearningProjectSessionCoordinator } from '../persistence/learning-project-session-coordinator'
import { LearningEditorContextProvider } from './learning-editor-context'
import { LearningProjectApplication } from '../authoring/learning-project-application'

export interface LearningAuthoringComposition {
  readonly authoringRoot: RemixNode
  dispose(): Promise<void>
}

/** Builds the current Learning browser composition and owns its actor and project session. */
export async function createLearningAuthoringComposition(): Promise<LearningAuthoringComposition> {
  const documentStore = createLearningDocumentStore()
  try {
    await documentStore.deleteOrphanedMedia()
  } catch (error) {
    console.error('Le nettoyage des médias locaux Elcé a échoué.', error)
  }

  const documentCommands = createLearningDocumentCommandService()
  const projectApi = new LearningProjectApiClient(new ProjectHttpTransport())
  const projectSession = new LearningProjectSessionCoordinator(documentStore, projectApi)
  const controllerMachine = createLearningControllerMachine(documentCommands)
  const controller = createActor(controllerMachine, { input: { documentStore, projectSession } })
  const learningAuthoring = new LearningAuthoringService(documentCommands)
  const editorActions = new LearningEditorFacade(controller, learningAuthoring)
  controller.start()

  await projectSession.attach(controller)
  editorActions.core.bootstrapProjects(projectSession.rememberedProjectId())

  const authoringRoot = <LearningEditorContextProvider controller={controller} actions={editorActions}>
    <div id="elce-remix-route-root">
      <LearningProjectApplication />
    </div>
  </LearningEditorContextProvider>

  return {
    authoringRoot,
    dispose: async () => {
      await projectSession.dispose()
      controller.stop()
    },
  }
}
