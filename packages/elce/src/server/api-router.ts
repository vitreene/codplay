import { createRouter } from 'remix/router'
import { MediaApiController } from './media/media-api-controller'
import { ProjectApiController } from './projects/project-api-controller'
import { ProjectTestStateApiController } from './projects/project-test-state-api-controller'
import { SightyExportApiController } from './export/sighty-export-api-controller'
import { ScormExportApiController } from './export/scorm-export-api-controller'
import type { ProjectPersistence } from './projects/project-persistence'

/** Creates the server Fetch router and registers the project catalog API. */
export function createElceApiRouter(
  persistence: ProjectPersistence,
  media?: MediaApiController,
  sightyExport = new SightyExportApiController(),
  scormExport = new ScormExportApiController(),
) {
  const router = createRouter({
    defaultHandler() {
      return new Response(null, { status: 404 })
    },
  })
  const projects = new ProjectApiController(persistence)
  const testState = new ProjectTestStateApiController(persistence)

  router.post('/api/exports/sighty', ({ request }) => sightyExport.export(request))
  router.post('/api/exports/scorm', ({ request }) => scormExport.export(request))
  router.get('/api/projects', () => projects.listProjects())
  router.post('/api/projects', ({ request }) => projects.createProject(request))
  router.get('/api/projects/:projectId', ({ params }) => projects.getProject(params.projectId!))
  router.post('/api/projects/:projectId/edit-access', ({ request, params }) => projects.acquireEditAccess(request, params.projectId!))
  router.get('/api/projects/:projectId/edit-access', ({ request, params }) => projects.hasEditAccess(request, params.projectId!))
  router.put('/api/projects/:projectId/edit-access', ({ request, params }) => projects.renewEditAccess(request, params.projectId!))
  router.delete('/api/projects/:projectId/edit-access', ({ request, params }) => projects.releaseEditAccess(request, params.projectId!))
  router.patch('/api/projects/:projectId', ({ request, params }) => projects.renameProject(request, params.projectId!))
  router.delete('/api/projects/:projectId', async ({ request, params }) => {
    const response = await projects.deleteProject(request, params.projectId!)
    if (response.status === 204) await media?.removeUnreferencedFiles()
    return response
  })
  router.put('/api/projects/:projectId/document', async ({ request, params }) => {
    const response = await projects.saveDocument(request, params.projectId!)
    if (response.status === 200) await media?.removeUnreferencedFiles()
    return response
  })
  router.get('/api/projects/:projectId/test-state', ({ params }) => testState.read(params.projectId!))
  router.put('/api/projects/:projectId/test-state', ({ request, params }) => testState.write(request, params.projectId!))
  if (media !== undefined) {
    router.put('/api/projects/:projectId/media/:mediaId', ({ request, params }) =>
      media.upload(request, params.projectId!, params.mediaId!))
    router.get('/api/projects/:projectId/media/:mediaId', ({ request, params }) =>
      media.read(request, params.projectId!, params.mediaId!))
  }

  return router
}
