export interface NetworkPreviewApiRequest {
  readonly method: string
  readonly pathname: string
  readonly origin: string | undefined
  readonly requestedMethod: string | undefined
}

/** Allows LAN preview reads and writes to its test-state route only. */
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
  if (testStatePath && originMatches && (isRead || request.method === 'PUT')) return true
  if (request.method !== 'OPTIONS' || !originMatches) return false
  return projectPath && (request.requestedMethod === 'GET' || request.requestedMethod === 'HEAD')
    || testStatePath && (request.requestedMethod === 'GET'
      || request.requestedMethod === 'HEAD' || request.requestedMethod === 'PUT')
}
