import { describe, expect, it } from 'vitest'
import { renderDocumentHtml } from './elce-local-server'

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
