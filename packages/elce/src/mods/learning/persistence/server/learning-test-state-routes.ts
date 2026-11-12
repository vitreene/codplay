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
  router.put('/api/projects/:projectId/test-state/profile', ({ request, params }) => controller.writeProfile(request, params.projectId!))
  router.delete('/api/projects/:projectId/test-state/profile', ({ request, params }) => controller.clearProfile(request, params.projectId!))
}

/** Allows network preview to save only the profile subresource of Learning test state. */
export function isLearningTestStateNetworkPreviewRequestAllowed(
  request: NetworkPreviewApiRequest,
  previewOrigin: string,
): boolean {
  const isTestStatePath = /^\/api\/projects\/[^/]+\/test-state$/.test(request.pathname)
  const isProfilePath = /^\/api\/projects\/[^/]+\/test-state\/profile$/.test(request.pathname)
  if (request.origin !== previewOrigin) return false
  if (isTestStatePath && (request.method === 'GET' || request.method === 'HEAD')) return true
  if (isProfilePath && (request.method === 'PUT' || request.method === 'DELETE')) return true
  if (request.method !== 'OPTIONS') return false
  return isTestStatePath && (request.requestedMethod === 'GET' || request.requestedMethod === 'HEAD')
    || isProfilePath && (request.requestedMethod === 'PUT' || request.requestedMethod === 'DELETE')
}
