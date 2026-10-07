import { createRouter } from 'remix/router'
import { MediaApiController } from './media/media-api-controller'
import { ProjectApiController } from './projects/project-api-controller'
import type { ProjectPersistence } from './projects/project-persistence'

/** Creates the server Fetch router and registers the project catalog API. */
export function createElceApiRouter(persistence: ProjectPersistence, media?: MediaApiController) {
  const router = createRouter({
    defaultHandler() {
      return new Response(null, { status: 404 })
    },
  })
  const projects = new ProjectApiController(persistence)

  router.get('/api/projects', () => projects.listProjects())
  router.post('/api/projects', ({ request }) => projects.createProject(request))
  router.get('/api/projects/:projectId', ({ params }) => projects.getProject(params.projectId!))
  router.patch('/api/projects/:projectId', ({ request, params }) => projects.renameProject(request, params.projectId!))
  router.delete('/api/projects/:projectId', async ({ params }) => {
    const response = await projects.deleteProject(params.projectId!)
    if (response.status === 204) await media?.removeUnreferencedFiles()
    return response
  })
  router.put('/api/projects/:projectId/document', async ({ request, params }) => {
    const response = await projects.saveDocument(request, params.projectId!)
    if (response.status === 200) await media?.removeUnreferencedFiles()
    return response
  })
  if (media !== undefined) {
    router.put('/api/projects/:projectId/media/:mediaId', ({ request, params }) =>
      media.upload(request, params.projectId!, params.mediaId!))
    router.get('/api/projects/:projectId/media/:mediaId', ({ request, params }) =>
      media.read(request, params.projectId!, params.mediaId!))
  }

  return router
}
