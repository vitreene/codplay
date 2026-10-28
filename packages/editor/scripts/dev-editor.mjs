import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDirectory = resolve(packageDirectory, process.env.EDITOR_DATA_DIRECTORY ?? '.editor-data')
const apiPort = Number(process.env.EDITOR_API_PORT ?? 5182)

await mkdir(dataDirectory, { recursive: true })
let api
let vite
try {
  vite = await createViteServer({
    configFile: resolve(packageDirectory, 'vite.config.ts'),
    root: packageDirectory,
  })
  const { createEditorHttpServer } = await vite.ssrLoadModule('/src/server/editor-http-server.ts')
  api = await createEditorHttpServer({ databaseFile: resolve(dataDirectory, 'editor.sqlite') })
  await listen(api.server, apiPort)
  await vite.listen()
} catch (error) {
  await api?.close()
  await vite?.close()
  throw error
}

vite.printUrls()
process.stdout.write(`API SQLite Editeur disponible sur http://127.0.0.1:${apiPort}\n`)

let closing = false

/** Stops Vite and the local API before Node exits. */
async function shutdown() {
  if (closing) return
  closing = true
  await Promise.all([vite.close(), api.close()])
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

/** Listens on the configured local API port and rejects startup when it is occupied. */
function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
}
