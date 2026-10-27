export interface NetworkPreviewApiRequest {
  readonly method: string
  readonly pathname: string
  readonly origin: string | undefined
  readonly requestedMethod: string | undefined
}

/** Allows LAN preview reads while keeping project state and resources read-only. */
export function isNetworkPreviewApiRequestAllowed(
  request: NetworkPreviewApiRequest,
  previewOrigin: string,
): boolean {
  const originMatches = request.origin === previewOrigin
  const projectPath = /^\/api\/projects\/[^/]+$/.test(request.pathname)
  const mediaPath = /^\/api\/projects\/[^/]+\/media\/[^/]+$/.test(request.pathname)
  const testStatePath = /^\/api\/projects\/[^/]+\/test-state$/.test(request.pathname)
  const isRead = request.method === 'GET' || request.method === 'HEAD'
  if (isRead && projectPath && originMatches) return true
  if (isRead && mediaPath && (originMatches || request.origin === undefined)) return true
  if (testStatePath && originMatches && isRead) return true
  if (request.method !== 'OPTIONS' || !originMatches) return false
  return projectPath && (request.requestedMethod === 'GET' || request.requestedMethod === 'HEAD')
    || testStatePath && (request.requestedMethod === 'GET'
      || request.requestedMethod === 'HEAD')
}
