// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { run } from 'remix/spa'
import { createElceSpaRouter } from './remix-spa-router'
import { createLearningPreviewComposition } from '../../mods/learning/composition/preview-composition'

vi.mock('../../mods/learning/persistence/learning-document-store', () => ({
  createLearningDocumentStore: () => ({
    async loadSyncState(documentId: string) { return { documentId, remoteRevision: null, uploadedMediaIds: [], status: 'pending' as const } },
  }),
}))

describe('Elcé Remix SPA route', () => {
  let dispose: (() => void) | undefined
  let openerDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    if (document.body === null) document.documentElement.append(document.createElement('body'))
  })

  afterEach(() => {
    dispose?.()
    dispose = undefined
    if (openerDescriptor === undefined) delete (window as Window & { opener?: Window }).opener
    else Object.defineProperty(window, 'opener', openerDescriptor)
    openerDescriptor = undefined
    document.body?.replaceChildren()
    if (document.body === null) document.documentElement.append(document.createElement('body'))
    window.history.replaceState(null, '', '/')
  })

  it('renders the preview root without mounting the author application', async () => {
    openerDescriptor = Object.getOwnPropertyDescriptor(window, 'opener')
    Object.defineProperty(window, 'opener', { configurable: true, value: null })
    window.history.replaceState(null, '', '/?elce-preview-session=preview-1&elce-preview-page=page-a')
    const previewComposition = createLearningPreviewComposition(new URLSearchParams(window.location.search))
    const app = run(createElceSpaRouter({
      authoringRoot: '<div id="elce-authoring-root"></div>',
      previewRoot: previewComposition.root,
    }))
    dispose = () => { app.dispose(); void previewComposition.dispose() }
    await app.ready()

    expect(document.querySelector('#elce-popup-reader')).not.toBeNull()
    expect(document.querySelector('#elce-popup-reader-sync')).not.toBeNull()
    expect(document.querySelector('#elce-remix-route-root')).not.toBeNull()
    expect(document.querySelector('#elce-authoring-root')).toBeNull()
    expect(document.querySelector('#elce-remix-project-app')).toBeNull()
  })

  it('renders the authoring root across chooser and mod-specific document routes', async () => {
    const router = createElceSpaRouter({
      authoringRoot: '<div id="elce-authoring-root"></div>',
      previewRoot: null,
    })

    for (const path of ['/', '/new', '/learning/project-a', '/hunt/project-b']) {
      const response = await router.fetch(`http://elce.test${path}`)
      expect(response.status).toBe(200)
    }
  })
})
