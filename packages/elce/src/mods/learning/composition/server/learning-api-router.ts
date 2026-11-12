import type { MediaApiController } from '../../../../core/server/media/media-api-controller'
import { ProjectApiController } from '../../../../core/server/projects/project-api-controller'
import type { ProjectPersistence } from '../../../../core/server/projects/project-persistence'
import { createProjectApiRouter } from '../../../../core/server/http/project-api-router'
import { LearningDocument } from '../../document/learning-document'
import type { LearningTestStatePersistence } from '../../persistence/server/learning-test-state-persistence'
import { LearningTestStateApiController } from '../../persistence/server/learning-test-state-api-controller'
import { registerLearningTestStateRoutes } from '../../persistence/server/learning-test-state-routes'
import { readIncomingLearningDocument } from '../../persistence/server/learning-project-document-reader'
import { SightyExportApiController } from '../../../../server/export/sighty-export-api-controller'
import { ScormExportApiController } from '../../../../server/export/scorm-export-api-controller'

/** Composes Learning's codecs and routes on the shared project/media router. */
export function createLearningApiRouter(
  persistence: ProjectPersistence<LearningDocument> & LearningTestStatePersistence,
  media?: MediaApiController,
  sightyExport = new SightyExportApiController(),
  scormExport = new ScormExportApiController(),
) {
  const projects = new ProjectApiController(persistence, readIncomingLearningDocument)
  const testState = new LearningTestStateApiController(persistence)
  return createProjectApiRouter(projects, media, (router) => {
    router.post('/api/exports/sighty', ({ request }) => sightyExport.export(request))
    router.post('/api/exports/scorm', ({ request }) => scormExport.export(request))
    registerLearningTestStateRoutes(router, testState)
  })
}
