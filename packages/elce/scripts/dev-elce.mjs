import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'
const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const preferredWebPort = Number(process.env.ELCE_WEB_PORT ?? 5175)
const vite = await createViteServer({
  configFile: resolve(packageDirectory, 'vite.config.ts'),
  root: packageDirectory,
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
})

let server
try {
  const { startElceLocalServer } = await vite.ssrLoadModule('/src/server/elce-local-server.ts')
  server = await startElceLocalServer()
} catch (cause) {
  await vite.close()
  throw cause
}
process.stdout.write(`Interface Elcé disponible sur http://localhost:${server.webPort}\n`)
process.stdout.write(`API Elcé ${server.reusesExistingApi ? 'réutilisée' : 'disponible'} sur http://127.0.0.1:${server.apiPort}\n`)
if (preferredWebPort !== 0 && server.webPort !== preferredWebPort) {
  process.stdout.write(`Le port ${preferredWebPort} est occupé ; ce port de repli utilise une IndexedDB navigateur distincte.\n`)
}

let closing = false

/** Stops the paired local servers and lets Node exit after their resources close. */
async function shutdown() {
  if (closing) return
  closing = true
  await server.close()
  await vite.close()
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())
