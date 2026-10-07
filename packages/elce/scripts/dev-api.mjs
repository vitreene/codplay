import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDirectory = resolve(packageDirectory, process.env.ELCE_DATA_DIRECTORY ?? '.elce-data')
const vite = await createViteServer({
  configFile: resolve(packageDirectory, 'vite.config.ts'),
  root: packageDirectory,
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
})

let api
try {
  const [{ createElceHttpServer }, { ELCE_API_PORT }] = await Promise.all([
    vite.ssrLoadModule('/src/server/elce-http-server.ts'),
    vite.ssrLoadModule('/src/config/api-config.ts'),
  ])
  const port = Number(process.env.ELCE_API_PORT ?? ELCE_API_PORT)
  const mediaDirectory = resolve(dataDirectory, 'media')
  await mkdir(dataDirectory, { recursive: true })
  api = await createElceHttpServer({
    databaseFile: resolve(dataDirectory, 'elce.sqlite'),
    mediaDirectory,
  })

  await new Promise((resolveListen, rejectListen) => {
    api.server.once('error', rejectListen)
    api.server.listen(port, '127.0.0.1', () => {
      api.server.off('error', rejectListen)
      resolveListen()
    })
  })
  process.stdout.write(`API Elcé disponible sur http://127.0.0.1:${port}\n`)
  process.stdout.write(`Base SQLite : ${resolve(dataDirectory, 'elce.sqlite')}\n`)
  process.stdout.write(`Médias : ${mediaDirectory}\n`)
} catch (error) {
  await api?.close()
  await vite.close()
  throw error
}

let closing = false
async function closeServer() {
  if (closing) return
  closing = true
  await api.close()
  await vite.close()
}

process.once('SIGINT', () => void closeServer())
process.once('SIGTERM', () => void closeServer())
