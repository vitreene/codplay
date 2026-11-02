import type { ProjectApiRouter } from '../../../../core/server/http/project-api-router'
import type { NetworkPreviewApiRequest } from '../../../../core/server/http/network-preview-api-policy'
import type { LearningTestStateApiController } from './learning-test-state-api-controller'

/** Adds Learning's separate consultation-state routes to the shared project router. */
export function registerLearningTestStateRoutes(
  router: ProjectApiRouter,
  controller: LearningTestStateApiController,
): void {
  router.get('/api/projects/:projectId/test-state', ({ params }) => controller.read(params.projectId!))
  router.put('/api/projects/:projectId/test-state', ({ request, params }) => controller.write(request, params.projectId!))
}

/** Allows network preview to read Learning state and denies every mutation. */
export function isLearningTestStateNetworkPreviewRequestAllowed(
  request: NetworkPreviewApiRequest,
  previewOrigin: string,
): boolean {
  const isTestStatePath = /^\/api\/projects\/[^/]+\/test-state$/.test(request.pathname)
  if (!isTestStatePath || request.origin !== previewOrigin) return false
  if (request.method === 'GET' || request.method === 'HEAD') return true
  return request.method === 'OPTIONS'
    && (request.requestedMethod === 'GET' || request.requestedMethod === 'HEAD')
}
