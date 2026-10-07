import { createRouter } from 'remix/router'
import { ProjectApiController } from './projects/project-api-controller'
import type { ProjectPersistence } from './projects/project-persistence'

/** Creates the server Fetch router and registers the project catalog API. */
export function createElceApiRouter(persistence: ProjectPersistence) {
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
  router.delete('/api/projects/:projectId', ({ params }) => projects.deleteProject(params.projectId!))
  router.put('/api/projects/:projectId/document', ({ request, params }) => projects.saveDocument(request, params.projectId!))

  return router
}
