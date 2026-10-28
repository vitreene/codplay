import { createServer, type Server } from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'
import { openEditorDatabase } from './projects/sqlite/editor-database'
import { createEditorSceneApiRouter } from './projects/editor-scene-api-router'
import { SqliteEditorScenePersistence } from './projects/sqlite/sqlite-editor-scene-persistence'

/** Supplies the persistent paths owned by one local Editor server. */
export type EditorHttpServerOptions = Readonly<{ databaseFile: string }>

/** Exposes the local Editor API listener and its asynchronous database cleanup. */
export type EditorHttpServer = Readonly<{ server: Server; close(): Promise<void> }>

/** Creates the local scene API server with one migrated SQLite database connection. */
export async function createEditorHttpServer(options: EditorHttpServerOptions): Promise<EditorHttpServer> {
  const database = await openEditorDatabase(options.databaseFile)
  try {
    const persistence = new SqliteEditorScenePersistence(database)
    const router = createEditorSceneApiRouter(persistence)
    const requestListener = createRequestListener((request) => router.fetch(request))
    const server = createServer((request, response) => requestListener(request, response))
    return {
      server,
      async close() {
        if (server.listening) await closeServer(server)
        await database.close()
      },
    }
  } catch (error) {
    await database.close()
    throw error
  }
}

/** Closes the HTTP listener after active requests finish. */
function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error))
  })
}
