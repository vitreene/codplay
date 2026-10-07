import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { mkdir, rm } from 'node:fs/promises'
import { createRequestListener } from 'remix/node-fetch-server'
import { createElceApiRouter } from './api-router'
import { MediaApiController } from './media/media-api-controller'
import { createMediaFileStorage, removeUnreferencedMediaFiles } from './media/media-file-storage'
import { openProjectDatabase } from './projects/sqlite/project-database'
import { SqliteProjectPersistence } from './projects/sqlite/sqlite-project-persistence'

/** Supplies the filesystem locations owned by one local Elcé server. */
export interface ElceHttpServerOptions {
  readonly databaseFile: string
  readonly mediaDirectory: string
}

/** Exposes the Node listener and its asynchronous resource cleanup. */
export interface ElceHttpServer {
  readonly server: Server
  close(): Promise<void>
}

/** Creates one local HTTP server for the project API and media file routes. */
export async function createElceHttpServer(options: ElceHttpServerOptions): Promise<ElceHttpServer> {
  const database = await openProjectDatabase(options.databaseFile)

  try {
    const persistence = new SqliteProjectPersistence(database)
    const fileStorage = createMediaFileStorage(options.mediaDirectory)
    const temporaryDirectory = `${options.mediaDirectory}.incoming`
    await rm(temporaryDirectory, { recursive: true, force: true })
    await mkdir(temporaryDirectory, { recursive: true })
    await removeUnreferencedMediaFiles(fileStorage, persistence)
    const media = new MediaApiController(
      persistence,
      fileStorage,
      temporaryDirectory,
    )
    const router = createElceApiRouter(persistence, media)
    const requestListener = createRequestListener((request) => router.fetch(request))
    const server = createServer((request, response) => {
      if (answerLocalCors(request, response)) return
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

/** Handles local-browser CORS for the editor's direct API requests. */
function answerLocalCors(request: IncomingMessage, response: ServerResponse): boolean {
  const origin = request.headers.origin
  const isLocalOrigin = origin !== undefined && isLoopbackOrigin(origin)
  if (isLocalOrigin) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-Match')
    response.setHeader('Access-Control-Expose-Headers', 'ETag')
    response.setHeader('Access-Control-Max-Age', '600')
    response.setHeader('Vary', 'Origin')
  }
  if (request.method !== 'OPTIONS') return false
  response.writeHead(isLocalOrigin ? 204 : 403)
  response.end()
  return true
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
