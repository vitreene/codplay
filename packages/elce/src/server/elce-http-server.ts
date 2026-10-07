import { createServer } from 'node:http'
import type { Server } from 'node:http'
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
    const server = createServer(createRequestListener((request) => router.fetch(request)))

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
