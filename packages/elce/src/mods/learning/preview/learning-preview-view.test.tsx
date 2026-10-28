// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'remix/ui/test'
import { applyDocumentCommand, createDefaultPageCommand } from '../../../domain/commands/document-commands'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { learningDocumentService } from '../document/learning-document-service'
import { LearningProjectApiClient } from '../persistence/learning-project-api-client'
import type { LearningDocumentStore } from '../persistence/learning-document-store'
import type { LearningTestStateApiClient } from '../persistence/learning-test-state-api-client'
import { INITIAL_PROJECT_TEST_STATE } from '../reading/learning-test-state-types'
import type { LearningPlayer } from '../reading/learning-player'
import { LearningPreviewSession } from './learning-preview-session'
import { learningPreviewService } from './learning-preview-service'
import { LearningPreviewView } from './learning-preview-view'

let cleanup: (() => void) | undefined
let openerDescriptor: PropertyDescriptor | undefined

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  vi.useRealTimers()
  if (openerDescriptor === undefined) delete (window as Window & { opener?: Window }).opener
  else Object.defineProperty(window, 'opener', openerDescriptor)
  openerDescriptor = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('Learning preview presentation', () => {
  it('synchronizes an edited page created after the last snapshot', async () => {
    const requests: unknown[] = []
    const opener = { closed: false, postMessage: (message: unknown) => requests.push(message) } as unknown as Window
    setOpener(opener)
    mockPlayer()
    const rendered = render(<LearningPreviewView session={createSession(opener)} />)
    cleanup = rendered.cleanup
    expect(rendered.$('#elce-popup-reader-test-controls-icon')?.classList.contains('lucide-list')).toBe(true)
    expect(rendered.$('#elce-popup-reader-test-controls')?.getAttribute('aria-label'))
      .toBe('Accéder au profil et aux réglages du test auteur')

    const originalDocument = learningDocumentService.createInitialDocument()
    await sendResponse(opener, {
      type: 'snapshot', sessionId: 'reader-session', requestId: 0,
      document: originalDocument.toJSON(), selectedPageId: 'page-a',
    })
    await vi.waitFor(() => expect(rendered.$('#elce-player-stage')?.hidden).toBe(false))

    const newPageCommand = createDefaultPageCommand(originalDocument, { kind: PAGE_LOCATION.SCENARIO })
    const editedDocument = applyDocumentCommand(originalDocument, newPageCommand)
    await rendered.act(() => (rendered.$('#elce-popup-reader-edited-page') as HTMLButtonElement).click())
    expect(requests.at(-1)).toMatchObject({ type: 'show-edited-page', requestId: 1 })
    await sendResponse(opener, {
      type: 'edited-page', sessionId: 'reader-session', requestId: 1, selectedPageId: newPageCommand.pageId,
    })
    expect(requests.at(-1)).toMatchObject({ type: 'synchronize', requestId: 2 })
    await sendResponse(opener, {
      type: 'snapshot', sessionId: 'reader-session', requestId: 2,
      document: editedDocument.toJSON(), selectedPageId: newPageCommand.pageId,
    })
    await vi.waitFor(() => expect(rendered.$('#test-reader-page')?.getAttribute('data-page-id')).toBe(newPageCommand.pageId))
  })

  it('loads a confirmed media URL and never writes preview consultation state', async () => {
    const opener = { closed: false, postMessage: vi.fn() } as unknown as Window
    setOpener(opener)
    mockPlayer()
    const saveTestState = vi.fn(async () => 1)
    const session = createSession(opener, { saveTestState })
    const rendered = render(<LearningPreviewView session={session} />)
    cleanup = rendered.cleanup
    const documentModel = applyDocumentCommand(learningDocumentService.createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-preview-server', name: 'preview.png', mimeType: 'image/png', size: 12, caption: '' },
    })
    await sendResponse(opener, {
      type: 'snapshot', sessionId: 'reader-session', requestId: 0,
      document: documentModel.toJSON(), selectedPageId: documentModel.pages[0]?.id ?? null,
    })

    await vi.waitFor(() => expect(rendered.$('#test-reader-page')?.getAttribute('data-media-source')).toBe(
      new LearningProjectApiClient().mediaUrl(documentModel.id, 'media-preview-server'),
    ))
    expect(saveTestState).not.toHaveBeenCalled()
    expect(session.getView().isNetworkPreview).toBe(false)
  })

  it('reports an orphaned preview without reading a stale local document', async () => {
    setOpener(null)
    const loadSyncState = vi.fn()
    const session = createSession(null, { store: makeStore({ loadSyncState }) })
    const rendered = render(<LearningPreviewView session={session} />)
    cleanup = rendered.cleanup

    await vi.waitFor(() => expect(rendered.$('#elce-popup-reader-error')?.textContent)
      .toBe('La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur.'))
    expect(loadSyncState).not.toHaveBeenCalled()
  })

  it('ends loading when the editor does not answer the initial snapshot request', async () => {
    vi.useFakeTimers()
    const opener = { closed: false, postMessage: vi.fn() } as unknown as Window
    setOpener(opener)
    const rendered = render(<LearningPreviewView session={createSession(opener)} />)
    cleanup = rendered.cleanup

    await rendered.act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(rendered.$('#elce-popup-reader-error')?.textContent)
      .toBe('L’éditeur n’a pas transmis le document. Rouvre la prévisualisation depuis l’éditeur.')
  })
})

/** Builds a preview session with observable Learning adapters for this view test. */
function createSession(
  opener: Window | null,
  overrides: Readonly<{
    store?: LearningDocumentStore
    saveTestState?: LearningTestStateApiClient['saveTestState']
  }> = {},
): LearningPreviewSession {
  const testStateApi = {
    readTestState: vi.fn(async () => ({ state: { ...INITIAL_PROJECT_TEST_STATE, profileEnabled: false }, revision: 0 })),
    saveTestState: overrides.saveTestState ?? vi.fn(async () => 1),
  } as unknown as LearningTestStateApiClient
  return new LearningPreviewSession({
    sessionId: opener === null ? 'orphaned-reader-session' : 'reader-session',
    projectId: null,
    startPageId: 'page-a',
    stage: () => document.getElementById('elce-player-stage'),
    store: overrides.store ?? makeStore(),
    testStateApi,
  })
}

/** Supplies the shared storage methods required by preview media resolution. */
function makeStore(overrides: Readonly<{ loadSyncState?: ReturnType<typeof vi.fn> }> = {}): LearningDocumentStore {
  return {
    loadSyncState: overrides.loadSyncState ?? vi.fn(async (documentId: string) => ({
      documentId, remoteRevision: 0, uploadedMediaIds: ['media-preview-server'], status: 'synced' as const,
    })),
    loadMedia: vi.fn(async () => null),
  } as unknown as LearningDocumentStore
}

/** Replaces only the player instance while retaining the preview session and window path. */
function mockPlayer(): void {
  vi.spyOn(learningPreviewService, 'createPlayer').mockImplementation((stage, props) => ({
    async initialize() {
      const preview = document.createElement('div')
      preview.id = 'test-reader-page'
      preview.dataset.pageId = props.selectedPageId ?? ''
      preview.dataset.mediaSource = Object.values(props.mediaSources)[0] ?? ''
      stage.replaceChildren(preview)
    },
    destroy() { stage.replaceChildren() },
  }) as unknown as LearningPlayer)
}

/** Replaces the popup opener so message responses use the browser event path. */
function setOpener(opener: Window | null): void {
  openerDescriptor = Object.getOwnPropertyDescriptor(window, 'opener')
  Object.defineProperty(window, 'opener', { configurable: true, value: opener })
}

/** Sends one editor response into the mounted preview session. */
function sendResponse(opener: Window, data: unknown): Promise<void> {
  return Promise.resolve(window.dispatchEvent(new MessageEvent('message', {
    origin: window.location.origin,
    source: opener,
    data,
  }))).then(() => new Promise((resolve) => setTimeout(resolve, 0)))
}
