import { createRouter } from 'remix/router'
import type { ProjectApiDocument, ProjectApiController } from '../projects/project-api-controller'
import type { MediaApiController } from '../media/media-api-controller'

export type ProjectApiRouter = ReturnType<typeof createRouter>
export type RegisterProjectApiRoutes = (router: ProjectApiRouter) => void

/** Creates the shared project routes and lets the owning module add routes before media. */
export function createProjectApiRouter<Document extends ProjectApiDocument>(
  projects: ProjectApiController<Document>,
  media?: MediaApiController,
  registerBeforeMedia?: RegisterProjectApiRoutes,
) {
  const router = createRouter({
    defaultHandler() {
      return new Response(null, { status: 404 })
    },
  })

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
  registerBeforeMedia?.(router)
  if (media !== undefined) {
    router.put('/api/projects/:projectId/media/:mediaId', ({ request, params }) =>
      media.upload(request, params.projectId!, params.mediaId!))
    router.get('/api/projects/:projectId/media/:mediaId', ({ request, params }) =>
      media.read(request, params.projectId!, params.mediaId!))
  }

  return router
}
