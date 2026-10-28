import type { PageId } from '../document/content-document-types'
import {
  POPUP_PREVIEW_PAGE_PARAM,
  POPUP_PREVIEW_PROJECT_PARAM,
  POPUP_PREVIEW_SESSION_PARAM,
  isPopupPreviewRequest,
  type PopupPreviewDocumentCodec,
} from './popup-preview-messages'

export interface PopupPreviewHostSnapshot<Document> {
  readonly projectId: string
  readonly document: Document
  readonly selectedPageId: PageId | null
}

/** Connects one preview window to a document owner through encoded snapshots. */
export class PopupPreviewHost<Document, DocumentPayload = unknown> {
  private popup: Window | null = null
  private sessionId: string | null = null
  private initialSnapshot: PopupPreviewHostSnapshot<Document> | null = null
  private readonly readSnapshot: () => PopupPreviewHostSnapshot<Document> | null
  private readonly codec: PopupPreviewDocumentCodec<Document, DocumentPayload>

  /** Receives the snapshot reader and codec without depending on an authoring actor. */
  public constructor(
    readSnapshot: () => PopupPreviewHostSnapshot<Document> | null,
    codec: PopupPreviewDocumentCodec<Document, DocumentPayload>,
  ) {
    this.readSnapshot = readSnapshot
    this.codec = codec
  }

  /** Opens the independent reader from the page visible in the owner at this click. */
  public open(): boolean {
    this.destroy()
    const snapshot = this.readSnapshot()
    if (snapshot === null) return false

    if (window.__ELCE_PREVIEW_ORIGIN__ !== undefined && window.__ELCE_PREVIEW_ORIGIN__ !== null) {
      const url = new URL(window.__ELCE_PREVIEW_ORIGIN__)
      url.searchParams.set(POPUP_PREVIEW_PROJECT_PARAM, snapshot.projectId)
      if (snapshot.selectedPageId === null) url.searchParams.delete(POPUP_PREVIEW_PAGE_PARAM)
      else url.searchParams.set(POPUP_PREVIEW_PAGE_PARAM, snapshot.selectedPageId)
      const popup = window.open(url.href, 'elce-player-preview', 'popup,width=1280,height=840')
      if (popup === null) return false
      this.popup = popup
      popup.focus()
      return true
    }

    const sessionId = crypto.randomUUID()
    const url = new URL(window.location.href)
    url.searchParams.set(POPUP_PREVIEW_SESSION_PARAM, sessionId)
    if (snapshot.selectedPageId !== null) url.searchParams.set(POPUP_PREVIEW_PAGE_PARAM, snapshot.selectedPageId)
    window.addEventListener('message', this.receiveMessage)
    const popup = window.open(url.href, 'elce-player-preview', 'popup,width=1280,height=840')
    if (popup === null) {
      window.removeEventListener('message', this.receiveMessage)
      return false
    }
    this.popup = popup
    this.sessionId = sessionId
    this.initialSnapshot = snapshot
    popup.focus()
    return true
  }

  /** Releases protocol handling without closing an independently opened reader. */
  public destroy(): void {
    window.removeEventListener('message', this.receiveMessage)
    this.popup = null
    this.sessionId = null
    this.initialSnapshot = null
  }

  /** Routes requests to the opening snapshot or the owner's current snapshot. */
  private readonly receiveMessage = (event: MessageEvent): void => {
    if (event.origin !== window.location.origin || event.source !== this.popup) return
    if (!isPopupPreviewRequest(event.data) || event.data.sessionId !== this.sessionId) return
    const popup = this.popup
    if (popup === null) return

    if (event.data.type === 'ready') {
      const snapshot = this.initialSnapshot
      if (snapshot === null) return
      popup.postMessage({
        type: 'snapshot',
        sessionId: event.data.sessionId,
        requestId: event.data.requestId,
        document: this.codec.encode(snapshot.document),
        selectedPageId: snapshot.selectedPageId,
      }, window.location.origin)
      return
    }

    const snapshot = this.readSnapshot()
    if (snapshot === null) return
    if (event.data.type === 'synchronize') {
      popup.postMessage({
        type: 'snapshot',
        sessionId: event.data.sessionId,
        requestId: event.data.requestId,
        document: this.codec.encode(snapshot.document),
        selectedPageId: snapshot.selectedPageId,
      }, window.location.origin)
      return
    }

    popup.postMessage({
      type: 'edited-page',
      sessionId: event.data.sessionId,
      requestId: event.data.requestId,
      selectedPageId: snapshot.selectedPageId,
    }, window.location.origin)
  }
}
