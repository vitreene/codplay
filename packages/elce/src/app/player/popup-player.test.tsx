/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyDocumentCommand, createDefaultPageCommand } from '../commands/document-commands'
import { PAGE_LOCATION } from '../../config/document-config'
import { createInitialDocument } from '../../domain/document-model'
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
  },
}))

vi.mock('./PlayerPreview', () => ({
  /** Exposes the active player page while the integration boundary is tested. */
  PlayerPreview: ({ selectedPageId }: { selectedPageId: string | null }) => (
    <div id="test-reader-page" data-page-id={selectedPageId ?? ''} />
  ),
}))

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })

describe('popup reader synchronization controls', () => {
  let root: ReturnType<typeof createRoot> | undefined
  let host: HTMLDivElement | undefined
  let openerDescriptor: PropertyDescriptor | undefined

  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    host?.remove()
    host = undefined
    if (openerDescriptor === undefined) delete (window as Window & { opener?: Window }).opener
    else Object.defineProperty(window, 'opener', openerDescriptor)
    openerDescriptor = undefined
    vi.restoreAllMocks()
  })

  it('synchronizes automatically when the edited page was created after the last snapshot', async () => {
    const requests: unknown[] = []
    const opener = { closed: false, postMessage: (message: unknown) => requests.push(message) } as unknown as Window
    openerDescriptor = Object.getOwnPropertyDescriptor(window, 'opener')
    Object.defineProperty(window, 'opener', { configurable: true, value: opener })
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    act(() => root?.render(<PopupPlayer sessionId="reader-session" startPageId="page-a" />))

    const originalDocument = createInitialDocument()
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        source: opener,
        data: {
          type: 'snapshot',
          sessionId: 'reader-session',
          requestId: 0,
          document: originalDocument.toJSON(),
          selectedPageId: 'page-a',
        },
      }))
    })
    expect(host.querySelector('#test-reader-page')?.getAttribute('data-page-id')).toBe('page-a')

    const newPageCommand = createDefaultPageCommand(originalDocument, { kind: PAGE_LOCATION.SCENARIO })
    const editedDocument = applyDocumentCommand(originalDocument, newPageCommand)
    await act(async () => {
      host?.querySelector<HTMLButtonElement>('#elce-popup-reader-edited-page')?.click()
    })
    expect(requests.at(-1)).toMatchObject({ type: 'show-edited-page', requestId: 1 })

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        source: opener,
        data: {
          type: 'edited-page',
          sessionId: 'reader-session',
          requestId: 1,
          selectedPageId: newPageCommand.pageId,
        },
      }))
    })
    expect(requests.at(-1)).toMatchObject({ type: 'synchronize', requestId: 2 })

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        source: opener,
        data: {
          type: 'snapshot',
          sessionId: 'reader-session',
          requestId: 2,
          document: editedDocument.toJSON(),
          selectedPageId: newPageCommand.pageId,
        },
      }))
    })
    expect(host.querySelector('#test-reader-page')?.getAttribute('data-page-id')).toBe(newPageCommand.pageId)
  })
})
