import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'
import { isNetworkPreviewApiRequestAllowed } from '../core/server/http/network-preview-api-policy'
import { createQuizHuntServerComposition } from '../mods/quiz-hunt/composition/server/quiz-hunt-server-composition'
import { isQuizHuntGameStateNetworkPreviewRequestAllowed } from '../mods/quiz-hunt/persistence/server/quiz-hunt-game-state-routes'
import { createLearningServerComposition } from '../mods/learning/composition/server/server-composition'
import { isLearningTestStateNetworkPreviewRequestAllowed } from '../mods/learning/persistence/server/learning-test-state-routes'
import { openElceProjectDatabase } from './elce-project-database'

/** Supplies the filesystem locations owned by one local Elcé server. */
export interface ElceHttpServerOptions {
  readonly databaseFile: string
  readonly mediaDirectory: string
  readonly networkPreviewOrigin?: string
}

/** Exposes the Node listener and its asynchronous resource cleanup. */
export interface ElceHttpServer {
  readonly server: Server
  close(): Promise<void>
}

/** Creates one local HTTP server for the project API and media file routes. */
export async function createElceHttpServer(options: ElceHttpServerOptions): Promise<ElceHttpServer> {
  const database = await openElceProjectDatabase(options.databaseFile)
  try {
    const learning = await createLearningServerComposition({ database, mediaDirectory: options.mediaDirectory })
    const quizHunt = await createQuizHuntServerComposition({ database, mediaDirectory: options.mediaDirectory })
    const requestListener = createRequestListener((request) => {
      const pathname = new URL(request.url).pathname
      if (!pathname.startsWith('/api/quiz-hunt/')) return learning.router.fetch(request)
      return quizHunt.router.fetch(rewriteQuizHuntRequest(request))
    })
    const server = createServer((request, response) => {
      const networkPreviewOrigin = options.networkPreviewOrigin
      if (networkPreviewOrigin !== undefined && !isLoopbackAddress(request.socket.remoteAddress)
        && !isNetworkPreviewApiRequestAllowed({
          method: request.method ?? 'GET',
          pathname: sharedProjectApiPath(new URL(request.url ?? '/', 'http://localhost').pathname),
          origin: request.headers.origin,
          requestedMethod: request.headers['access-control-request-method'],
        }, networkPreviewOrigin, [
          isLearningTestStateNetworkPreviewRequestAllowed,
          isQuizHuntGameStateNetworkPreviewRequestAllowed,
        ])) {
        response.writeHead(403)
        response.end()
        return
      }
      if (answerLocalCors(request, response, networkPreviewOrigin)) return
      requestListener(request, response)
    })

    return {
      server,
      async close() {
        if (server.listening) {
          await new Promise<void>((resolve, reject) => {
            server.close((error) => error === undefined ? resolve() : reject(error))
          })
        }
        await database.close()
      },
    }
  } catch (error) {
    await database.close()
    throw error
  }
}

/** Rewrites the mod namespace to the shared project routes before dispatch. */
function rewriteQuizHuntRequest(request: Request): Request {
  const url = new URL(request.url)
  url.pathname = sharedProjectApiPath(url.pathname)
  return new Request(url, request)
}

/** Maps Quiz Hunt's namespaced project paths to the shared API route shape. */
function sharedProjectApiPath(pathname: string): string {
  return pathname.replace(/^\/api\/quiz-hunt(?=\/|$)/, '/api')
}

/** Handles CORS for local editor requests and the opt-in preview origin. */
function answerLocalCors(
  request: IncomingMessage,
  response: ServerResponse,
  networkPreviewOrigin?: string,
): boolean {
  const origin = request.headers.origin
  const isLoopback = origin !== undefined && isLoopbackOrigin(origin)
  const isNetworkPreview = origin !== undefined && origin === networkPreviewOrigin
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  const isProfileStateRoute = /^\/api\/projects\/[^/]+\/test-state\/profile$/.test(pathname)
  const isQuizHuntGameStateRoute = /^\/api\/quiz-hunt\/projects\/[^/]+\/game-state$/.test(pathname)
  const isAllowedOrigin = isLoopback || isNetworkPreview
  if (isAllowedOrigin && origin !== undefined) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    const allowedMethods = isProfileStateRoute || isQuizHuntGameStateRoute
      ? 'GET, HEAD, PUT, DELETE, OPTIONS'
      : 'GET, HEAD, OPTIONS'
    response.setHeader('Access-Control-Allow-Methods', isNetworkPreview
      ? allowedMethods
      : 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-Match, X-Elce-Page-Id, X-Elce-Edit-Grant')
    response.setHeader('Access-Control-Expose-Headers', 'ETag, Content-Disposition, X-Elce-Scorm-Filename')
    response.setHeader('Access-Control-Max-Age', '600')
    response.setHeader('Vary', 'Origin')
  }
  if (request.method !== 'OPTIONS') return false
  const requestedMethod = request.headers['access-control-request-method']
  const allowedProfilePreflight = isProfileStateRoute
    && (requestedMethod === 'PUT' || requestedMethod === 'DELETE')
  const allowedQuizHuntGameStatePreflight = isQuizHuntGameStateRoute
    && (requestedMethod === 'GET' || requestedMethod === 'HEAD' || requestedMethod === 'PUT' || requestedMethod === 'DELETE')
  const allowedNetworkPreflight = isNetworkPreview
    && (requestedMethod === 'GET' || requestedMethod === 'HEAD' || allowedProfilePreflight || allowedQuizHuntGameStatePreflight)
  response.writeHead(isLoopback || allowedNetworkPreflight ? 204 : 403)
  response.end()
  return true
}

/** Treats IPv4 and IPv6 loopback connections as local editor requests. */
function isLoopbackAddress(address: string | undefined): boolean {
  return address === '127.0.0.1'
    || address === '::1'
    || address?.startsWith('::ffff:127.') === true
}

/** Accepts browser origins on loopback only, keeping this local API private. */
function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return url.origin === origin
      && url.protocol === 'http:'
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
  } catch {
    return false
  }
}
