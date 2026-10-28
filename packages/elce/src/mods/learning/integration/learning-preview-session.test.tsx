// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest'
import { render } from 'remix/ui/test'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { applyDocumentCommand, createDefaultPageCommand, createQuestionBdcCommand } from '../../../domain/commands/document-commands'
import { learningDocumentService } from '../document/learning-document-service'
import { INITIAL_PROJECT_TEST_STATE } from '../reading/learning-test-state-types'
import { LearningTestStateApiClient } from '../persistence/learning-test-state-api-client'
import type { LearningDocumentStore } from '../persistence/learning-document-store'
import { LearningPreviewSession } from '../preview/learning-preview-session'
import { LearningPreviewView } from '../preview/learning-preview-view'
import { learningPreviewService } from '../preview/learning-preview-service'

let cleanup: (() => void) | undefined
let openerDescriptor: PropertyDescriptor | undefined

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  if (openerDescriptor === undefined) delete (window as Window & { opener?: Window }).opener
  else Object.defineProperty(window, 'opener', openerDescriptor)
  openerDescriptor = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

it('keeps preview state local, preserves the reader page on reset, and uses the edited page on synchronization', async () => {
  const initial = learningDocumentService.createInitialDocument()
  const page = createDefaultPageCommand(initial, { kind: PAGE_LOCATION.SCENARIO }, 'Cache question')
  let model = applyDocumentCommand(initial, page)
  model = applyDocumentCommand(model, createQuestionBdcCommand('cache-question', page.pageId, 1))
  model = applyDocumentCommand(model, {
    type: 'summary.settings.update',
    summary: { ...model.data.summary, pageContinuationMode: 'free' },
  })
  const calls: { type: string; requestId: number }[] = []
  const opener = { closed: false, postMessage: (message: { type: string; requestId: number }) => calls.push(message) } as unknown as Window
  openerDescriptor = Object.getOwnPropertyDescriptor(window, 'opener')
  Object.defineProperty(window, 'opener', { configurable: true, value: opener })
  vi.spyOn(LearningTestStateApiClient.prototype, 'readTestState').mockResolvedValue({
    state: { ...INITIAL_PROJECT_TEST_STATE, profileEnabled: false }, revision: 0,
  })
  const saved = vi.spyOn(LearningTestStateApiClient.prototype, 'saveTestState').mockImplementation(async (_projectId, _state, revision) => revision + 1)

  const store = {
    async loadSyncState(documentId: string) { return { documentId, uploadedMediaIds: [], remoteRevision: 0, status: 'pending' as const } },
    async loadMedia() { return null },
  } as unknown as LearningDocumentStore
  const session = new LearningPreviewSession({
    sessionId: 'cache-fixture',
    projectId: null,
    startPageId: 'page-a',
    stage: () => document.getElementById('elce-player-stage'),
    store,
  })
  const rendered = render(<LearningPreviewView session={session} />)
  cleanup = rendered.cleanup
  await rendered.act(() => window.dispatchEvent(new MessageEvent('message', {
    origin: window.location.origin,
    source: opener,
    data: { type: 'snapshot', sessionId: 'cache-fixture', requestId: 0, document: model.toJSON(), selectedPageId: 'page-a' },
  })))
  await vi.waitFor(() => expect(rendered.$('.elce-player-title')?.textContent).toBe('Page A'))

  await rendered.act(() => (rendered.$(`.elce-player-menu__page-button[data-page-id="${page.pageId}"]`) as HTMLButtonElement).click())
  await vi.waitFor(() => expect(rendered.$('.elce-player-title')?.textContent).toBe('Cache question'))
  const inputs = () => Array.from(document.querySelectorAll<HTMLInputElement>('.elce-card--question input'))
  await vi.waitFor(() => expect(inputs()).toHaveLength(2))
  await rendered.act(() => inputs()[0]?.click())
  await vi.waitFor(() => expect((rendered.$('.elce-question-validate') as HTMLButtonElement).disabled).toBe(false))
  await rendered.act(() => (rendered.$('.elce-question-validate') as HTMLButtonElement).click())
  await vi.waitFor(() => expect(inputs().every((input) => input.disabled)).toBe(true))
  expect(saved).not.toHaveBeenCalled()
  await rendered.act(() => (rendered.$('#elce-popup-reader-test-controls') as HTMLButtonElement).click())
  await rendered.act(() => (rendered.$('#elce-popup-reader-reset-progress') as HTMLButtonElement).click())
  await vi.waitFor(() => {
    expect(rendered.$('.elce-player-title')?.textContent).toBe('Cache question')
    expect(inputs()).toHaveLength(2)
    expect(inputs().every((input) => !input.disabled && !input.checked)).toBe(true)
  })

  await rendered.act(() => (rendered.$('#elce-popup-reader-sync') as HTMLButtonElement).click())
  const request = calls.at(-1)
  expect(request?.type).toBe('synchronize')
  await rendered.act(() => window.dispatchEvent(new MessageEvent('message', {
    origin: window.location.origin,
    source: opener,
    data: { type: 'snapshot', sessionId: 'cache-fixture', requestId: request?.requestId, document: model.toJSON(), selectedPageId: 'page-a' },
  })))
  await vi.waitFor(() => expect(rendered.$('.elce-player-title')?.textContent).toBe('Page A'))
})

it('does not construct a player when its media request resolves after session destruction', async () => {
  const opener = { closed: false, postMessage: vi.fn() } as unknown as Window
  openerDescriptor = Object.getOwnPropertyDescriptor(window, 'opener')
  Object.defineProperty(window, 'opener', { configurable: true, value: opener })
  const finishSyncState = deferred<Readonly<{ documentId: string; uploadedMediaIds: readonly string[]; remoteRevision: number; status: 'pending' }>>()
  const store = {
    loadSyncState: vi.fn(() => finishSyncState.promise),
    async loadMedia() { return null },
  } as unknown as LearningDocumentStore
  const readTestState = vi.fn(async () => ({ state: INITIAL_PROJECT_TEST_STATE, revision: 0 }))
  const testStateApi = { readTestState } as unknown as LearningTestStateApiClient
  const createPlayer = vi.spyOn(learningPreviewService, 'createPlayer')
  const session = new LearningPreviewSession({
    sessionId: 'destroy-pending-media',
    projectId: null,
    startPageId: 'page-a',
    stage: () => document.getElementById('elce-player-stage'),
    store,
    testStateApi,
  })
  document.body.innerHTML = '<div id="elce-player-stage"></div>'
  session.start()
  window.dispatchEvent(new MessageEvent('message', {
    origin: window.location.origin,
    source: opener,
    data: {
      type: 'snapshot', sessionId: 'destroy-pending-media', requestId: 0,
      document: learningDocumentService.createInitialDocument().toJSON(), selectedPageId: 'page-a',
    },
  }))
  await vi.waitFor(() => expect(store.loadSyncState).toHaveBeenCalledTimes(1))
  session.destroy()
  finishSyncState.resolve({ documentId: 'elce-document', uploadedMediaIds: [], remoteRevision: 0, status: 'pending' })
  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(readTestState).not.toHaveBeenCalled()
  expect(createPlayer).not.toHaveBeenCalled()
})

/** Creates a deferred value for an in-flight preview dependency. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}
