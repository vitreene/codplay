/** @vitest-environment jsdom */

import { createActor } from 'xstate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { controllerMachine } from '../controller/controller-machine'
import { createDefaultPageCommand } from '../commands/document-commands'
import { PAGE_LOCATION } from '../../config/document-config'
import { PopupPreviewHost } from './popup-preview-host'
import { POPUP_PREVIEW_SESSION_PARAM } from './popup-preview-messages'

describe('popup preview editor connection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts from the clicked page and returns the latest editor document on manual synchronization', () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    const postMessage = vi.fn()
    const popup = { postMessage, focus: vi.fn() } as unknown as Window
    const open = vi.spyOn(window, 'open').mockReturnValue(popup)
    const host = new PopupPreviewHost(controller)

    try {
      const beforeOpen = controller.getSnapshot().context.document
      const pageShownAtOpen = createDefaultPageCommand(beforeOpen, { kind: PAGE_LOCATION.SCENARIO })
      controller.send({ type: 'document.apply', command: pageShownAtOpen })
      controller.send({ type: 'page.select', pageId: pageShownAtOpen.pageId })
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

      sendRequest('ready', 0)
      expect(postMessage.mock.calls[0]?.[0]).toMatchObject({
        type: 'snapshot',
        selectedPageId: pageShownAtOpen.pageId,
        document: { pages: [{ id: 'page-a' }, { id: pageShownAtOpen.pageId }] },
      })

      const pageCommand = createDefaultPageCommand(controller.getSnapshot().context.document, { kind: PAGE_LOCATION.SCENARIO })
      controller.send({ type: 'document.apply', command: pageCommand })
      controller.send({ type: 'page.select', pageId: pageCommand.pageId })
      sendRequest('show-edited-page', 1)
      expect(postMessage.mock.calls[1]?.[0]).toMatchObject({
        type: 'edited-page',
        selectedPageId: pageCommand.pageId,
      })
      sendRequest('synchronize', 2)
      expect(postMessage.mock.calls[2]?.[0]).toMatchObject({
        type: 'snapshot',
        selectedPageId: pageCommand.pageId,
        document: { pages: [{ id: 'page-a' }, { id: pageShownAtOpen.pageId }, { id: pageCommand.pageId }] },
      })
      sendRequest('ready', 3)
      expect(postMessage.mock.calls[3]?.[0].selectedPageId).toBe(pageShownAtOpen.pageId)
    } finally {
      host.destroy()
      controller.stop()
    }
  })
})
