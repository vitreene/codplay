import { resolve, dirname } from 'node:path'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const networkPreviewEnabled = process.env.ELCE_NETWORK_PREVIEW === '1'

if (networkPreviewEnabled) {
  const networkAddress = findLanIpv4Address()
  const webPort = Number(process.env.ELCE_WEB_PORT ?? 5175)

  process.env.ELCE_NETWORK_HOST = networkAddress
  process.env.ELCE_WEB_HOST ??= '0.0.0.0'
  process.env.ELCE_API_HOST ??= '0.0.0.0'
  process.env.ELCE_PREVIEW_ORIGIN = `http://${networkAddress}:${webPort}`
}

if (process.env.REMIX_NODE_HMR !== '1') {
  const { run } = await import('remix/node-hmr')
  run(fileURLToPath(import.meta.url), {
    cwd: packageDirectory,
    watch: {
      ignore: ['**/node_modules/**', '**/.git/**', '**/.elce-data/**', '**/dist/**', '**/coverage/**'],
      poll: true,
      pollInterval: 250,
    },
  })
} else {
  const { createServer: createViteServer } = await import('vite')
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
  if (networkPreviewEnabled) {
    process.stdout.write(`Preview mobile Elcé disponible sur ${process.env.ELCE_PREVIEW_ORIGIN}\n`)
  }
  const apiOrigin = networkPreviewEnabled
    ? `http://${process.env.ELCE_NETWORK_HOST}:${server.apiPort}`
    : `http://127.0.0.1:${server.apiPort}`
  process.stdout.write(`API Elcé ${server.reusesExistingApi ? 'réutilisée' : 'disponible'} sur ${apiOrigin}\n`)
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
}

/** Selects the active private IPv4 address used for the mobile preview link. */
function findLanIpv4Address() {
  const interfaces = Object.entries(networkInterfaces())
    .flatMap(([interfaceName, addresses]) => (addresses ?? [])
      .filter((address) => address.family === 'IPv4' && !address.internal && isPrivateIpv4(address.address))
      .map((address) => ({ interfaceName, address: address.address })))
    .sort((left, right) => Number(right.interfaceName === 'en0') - Number(left.interfaceName === 'en0'))
  const networkAddress = interfaces[0]?.address
  if (networkAddress === undefined) {
    throw new Error('Aucune adresse IPv4 privée active pour la preview réseau Elcé.')
  }
  return networkAddress
}

/** Recognizes RFC 1918 IPv4 addresses and excludes link-local interfaces. */
function isPrivateIpv4(address) {
  return address.startsWith('10.')
    || address.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(address)
}
