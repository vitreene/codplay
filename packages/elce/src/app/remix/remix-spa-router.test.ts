// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { run } from 'remix/spa'
import { createElceSpaRouter } from './remix-spa-router'

vi.mock('../../infrastructure/indexed-db/document-store', () => ({
  IndexedDbDocumentStore: class {
    /** Keeps the router test independent of browser storage initialization. */
    public async loadDocument() {
      return null
    }

    /** Supplies an empty synchronization record for the popup route. */
    public async loadSyncState(documentId: string) {
      return { documentId, remoteRevision: 0, uploadedMediaIds: [], status: 'synced' as const }
    }
  },
}))

describe('Elcé Remix SPA route', () => {
  let dispose: (() => void) | undefined

  afterEach(() => {
    dispose?.()
    dispose = undefined
    document.body.replaceChildren()
    window.history.replaceState(null, '', '/')
  })

  it('renders the native popup reader without mounting the author application', async () => {
    window.history.replaceState(null, '', '/?elce-preview-session=preview-1&elce-preview-page=page-a')
    const app = run(createElceSpaRouter(null, null))
    dispose = () => app.dispose()
    await app.ready()

    expect(document.querySelector('#elce-popup-reader')).not.toBeNull()
    expect(document.querySelector('#elce-popup-reader-sync')).not.toBeNull()
    expect(document.querySelector('#elce-remix-route-root')).not.toBeNull()
    expect(document.querySelector('#elce-remix-project-app')).toBeNull()
  })
})
