/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { PopupPreviewHost } from './popup-preview-host'
import { POPUP_PREVIEW_SESSION_PARAM } from './popup-preview-messages'

describe('popup preview host', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the opening snapshot for ready and asks the owner for current synchronization data', () => {
    const postMessage = vi.fn()
    const popup = { postMessage, focus: vi.fn() } as unknown as Window
    const open = vi.spyOn(window, 'open').mockReturnValue(popup)
    let currentSnapshot = {
      projectId: 'project-a',
      document: { pages: [{ id: 'page-a' }] },
      selectedPageId: 'page-a',
    }
    const readSnapshot = vi.fn(() => currentSnapshot)
    const host = new PopupPreviewHost(readSnapshot, {
      encode: (document) => document,
      decode: (payload) => payload as typeof currentSnapshot.document,
    })

    try {
      expect(host.open()).toBe(true)
      const openedUrl = new URL(open.mock.calls[0]![0]!)
      const sessionId = openedUrl.searchParams.get(POPUP_PREVIEW_SESSION_PARAM)!
      const sendRequest = (type: 'ready' | 'synchronize' | 'show-edited-page', requestId: number) => {
        window.dispatchEvent(new MessageEvent('message', {
          data: { type, sessionId, requestId },
          origin: window.location.origin,
          source: popup,
        }))
      }

      currentSnapshot = {
        projectId: 'project-a',
        document: { pages: [{ id: 'page-a' }, { id: 'page-b' }] },
        selectedPageId: 'page-b',
      }
      sendRequest('ready', 0)
      expect(postMessage.mock.calls[0]?.[0]).toMatchObject({
        type: 'snapshot',
        selectedPageId: 'page-a',
        document: { pages: [{ id: 'page-a' }] },
      })

      sendRequest('show-edited-page', 1)
      expect(postMessage.mock.calls[1]?.[0]).toMatchObject({
        type: 'edited-page',
        selectedPageId: 'page-b',
      })
      sendRequest('synchronize', 2)
      expect(postMessage.mock.calls[2]?.[0]).toMatchObject({
        type: 'snapshot',
        selectedPageId: 'page-b',
        document: { pages: [{ id: 'page-a' }, { id: 'page-b' }] },
      })
      expect(readSnapshot).toHaveBeenCalledTimes(3)
    } finally {
      host.destroy()
    }
  })
})
