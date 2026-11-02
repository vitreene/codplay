import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appearanceFontAssetPath, renderDocumentHtml, startElceLocalServer } from './elce-local-server'

describe('Elcé local appearance font assets', () => {
  it('maps local font URLs to the existing Remix source mount', () => {
    expect(appearanceFontAssetPath('/fonts/crimson-text/normal-400.ttf'))
      .toBe('/assets/elce/assets/fonts/crimson-text/normal-400.ttf')
    expect(appearanceFontAssetPath('/fonts/dm-sans/italic-700.ttf'))
      .toBe('/assets/elce/assets/fonts/dm-sans/italic-700.ttf')
  })

  it('rejects paths outside the configured local font shape', () => {
    expect(appearanceFontAssetPath('/fonts/../server/elce-local-server.ts')).toBeNull()
    expect(appearanceFontAssetPath('/fonts/crimson-text/OFL.txt')).toBeNull()
    expect(appearanceFontAssetPath('/assets/elce/assets/fonts/crimson-text/normal-400.ttf')).toBeNull()
  })
})

describe('Elcé local server document preloads', () => {
  const entry = {
    href: '/assets/browser-entry.tsx',
    importMap: {},
    preloads: ['/assets/lazy-editor.tsx', '/assets/scroll-container.ts'],
  } as Parameters<typeof renderDocumentHtml>[0]

  it('omits modulepreload hints in development while keeping the entry module', () => {
    const html = renderDocumentHtml(entry, [], 'http://127.0.0.1:5181', null, true)

    expect(html).toContain('id="elce-browser-entry" type="module" src="/assets/browser-entry.tsx"')
    expect(html).not.toContain('rel="modulepreload"')
    expect(html).not.toContain('elce-module-preload-')
  })

  it('keeps modulepreload hints in production', () => {
    const html = renderDocumentHtml(entry, [], 'http://127.0.0.1:5181', null, false)

    expect(html).toContain('id="elce-module-preload-1" rel="modulepreload" href="/assets/lazy-editor.tsx"')
    expect(html).toContain('id="elce-module-preload-2" rel="modulepreload" href="/assets/scroll-container.ts"')
  })
})

describe('Elcé local API reuse', () => {
  it('rejects an old API without local CORS and reuses one that provides it', async () => {
    let supportsLocalCors = false
    const api = createServer((request, response) => {
      if (request.url !== '/api/projects') {
        response.writeHead(404).end()
        return
      }
      if (supportsLocalCors) {
        response.setHeader('Access-Control-Allow-Origin', request.headers.origin ?? '')
        response.setHeader('Vary', 'Origin')
      }
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ projects: [] }))
    })
    api.listen(0, '127.0.0.1')
    await once(api, 'listening')
    const address = api.address()
    if (address === null || typeof address === 'string') throw new Error('Le serveur API de test n’écoute pas en TCP.')

    const dataDirectory = await mkdtemp(join(tmpdir(), 'elce-local-server-'))
    const previousApiPort = process.env.ELCE_API_PORT
    const previousWebPort = process.env.ELCE_WEB_PORT
    const previousDataDirectory = process.env.ELCE_DATA_DIRECTORY

    try {
      process.env.ELCE_API_PORT = String(address.port)
      process.env.ELCE_WEB_PORT = '0'
      process.env.ELCE_DATA_DIRECTORY = dataDirectory
      await expect(startElceLocalServer()).rejects.toThrow(
        'ne fournit pas le contrat Elcé actuel (API ou CORS local)',
      )

      supportsLocalCors = true
      const localServer = await startElceLocalServer()
      try {
        expect(localServer.reusesExistingApi).toBe(true)
      } finally {
        await localServer.close()
      }
    } finally {
      await new Promise<void>((resolveClose, rejectClose) => {
        api.close((error) => error === undefined ? resolveClose() : rejectClose(error))
        api.closeAllConnections()
      })
      delete process.env.ELCE_API_PORT
      if (previousApiPort !== undefined) process.env.ELCE_API_PORT = previousApiPort
      delete process.env.ELCE_WEB_PORT
      if (previousWebPort !== undefined) process.env.ELCE_WEB_PORT = previousWebPort
      delete process.env.ELCE_DATA_DIRECTORY
      if (previousDataDirectory !== undefined) process.env.ELCE_DATA_DIRECTORY = previousDataDirectory
      await rm(dataDirectory, { recursive: true, force: true })
    }
  })
})
