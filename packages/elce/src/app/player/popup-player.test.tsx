// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { render } from 'remix/ui/test'
import { applyDocumentCommand, createDefaultPageCommand } from '../../domain/commands/document-commands'
import { PAGE_LOCATION } from '../../config/document-config'
import { createInitialDocument } from '../../domain/document/document-model'
import { IndexedDbDocumentStore } from '../../infrastructure/indexed-db/document-store'
import { ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import { PopupPlayer } from './popup-player'

vi.mock('../../infrastructure/indexed-db/document-store', () => ({
  IndexedDbDocumentStore: class {
    /** Supplies no media because the test documents contain only text. */
    public async loadMedia() {
      return null
    }

    /** Leaves the persisted fallback unused while the editor handshake responds. */
    public async loadDocument() {
      return null
    }

    /** Reports the one fixture media as confirmed by the local upload coordinator. */
    public async loadSyncState(documentId: string) {
      return { documentId, remoteRevision: 0, uploadedMediaIds: ['media-preview-server'], status: 'synced' as const }
    }
  },
}))

vi.mock('./player-preview', async (importOriginal) => {
  const original = await importOriginal<typeof import('./player-preview')>()
  return {
    ...original,
    /** Exposes the active player page while the synchronization boundary is tested. */
    createPlayerPreviewComposition: vi.fn((stage: HTMLElement, props: {
      selectedPageId: string | null
      mediaSources: Readonly<Record<string, string>>
    }) => ({
      async initialize() {
        const preview = document.createElement('div')
        preview.id = 'test-reader-page'
        preview.dataset.pageId = props.selectedPageId ?? ''
        preview.dataset.mediaSource = Object.values(props.mediaSources)[0] ?? ''
        stage.replaceChildren(preview)
      },
      destroy() {
        stage.replaceChildren()
      },
    })),
  }
})

let openerDescriptor: PropertyDescriptor | undefined

describe('Remix popup reader synchronization controls', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    vi.useRealTimers()
    if (openerDescriptor === undefined) delete (window as Window & { opener?: Window }).opener
    else Object.defineProperty(window, 'opener', openerDescriptor)
    openerDescriptor = undefined
    vi.restoreAllMocks()
  })

  it('synchronizes automatically when the edited page was created after the last snapshot', async () => {
    const requests: unknown[] = []
    const opener = { closed: false, postMessage: (message: unknown) => requests.push(message) } as unknown as Window
    setOpener(opener)
    const rendered = render(<PopupPlayer
      sessionId="reader-session"
      startPageId="page-a"
    />)
    cleanup = rendered.cleanup
    expect(rendered.$('#elce-popup-reader-test-controls-icon')?.classList.contains('lucide-list')).toBe(true)
    expect(rendered.$('#elce-popup-reader-test-controls')?.getAttribute('aria-label'))
      .toBe('Accéder au profil et aux réglages du test auteur')
    expect(rendered.$('#elce-popup-reader-test-controls .elce-popup-reader__action-label')?.textContent)
      .toBe('Test auteur')

    const originalDocument = createInitialDocument()
    await rendered.act(() => dispatchResponse(opener, {
      type: 'snapshot',
      sessionId: 'reader-session',
      requestId: 0,
      document: originalDocument.toJSON(),
      selectedPageId: 'page-a',
    }))
    await vi.waitFor(() => expect(rendered.$('#test-reader-page')?.getAttribute('data-page-id')).toBe('page-a'))

    const newPageCommand = createDefaultPageCommand(originalDocument, { kind: PAGE_LOCATION.SCENARIO })
    const editedDocument = applyDocumentCommand(originalDocument, newPageCommand)
    await rendered.act(() => (rendered.$('#elce-popup-reader-edited-page') as HTMLButtonElement | null)?.click())
    expect(requests.at(-1)).toMatchObject({ type: 'show-edited-page', requestId: 1 })

    await rendered.act(() => dispatchResponse(opener, {
      type: 'edited-page',
      sessionId: 'reader-session',
      requestId: 1,
      selectedPageId: newPageCommand.pageId,
    }))
    expect(requests.at(-1)).toMatchObject({ type: 'synchronize', requestId: 2 })

    await rendered.act(() => dispatchResponse(opener, {
      type: 'snapshot',
      sessionId: 'reader-session',
      requestId: 2,
      document: editedDocument.toJSON(),
      selectedPageId: newPageCommand.pageId,
    }))
    await vi.waitFor(() => expect(rendered.$('#test-reader-page')?.getAttribute('data-page-id')).toBe(newPageCommand.pageId))
  })

  it('loads uploaded media from its stable server URL after its local Blob is removed', async () => {
    const opener = { closed: false, postMessage: vi.fn() } as unknown as Window
    setOpener(opener)
    const rendered = render(<PopupPlayer
      sessionId="reader-session"
      startPageId="page-a"
    />)
    cleanup = rendered.cleanup

    const documentModel = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-preview-server', name: 'preview.png', mimeType: 'image/png', size: 12, caption: '' },
    })
    await rendered.act(() => dispatchResponse(opener, {
      type: 'snapshot',
      sessionId: 'reader-session',
      requestId: 0,
      document: documentModel.toJSON(),
      selectedPageId: documentModel.pages[0]?.id ?? null,
    }))

    await vi.waitFor(() => {
      expect(rendered.$('#test-reader-page')?.getAttribute('data-media-source')).toBe(
        new ElceProjectApiClient().mediaUrl(documentModel.id, 'media-preview-server'),
      )
    })
  })

  it('explains that an orphaned preview must be reopened without loading a stale local document', async () => {
    const loadDocument = vi.spyOn(IndexedDbDocumentStore.prototype, 'loadDocument')
      .mockRejectedValueOnce(new Error('Version de document Elcé non supportée : 4'))
    setOpener(null)
    const rendered = render(<PopupPlayer
      sessionId="orphaned-reader-session"
      startPageId="page-a"
    />)
    cleanup = rendered.cleanup

    await vi.waitFor(() => {
      expect(rendered.$('#elce-popup-reader-error')?.textContent)
        .toBe('La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur.')
    })
    expect(loadDocument).not.toHaveBeenCalled()
    expect(rendered.$('#elce-popup-reader')?.textContent).not.toContain('Chargement de la lecture…')
  })

  it('ends the loading state when the editor does not answer the initial snapshot request', async () => {
    vi.useFakeTimers()
    const loadDocument = vi.spyOn(IndexedDbDocumentStore.prototype, 'loadDocument')
      .mockRejectedValueOnce(new Error('Version de document Elcé non supportée : 4'))
    const opener = { closed: false, postMessage: vi.fn() } as unknown as Window
    setOpener(opener)
    const rendered = render(<PopupPlayer
      sessionId="unanswered-reader-session"
      startPageId="page-a"
    />)
    cleanup = rendered.cleanup

    await rendered.act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    expect(rendered.$('#elce-popup-reader-error')?.textContent)
      .toBe('L’éditeur n’a pas transmis le document. Rouvre la prévisualisation depuis l’éditeur.')
    expect(loadDocument).not.toHaveBeenCalled()
    expect(rendered.$('#elce-popup-reader')?.textContent).not.toContain('Chargement de la lecture…')
  })
})

/** Replaces the popup opener so message responses can be sent through the browser event path. */
function setOpener(opener: Window | null): void {
  openerDescriptor = Object.getOwnPropertyDescriptor(window, 'opener')
  Object.defineProperty(window, 'opener', { configurable: true, value: opener })
}

/** Sends one response from the editor window to the independent popup runtime. */
function dispatchResponse(opener: Window, data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', {
    origin: window.location.origin,
    source: opener,
    data,
  }))
}
