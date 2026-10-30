import type { Actor, Subscription } from 'xstate'
import type { controllerMachine } from '../controller/controller-machine'
import type { ElceDocument } from '../../domain/document/document-model'
import type { PageId } from '../../domain/document/document-types'
import {
  POPUP_PREVIEW_PROJECT_PARAM,
  POPUP_PREVIEW_PAGE_PARAM,
  POPUP_PREVIEW_SESSION_PARAM,
  isPopupPreviewRequest,
} from './popup-preview-messages'

/** Connects one popup reader to the editor's existing XState document owner. */
export class PopupPreviewHost {
  private popup: Window | null = null
  private sessionId: string | null = null
  private initialDocument: ElceDocument | null = null
  private initialPageId: PageId | null = null
  private documentSubscription: Subscription | null = null

  private readonly controller: Actor<typeof controllerMachine>

  /** Keeps the editor's existing controller as the only document owner. */
  public constructor(controller: Actor<typeof controllerMachine>) {
    this.controller = controller
  }

  /** Opens the independent reader from the page visible in the editor at this click. */
  public open(): boolean {
    this.destroy()
    const context = this.controller.getSnapshot().context
    const pageId = context.selectedPageId ?? context.document.pages[0]?.id ?? null

    if (window.__ELCE_PREVIEW_ORIGIN__ !== undefined && window.__ELCE_PREVIEW_ORIGIN__ !== null) {
      const url = new URL(window.__ELCE_PREVIEW_ORIGIN__)
      url.searchParams.set(POPUP_PREVIEW_PROJECT_PARAM, context.document.id)
      if (pageId === null) url.searchParams.delete(POPUP_PREVIEW_PAGE_PARAM)
      else url.searchParams.set(POPUP_PREVIEW_PAGE_PARAM, pageId)
      const popup = window.open(url.href, 'elce-player-preview', 'popup,width=1280,height=840')
      if (popup === null) return false
      this.popup = popup
      popup.focus()
      return true
    }

    const sessionId = crypto.randomUUID()
    const url = new URL(window.location.href)
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
    this.initialDocument = context.document
    this.initialPageId = pageId
    let previousDocument = context.document
    let previousPageId = pageId
    this.documentSubscription = this.controller.subscribe((snapshot) => {
      const selectedPageId = snapshot.context.selectedPageId ?? snapshot.context.document.pages[0]?.id ?? null
      if (snapshot.context.document === previousDocument && selectedPageId === previousPageId) return
      previousDocument = snapshot.context.document
      previousPageId = selectedPageId
      if (popup.closed) {
        this.destroy()
        return
      }
      popup.postMessage({ type: 'editor-changed', sessionId }, window.location.origin)
    })
    popup.focus()
    return true
  }

  /** Releases editor message handling without closing an independently opened reader. */
  public destroy(): void {
    window.removeEventListener('message', this.receiveMessage)
    this.documentSubscription?.unsubscribe()
    this.documentSubscription = null
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
          document: document.toJSON(),
          selectedPageId: this.initialPageId,
        }, window.location.origin)
        const context = this.controller.getSnapshot().context
        const selectedPageId = context.selectedPageId ?? context.document.pages[0]?.id ?? null
        if (context.document !== document || selectedPageId !== this.initialPageId) {
          popup.postMessage({ type: 'editor-changed', sessionId: event.data.sessionId }, window.location.origin)
        }
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
    }
  }
}
