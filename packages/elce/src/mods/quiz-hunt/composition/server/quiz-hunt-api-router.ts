import type { MediaApiController } from '../../../../core/server/media/media-api-controller'
import { createProjectApiRouter } from '../../../../core/server/http/project-api-router'
import { ProjectApiController } from '../../../../core/server/projects/project-api-controller'
import type { IncomingProjectDocument } from '../../../../core/server/projects/project-api-controller'
import type { ProjectPersistence } from '../../../../core/server/projects/project-persistence'
import { QuizHuntProjectDocument, readQuizHuntDocument } from '../../persistence/quiz-hunt-document-codec'
import type { QuizHuntGameStatePersistence } from '../../persistence/quiz-hunt-game-state-persistence'
import { QuizHuntGameStateApiController } from '../../persistence/server/quiz-hunt-game-state-api-controller'
import { QuizHuntSightyExportApiController } from '../../persistence/server/quiz-hunt-sighty-export-api-controller'
import { QuizHuntScormExportApiController } from '../../persistence/server/quiz-hunt-scorm-export-api-controller'

/** Validates the Quiz Hunt document at the HTTP boundary and wraps its project identity. */
function readIncomingQuizHuntDocument(value: unknown): IncomingProjectDocument<QuizHuntProjectDocument> {
  try {
    return { kind: 'valid', document: new QuizHuntProjectDocument(readQuizHuntDocument(value)) }
  } catch (error) {
    return {
      kind: 'invalid',
      reason: error instanceof Error ? error.message : 'invalid_quiz_hunt_document',
    }
  }
}

/** Composes shared project and media routes with Quiz Hunt's document adapter. */
export function createQuizHuntApiRouter(
  persistence: ProjectPersistence<QuizHuntProjectDocument>,
  media: MediaApiController,
  gameStatePersistence: QuizHuntGameStatePersistence,
) {
  const projects = new ProjectApiController(persistence, readIncomingQuizHuntDocument)
  const gameState = new QuizHuntGameStateApiController(gameStatePersistence)
  const sightyExport = new QuizHuntSightyExportApiController()
  const scormExport = new QuizHuntScormExportApiController()
  return createProjectApiRouter(projects, media, (router) => {
    router.post('/api/exports/sighty', ({ request }) => sightyExport.export(request))
    router.post('/api/exports/scorm', ({ request }) => scormExport.export(request))
    router.get('/api/projects/:projectId/game-state', ({ params }) => gameState.read(params.projectId!))
    router.put('/api/projects/:projectId/game-state', ({ request, params }) => gameState.write(request, params.projectId!))
    router.delete('/api/projects/:projectId/game-state', ({ params }) => gameState.clear(params.projectId!))
  })
}
