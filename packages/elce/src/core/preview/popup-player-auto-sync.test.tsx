/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'remix/ui/test'
import { PAGE_LOCATION } from '../../mods/learning/organization/learning-page-placement'
import { applyDocumentCommand, createPageCommand } from '../../domain/commands/document-commands'
import { LearningDocument } from '../../mods/learning/document/learning-document'
import { learningDocumentService } from '../../mods/learning/document/learning-document-service'
import { LearningPreviewSession } from '../../mods/learning/preview/learning-preview-session'
import { LearningPreviewView } from '../../mods/learning/preview/learning-preview-view'
import { LearningPlayer } from '../../mods/learning/reading/learning-player'
import { INITIAL_PROJECT_TEST_STATE } from '../../mods/learning/reading/learning-test-state-types'
import type { LearningDocumentStore } from '../../mods/learning/persistence/learning-document-store'
import type { LearningTestStateApiClient } from '../../mods/learning/persistence/learning-test-state-api-client'
import type { PopupPreviewRequest } from './popup-preview-messages'

/** Edits one fixture Section through the same métier command as the authoring UI. */
function editPage(document: LearningDocument, pageId: string, text: string): LearningDocument {
  const bdcId = document.pages.find((page) => page.id === pageId)!.bdcIds[0]!
  return applyDocumentCommand(document, {
    type: 'bdc.section.update', bdcId, title: '', markup: `<p id="${pageId}-copy">${text}</p>`,
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
  })
}

/** Creates two unlocked pages without using a demo document or its timings. */
function createFixture(): LearningDocument {
  const initial = learningDocumentService.createInitialDocument()
  const withPages = applyDocumentCommand(initial, createPageCommand({
    pageId: 'page-b', bdcId: 'page-b-section', name: 'Second page', placement: { kind: PAGE_LOCATION.SCENARIO },
  }))
  const document = LearningDocument.fromJSON({
    ...withPages.toJSON(), summary: { ...withPages.data.summary, pageContinuationMode: 'free' },
  })
  return editPage(editPage(document, 'page-a', 'First page original'), 'page-b', 'Second page original')
}

describe('Automatic popup synchronization through Sighty and CodPlay', () => {
  let cleanup: (() => void) | undefined
  let openerDescriptor: PropertyDescriptor | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    if (openerDescriptor === undefined) delete (window as Window & { opener?: Window }).opener
    else Object.defineProperty(window, 'opener', openerDescriptor)
    vi.restoreAllMocks()
  })

  /** Connects the popup protocol to the fixture's current editor snapshot. */
  function openFixture() {
    let document = createFixture()
    let selectedPageId = 'page-a'
    const requests: PopupPreviewRequest[] = []
    const opener = {
      closed: false,
      postMessage(request: PopupPreviewRequest) {
        requests.push(request)
        if (request.type === 'ready' || request.type === 'synchronize') {
        const response = { type: 'snapshot', sessionId: request.sessionId, requestId: request.requestId, selectedPageId, document: document.toJSON() }
        queueMicrotask(() => dispatch(response))
        }
      },
    } as unknown as Window
    openerDescriptor = Object.getOwnPropertyDescriptor(window, 'opener')
    Object.defineProperty(window, 'opener', { configurable: true, value: opener })
    const store = {
      async loadSyncState(documentId: string) { return { documentId, uploadedMediaIds: [], remoteRevision: 0, status: 'pending' as const } },
      async loadMedia() { return null },
    } as unknown as LearningDocumentStore
    const testStateApi = {
      async readTestState() { return { state: { ...INITIAL_PROJECT_TEST_STATE, profileEnabled: false }, revision: 0 } },
    } as unknown as LearningTestStateApiClient

    /** Delivers messages through the actual popup receiver and its origin checks. */
    function dispatch(data: unknown): void {
      window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, source: opener, data }))
    }

    const session = new LearningPreviewSession({
      sessionId: 'automatic-reader',
      projectId: null,
      startPageId: 'page-a',
      stage: () => globalThis.document.getElementById('elce-player-stage'),
      store,
      testStateApi,
    })
    const rendered = render(<LearningPreviewView session={session} />)
    cleanup = rendered.cleanup
    return {
      rendered, requests,
      /** Commits an authored correction and signals the existing message channel. */
      edit(pageId: string, text: string) {
        document = editPage(document, pageId, text)
        selectedPageId = pageId
        dispatch({ type: 'editor-changed', sessionId: 'automatic-reader' })
      },
      /** Changes only the editor selection and signals the same editor subscription. */
      select(pageId: string) {
        selectedPageId = pageId
        dispatch({ type: 'editor-changed', sessionId: 'automatic-reader' })
      },
    }
  }

  it('starts enabled, applies consecutive commits, stops, and resumes on the editor page', async () => {
    const { rendered, requests, edit } = openFixture()
    await vi.waitFor(() => expect(rendered.$('#page-a-copy')?.textContent).toBe('First page original'))
    expect(rendered.$('#elce-popup-reader-sync')?.getAttribute('aria-pressed')).toBe('true')
    await rendered.act(() => {
      edit('page-a', 'First correction')
      edit('page-a', 'Latest correction')
    })
    await vi.waitFor(() => expect(rendered.$('#page-a-copy')?.textContent).toBe('Latest correction'))
    await rendered.act(() => (rendered.$('#elce-popup-reader-sync') as HTMLButtonElement).click())
    expect(rendered.$('#elce-popup-reader-sync')?.getAttribute('aria-pressed')).toBe('false')
    const requestCount = requests.length
    await rendered.act(() => edit('page-a', 'Paused correction'))
    expect(requests).toHaveLength(requestCount)
    expect(rendered.$('#page-a-copy')?.textContent).toBe('Latest correction')
    await rendered.act(() => edit('page-b', 'Other page correction'))
    await rendered.act(() => (rendered.$('#elce-popup-reader-sync') as HTMLButtonElement).click())
    await vi.waitFor(() => expect(rendered.$('#page-b-copy')?.textContent).toBe('Other page correction'))
    expect(rendered.$('#page-a-copy')).toBeNull()
    expect(rendered.$('#elce-popup-reader-sync')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('stops following after reader navigation and keeps that view intact during editor changes', async () => {
    const destroy = vi.spyOn(LearningPlayer.prototype, 'destroy')
    const { rendered, edit } = openFixture()
    await vi.waitFor(() => expect(rendered.$('#page-a-copy')?.textContent).toBe('First page original'))
    await rendered.act(() => (rendered.$('.elce-player-menu__page-button[data-page-id="page-b"]') as HTMLButtonElement).click())
    await vi.waitFor(() => expect(rendered.$('#page-b-copy')?.textContent).toBe('Second page original'))
    expect(rendered.$('#elce-popup-reader-sync')?.getAttribute('aria-pressed')).toBe('false')
    const copy = rendered.$('#page-b-copy')
    const scrollport = rendered.$('.elce-flux-scrollport') as HTMLElement
    scrollport.scrollTop = 137
    const destroyedBefore = destroy.mock.calls.length
    await rendered.act(() => edit('page-a', 'First page corrected in editor'))
    await vi.waitFor(() => expect((rendered.$('#elce-popup-reader-edited-page') as HTMLButtonElement).disabled).toBe(false))
    expect(rendered.$('#page-b-copy')).toBe(copy)
    expect(rendered.$('.elce-flux-scrollport')).toBe(scrollport)
    expect(scrollport.scrollTop).toBe(137)
    expect(destroy).toHaveBeenCalledTimes(destroyedBefore)
    await rendered.act(() => (rendered.$('#elce-popup-reader-edited-page') as HTMLButtonElement).click())
    await vi.waitFor(() => expect(rendered.$('#page-a-copy')?.textContent).toBe('First page corrected in editor'))
    expect(rendered.$('#elce-popup-reader-sync')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('follows editor selection alone, unlinks on reader navigation, and relinks with the return command', async () => {
    const { rendered, edit, select } = openFixture()
    await vi.waitFor(() => expect(rendered.$('#page-a-copy')).not.toBeNull())
    await rendered.act(() => select('page-b'))
    await vi.waitFor(() => expect(rendered.$('#page-b-copy')?.textContent).toBe('Second page original'))
    expect(rendered.$('#elce-popup-reader-sync')?.getAttribute('aria-pressed')).toBe('true')
    await rendered.act(() => (rendered.$('.elce-player-menu__page-button[data-page-id="page-a"]') as HTMLButtonElement).click())
    await vi.waitFor(() => expect(rendered.$('#page-a-copy')).not.toBeNull())
    expect(rendered.$('#elce-popup-reader-sync')?.getAttribute('aria-pressed')).toBe('false')
    await rendered.act(() => edit('page-b', 'Explicit destination'))
    await rendered.act(() => (rendered.$('#elce-popup-reader-edited-page') as HTMLButtonElement).click())
    await vi.waitFor(() => expect(rendered.$('#page-b-copy')?.textContent).toBe('Explicit destination'))
    expect(rendered.$('#elce-popup-reader-sync')?.getAttribute('aria-pressed')).toBe('true')
    await rendered.act(() => select('page-a'))
    await vi.waitFor(() => expect(rendered.$('#page-a-copy')).not.toBeNull())
  })
})
