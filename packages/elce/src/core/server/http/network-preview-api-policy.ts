export interface NetworkPreviewApiRequest {
  readonly method: string
  readonly pathname: string
  readonly origin: string | undefined
  readonly requestedMethod: string | undefined
}

export type NetworkPreviewApiExtension = (
  request: NetworkPreviewApiRequest,
  previewOrigin: string,
) => boolean

/** Allows LAN preview reads while keeping project state and resources read-only. */
export function isNetworkPreviewApiRequestAllowed(
  request: NetworkPreviewApiRequest,
  previewOrigin: string,
  extensions: readonly NetworkPreviewApiExtension[] = [],
): boolean {
  const originMatches = request.origin === previewOrigin
  const projectPath = /^\/api\/projects\/[^/]+$/.test(request.pathname)
  const mediaPath = /^\/api\/projects\/[^/]+\/media\/[^/]+$/.test(request.pathname)
  const isRead = request.method === 'GET' || request.method === 'HEAD'
  if (isRead && projectPath && originMatches) return true
  if (isRead && mediaPath && (originMatches || request.origin === undefined)) return true
  if (request.method === 'OPTIONS' && originMatches
    && projectPath && (request.requestedMethod === 'GET' || request.requestedMethod === 'HEAD')) return true
  return extensions.some((extension) => extension(request, previewOrigin))
}
