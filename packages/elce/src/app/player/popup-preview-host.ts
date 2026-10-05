import type { Actor } from 'xstate'
import type { controllerMachine } from '../controller/controller-machine'
import type { ElceDocumentData, PageId } from '../../domain/document-types'
import {
  POPUP_PREVIEW_PAGE_PARAM,
  POPUP_PREVIEW_SESSION_PARAM,
  isPopupPreviewRequest,
} from './popup-preview-messages'

/** Connects one popup reader to the editor's existing XState document owner. */
export class PopupPreviewHost {
  private popup: Window | null = null
  private sessionId: string | null = null
  private initialDocument: ElceDocumentData | null = null
  private initialPageId: PageId | null = null

  private readonly controller: Actor<typeof controllerMachine>

  /** Keeps the editor's existing controller as the only document owner. */
  public constructor(controller: Actor<typeof controllerMachine>) {
    this.controller = controller
  }

  /** Opens the independent reader from the page visible in the editor at this click. */
  public open(): boolean {
    this.destroy()
    const context = this.controller.getSnapshot().context
    const sessionId = crypto.randomUUID()
    const url = new URL(window.location.href)
    const pageId = context.selectedPageId ?? context.document.pages[0]?.id ?? null
    url.searchParams.set(POPUP_PREVIEW_SESSION_PARAM, sessionId)
    if (pageId !== null) url.searchParams.set(POPUP_PREVIEW_PAGE_PARAM, pageId)
    window.addEventListener('message', this.receiveMessage)
    const popup = window.open(url.href, 'elce-player-preview', 'popup,width=1280,height=840')
    if (popup === null) {
      window.removeEventListener('message', this.receiveMessage)
      return false
    }
    this.popup = popup
    this.sessionId = sessionId
    this.initialDocument = context.document.toJSON()
    this.initialPageId = pageId
    popup.focus()
    return true
  }

  /** Releases editor message handling without closing an independently opened reader. */
  public destroy(): void {
    window.removeEventListener('message', this.receiveMessage)
    this.popup = null
    this.sessionId = null
    this.initialDocument = null
    this.initialPageId = null
  }

  /** Routes popup requests to the current editor snapshot or page selection. */
  private readonly receiveMessage = (event: MessageEvent): void => {
    if (event.origin !== window.location.origin || event.source !== this.popup) return
    if (!isPopupPreviewRequest(event.data) || event.data.sessionId !== this.sessionId) return
    const popup = this.popup
    if (popup === null) return

    switch (event.data.type) {
      case 'ready': {
        const document = this.initialDocument
        if (document === null) return
        popup.postMessage({
          type: 'snapshot',
          sessionId: event.data.sessionId,
          requestId: event.data.requestId,
          document,
          selectedPageId: this.initialPageId,
        }, window.location.origin)
        return
      }
      case 'synchronize': {
        const context = this.controller.getSnapshot().context
        popup.postMessage({
          type: 'snapshot',
          sessionId: event.data.sessionId,
          requestId: event.data.requestId,
          document: context.document.toJSON(),
          selectedPageId: context.selectedPageId ?? context.document.pages[0]?.id ?? null,
        }, window.location.origin)
        return
      }
      case 'show-edited-page': {
        const context = this.controller.getSnapshot().context
        popup.postMessage({
          type: 'edited-page',
          sessionId: event.data.sessionId,
          requestId: event.data.requestId,
          selectedPageId: context.selectedPageId ?? context.document.pages[0]?.id ?? null,
        }, window.location.origin)
      }
    }
  }
}
