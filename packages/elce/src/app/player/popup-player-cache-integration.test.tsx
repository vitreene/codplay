// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest'
import { render } from 'remix/ui/test'
import { PAGE_LOCATION } from '../../config/document-config'
import { applyDocumentCommand, createDefaultPageCommand, createQuestionBdcCommand } from '../../domain/commands/document-commands'
import { createInitialDocument } from '../../domain/document/document-model'
import { INITIAL_PROJECT_TEST_STATE } from '../../domain/summary-profile/test-state-types'
import { ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import { PopupPlayer } from './popup-player'

vi.mock('../../infrastructure/indexed-db/document-store', () => ({
  IndexedDbDocumentStore: class {
    /** Provides an empty synchronization checkpoint for this text-only fixture. */
    async loadSyncState(documentId: string) { return { documentId, uploadedMediaIds: [], remoteRevision: 0, status: 'synced' } }
  },
}))

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
  const initial = createInitialDocument()
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
  vi.spyOn(ElceProjectApiClient.prototype, 'readTestState').mockResolvedValue({
    state: { ...INITIAL_PROJECT_TEST_STATE, profileEnabled: false }, revision: 0,
  })
  const saved = vi.spyOn(ElceProjectApiClient.prototype, 'saveTestState').mockImplementation(async (_projectId, _state, revision) => revision + 1)

  const rendered = render(<PopupPlayer sessionId="cache-fixture" startPageId="page-a" />)
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
