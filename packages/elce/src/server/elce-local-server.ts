import { createServer, type IncomingMessage, type Server } from 'node:http'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAssetServer } from 'remix/assets'
import { uiHmr } from 'remix/ui-hmr/assets'
import { createRouter } from 'remix/router'
import { createRequestListener } from 'remix/node-fetch-server'
import { DEFAULT_ELCE_API_ORIGIN, ELCE_API_PORT } from '../config/api-config'
import { createElceHttpServer } from './elce-http-server'

const ELCE_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const MONOREPO_ROOT = resolve(ELCE_PACKAGE_ROOT, '../..')
const ASSET_BASE_PATH = '/assets'
const BROWSER_ENTRY = 'packages/elce/src/app/remix/browser-entry.tsx'
const STYLE_FILES = [
  'packages/elce/src/app/layout/app-layout.css',
  'packages/elce/src/app/editor/card/card-editor.css',
  'packages/elce/src/app/editor/carousel/carousel-editor.css',
  'packages/elce/src/app/editor/statistical-graph/statistical-graph.css',
  'packages/elce/src/app/player/popup-player.css',
] as const

const BROWSER_PACKAGES = [
  'remix',
  'xstate',
  'codplay',
  '@codplay/sighty',
  '@codplay/component-v2',
  '@codplay/capsule-automation',
  '@codplay/exclusive-sync',
  '@codplay/scene-factory',
  '@tiptap/core',
  '@tiptap/extension-subscript',
  '@tiptap/extension-superscript',
  '@tiptap/extension-text-align',
  '@tiptap/pm',
  '@tiptap/starter-kit',
  'lucide-static',
]

/** Owns the paired local Remix interface server and Elcé project API. */
export interface ElceLocalServer {
  readonly webServer: Server
  readonly webPort: number
  readonly apiPort: number
  readonly reusesExistingApi: boolean
  close(): Promise<void>
}

/** Starts the Remix asset server and the existing project API on their local ports. */
export async function startElceLocalServer(): Promise<ElceLocalServer> {
  const preferredWebPort = Number(process.env.ELCE_WEB_PORT ?? 5175)
  const preferredApiPort = Number(process.env.ELCE_API_PORT ?? ELCE_API_PORT)
  const networkPreviewEnabled = process.env.ELCE_NETWORK_PREVIEW === '1'
  const networkPreviewOrigin = networkPreviewEnabled ? process.env.ELCE_PREVIEW_ORIGIN : undefined
  if (networkPreviewEnabled && networkPreviewOrigin === undefined) {
    throw new Error('La preview réseau Elcé doit recevoir une origine LAN configurée.')
  }
  const webHost = process.env.ELCE_WEB_HOST ?? (networkPreviewEnabled ? '0.0.0.0' : 'localhost')
  const apiHost = process.env.ELCE_API_HOST ?? (networkPreviewEnabled ? '0.0.0.0' : '127.0.0.1')
  const dataDirectory = resolve(ELCE_PACKAGE_ROOT, process.env.ELCE_DATA_DIRECTORY ?? '.elce-data')
  await mkdir(dataDirectory, { recursive: true })

  const isDevelopment = (process.env.NODE_ENV ?? 'development') === 'development'
  const enableHmr = isDevelopment && process.env.REMIX_NODE_HMR === '1'
  const assets = createAssetServer({
    rootDir: MONOREPO_ROOT,
    basePath: ASSET_BASE_PATH,
    mounts: {
      elce: 'packages/elce/src',
      codplay: 'packages/codplay/src',
      sighty: 'packages/sighty/src',
      component: 'packages/authoring/component-v2/src',
      sceneFactory: 'packages/authoring/scene-factory/src',
      capsuleAutomation: 'packages/authoring/capsule-automation/src',
      exclusiveSync: 'packages/authoring/exclusive-sync/src',
      vendor: 'node_modules',
    },
    allowFiles: [
      'packages/elce/src/**',
      'packages/codplay/src/**',
      'packages/sighty/src/**',
      'packages/authoring/component-v2/src/**',
      'packages/authoring/scene-factory/src/**',
      'packages/authoring/capsule-automation/src/**',
      'packages/authoring/exclusive-sync/src/**',
    ],
    denyFiles: ['packages/elce/src/**/*.test.*', 'packages/elce/src/server/**'],
    allowPackages: BROWSER_PACKAGES,
    hmr: enableHmr
      ? {
          channel: createReloadingBrowserHmrChannel,
          moduleImporter: 'remix/multiple-import-maps-polyfill',
        }
      : undefined,
    scripts: { loaders: enableHmr ? [uiHmr()] : undefined },
    sourceMaps: isDevelopment ? 'external' : undefined,
    minify: !isDevelopment,
    watch: enableHmr ? { poll: true, pollInterval: 250 } : false,
  })

  let api: Awaited<ReturnType<typeof createElceHttpServer>> | null = null
  let webServer: Server | null = null
  try {
    const entry = await assets.getScriptEntry(BROWSER_ENTRY)
    const styles = await Promise.all(STYLE_FILES.map((styleFile) => assets.getHref(styleFile)))
    const apiStart = await startOrReuseApi(preferredApiPort, dataDirectory, apiHost, networkPreviewOrigin)
    api = apiStart.server
    const apiPort = apiStart.port
    const router = createRouter({
      defaultHandler({ request }) {
        const path = new URL(request.url).pathname
        if (path === ASSET_BASE_PATH || path.startsWith(`${ASSET_BASE_PATH}/`)) {
          return serveAsset(assets, request)
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
        }
        const apiOrigin = apiOriginForRequest(request, apiPort, networkPreviewOrigin)
        const documentHtml = renderDocumentHtml(entry, styles, apiOrigin, networkPreviewOrigin ?? null)
        return new Response(request.method === 'HEAD' ? null : documentHtml, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        })
      },
    })

    const requestListener = createRequestListener((request) => router.fetch(request))
    webServer = createServer((request, response) => {
      if (networkPreviewOrigin !== undefined && !isLoopbackAddress(request.socket.remoteAddress)
        && !isNetworkPreviewRequest(request, networkPreviewOrigin)) {
        response.writeHead(404)
        response.end()
        return
      }
      requestListener(request, response)
    })
    const webPort = await listenOnNextPort(webServer, preferredWebPort, webHost, networkPreviewEnabled ? 1 : 10)
    if (enableHmr) {
      const { emitServerReady } = await import('remix/node-hmr/runtime')
      emitServerReady()
    }

    let closed = false
    return {
      webServer,
      webPort,
      apiPort,
      reusesExistingApi: apiStart.reusesExistingApi,
      async close() {
        if (closed) return
        closed = true
        await Promise.all([
          closeServer(webServer!),
          api?.close() ?? Promise.resolve(),
          assets.close(),
        ])
      },
    }
  } catch (cause) {
    await Promise.all([
      webServer === null ? Promise.resolve() : closeServer(webServer),
      api?.close() ?? Promise.resolve(),
      assets.close(),
    ])
    throw cause
  }
}

/** Routes Remix asset changes through the existing channel as browser reloads. */
async function createReloadingBrowserHmrChannel() {
  const { createBrowserHmrChannel } = await import('remix/node-hmr/runtime')
  const channel = await createBrowserHmrChannel()
  return {
    url: channel.url,
    close: () => channel.close(),
    updateWatchedFiles: (delta: Parameters<typeof channel.updateWatchedFiles>[0]) => channel.updateWatchedFiles(delta),
    onFileEvents(handler: Parameters<typeof channel.onFileEvents>[0]) {
      return channel.onFileEvents(async (events) => {
        const updates = await handler(events)
        return updates.length > 0 ? [{ type: 'reload' as const }] : []
      })
    },
  }
}

/** Reuses an active Elcé API or starts the project API on its configured port. */
async function startOrReuseApi(
  port: number,
  dataDirectory: string,
  host: string,
  networkPreviewOrigin: string | undefined,
): Promise<{ readonly server: Awaited<ReturnType<typeof createElceHttpServer>> | null; readonly port: number; readonly reusesExistingApi: boolean }> {
  if (port !== 0 && !(await isPortAvailable(port, '127.0.0.1'))) {
    if (networkPreviewOrigin !== undefined) {
      throw new Error(`Le port API ${port} est déjà occupé. Arrête le serveur local actuel avant de lancer la preview réseau.`)
    }
    if (!(await isElceApiAvailable(port))) {
      throw new Error(`Le port API ${port} est occupé par un service qui ne répond pas à l’API Elcé.`)
    }
    return { server: null, port, reusesExistingApi: true }
  }

  const server = await createElceHttpServer({
    databaseFile: resolve(dataDirectory, 'elce.sqlite'),
    mediaDirectory: resolve(dataDirectory, 'media'),
    networkPreviewOrigin,
  })
  try {
    const actualPort = await listen(server.server, port, host)
    return { server, port: actualPort, reusesExistingApi: false }
  } catch (cause) {
    await server.close()
    if (networkPreviewOrigin === undefined && isAddressInUse(cause) && await isElceApiAvailable(port)) {
      return { server: null, port, reusesExistingApi: true }
    }
    throw cause
  }
}

/** Checks whether the preferred local port accepts a temporary listener. */
async function isPortAvailable(port: number, host: string): Promise<boolean> {
  const probe = createServer()
  try {
    await listen(probe, port, host)
    await closeServer(probe)
    return true
  } catch (cause) {
    if (isAddressInUse(cause)) return false
    throw cause
  }
}

/** Recognizes the local Elcé API without reading or changing its project data. */
async function isElceApiAvailable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/projects`, {
      signal: AbortSignal.timeout(1500),
    })
    if (!response.ok) return false
    const body: unknown = await response.json()
    return typeof body === 'object' && body !== null
      && Array.isArray((body as { readonly projects?: unknown }).projects)
  } catch {
    return false
  }
}

/** Resolves the browser API origin without sending a mobile client to its own loopback. */
function apiOriginForRequest(request: Request, apiPort: number, networkPreviewOrigin: string | undefined): string {
  if (process.env.VITE_ELCE_API_ORIGIN !== undefined) return process.env.VITE_ELCE_API_ORIGIN
  const requestHost = request.headers.get('host')
  if (networkPreviewOrigin !== undefined && requestHost !== null) {
    const requestHostname = new URL(`http://${requestHost}`).hostname
    const networkHostname = new URL(networkPreviewOrigin).hostname
    if (requestHostname === networkHostname) return `http://${networkHostname}:${apiPort}`
  }
  return apiPort === ELCE_API_PORT ? DEFAULT_ELCE_API_ORIGIN : `http://127.0.0.1:${apiPort}`
}

/** Allows LAN requests only for the configured preview document and its assets. */
function isNetworkPreviewRequest(request: IncomingMessage, previewOrigin: string): boolean {
  const previewUrl = new URL(previewOrigin)
  if (request.headers.host !== previewUrl.host) return false
  const requestUrl = new URL(request.url ?? '/', previewOrigin)
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  if (requestUrl.pathname === ASSET_BASE_PATH || requestUrl.pathname.startsWith(`${ASSET_BASE_PATH}/`)) return true
  return requestUrl.pathname === '/' && requestUrl.searchParams.has('elce-preview-project')
}

/** Treats IPv4 and IPv6 loopback connections as local editor requests. */
function isLoopbackAddress(address: string | undefined): boolean {
  return address === '127.0.0.1'
    || address === '::1'
    || address?.startsWith('::ffff:127.') === true
}

/** Tries the preferred interface port and increments it only when already occupied. */
async function listenOnNextPort(server: Server, preferredPort: number, host: string, attempts = 10): Promise<number> {
  attempts = preferredPort === 0 ? 1 : attempts
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const port = preferredPort === 0 ? 0 : preferredPort + attempt
    try {
      return await listen(server, port, host)
    } catch (cause) {
      if (!isAddressInUse(cause) || attempt === attempts - 1) throw cause
    }
  }
  throw new Error('Aucun port local disponible pour l’interface Elcé.')
}

/** Recognizes the address-in-use error raised by Node when another listener owns a port. */
function isAddressInUse(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'EADDRINUSE'
}

/** Serves one browser asset through the configured Remix asset boundary. */
async function serveAsset(assets: ReturnType<typeof createAssetServer>, request: Request): Promise<Response> {
  return await assets.fetch(request) ?? new Response(null, { status: 404 })
}

/** Creates the Remix SPA document with its runtime import map and native stylesheets. */
function renderDocumentHtml(
  entry: Awaited<ReturnType<ReturnType<typeof createAssetServer>['getScriptEntry']>>,
  styles: readonly string[],
  apiOrigin: string,
  previewOrigin: string | null,
): string {
  const styleLinks = styles.map((href, index) =>
    `<link id="elce-style-${index + 1}" rel="stylesheet" href="${escapeHtmlAttribute(href)}">`,
  ).join('\n    ')
  const importMap = escapeInlineScript(JSON.stringify(entry.importMap))
  const browserApiOrigin = escapeInlineScript(JSON.stringify(apiOrigin))
  const browserPreviewOrigin = escapeInlineScript(JSON.stringify(previewOrigin))
  const preloads = entry.preloads.map((href, index) =>
    `<link id="elce-module-preload-${index + 1}" rel="modulepreload" href="${escapeHtmlAttribute(href)}">`,
  ).join('\n    ')

  return `<!doctype html>
<html id="elce-document" lang="fr">
  <head id="elce-document-head">
    <meta id="elce-document-charset" charset="UTF-8">
    <meta id="elce-document-viewport" name="viewport" content="width=device-width, initial-scale=1.0">
    <title id="elce-document-title">Elcé — éditeur</title>
    ${styleLinks}
    <script id="elce-import-map" type="importmap">${importMap}</script>
    <script id="elce-api-configuration">window.__ELCE_API_ORIGIN__ = ${browserApiOrigin}; window.__ELCE_PREVIEW_ORIGIN__ = ${browserPreviewOrigin};</script>
    ${preloads}
  </head>
  <body id="elce-document-body">
    <div id="elce-app"></div>
    <script id="elce-browser-entry" type="module" src="${escapeHtmlAttribute(entry.href)}"></script>
  </body>
</html>`
}

/** Escapes data embedded in an inline script element. */
function escapeInlineScript(value: string): string {
  return value
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

/** Escapes a value used in an HTML attribute. */
function escapeHtmlAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

/** Waits for a local HTTP server to start listening or reject its startup error. */
function listen(server: Server, port: number, host: string): Promise<number> {
  return new Promise((resolveListen, rejectListen) => {
    const handleError = (cause: Error): void => {
      server.off('listening', handleListening)
      rejectListen(cause)
    }
    const handleListening = (): void => {
      server.off('error', handleError)
      const address = server.address()
      if (address === null || typeof address === 'string') {
        rejectListen(new Error('Le serveur Elcé n’écoute pas sur un port TCP.'))
        return
      }
      resolveListen(address.port)
    }
    server.once('error', handleError)
    server.once('listening', handleListening)
    server.listen(port, host)
  })
}

/** Closes an HTTP server and releases keep-alive connections during shutdown. */
function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve()
  return new Promise((resolveClose, rejectClose) => {
    server.close((cause) => cause === undefined ? resolveClose() : rejectClose(cause))
    server.closeAllConnections()
  })
}
