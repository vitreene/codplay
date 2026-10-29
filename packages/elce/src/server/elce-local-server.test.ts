import { describe, expect, it } from 'vitest'
import { appearanceFontAssetPath, renderDocumentHtml } from './elce-local-server'

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
