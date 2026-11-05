import type { NetworkPreviewApiRequest } from '../../../../core/server/http/network-preview-api-policy'

/** Allows the Quiz Hunt network player to resume and restart its own game state. */
export function isQuizHuntGameStateNetworkPreviewRequestAllowed(
  request: NetworkPreviewApiRequest,
  previewOrigin: string,
): boolean {
  const isGameStatePath = /^\/api\/projects\/[^/]+\/game-state$/.test(request.pathname)
  if (!isGameStatePath || request.origin !== previewOrigin) return false
  if (request.method === 'GET' || request.method === 'HEAD'
    || request.method === 'PUT' || request.method === 'DELETE') return true
  if (request.method !== 'OPTIONS') return false
  return request.requestedMethod === 'GET' || request.requestedMethod === 'HEAD'
    || request.requestedMethod === 'PUT' || request.requestedMethod === 'DELETE'
}
