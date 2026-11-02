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
  private readonly subscribeToSnapshot?: (listener: () => void) => () => void
  private unsubscribeFromSnapshot: (() => void) | null = null
  private lastSnapshot: PopupPreviewHostSnapshot<Document> | null = null

  /** Receives the snapshot reader and codec without depending on an authoring actor. */
  public constructor(
    readSnapshot: () => PopupPreviewHostSnapshot<Document> | null,
    codec: PopupPreviewDocumentCodec<Document, DocumentPayload>,
    subscribeToSnapshot?: (listener: () => void) => () => void,
  ) {
    this.readSnapshot = readSnapshot
    this.codec = codec
    this.subscribeToSnapshot = subscribeToSnapshot
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
    this.lastSnapshot = snapshot
    this.unsubscribeFromSnapshot = this.subscribeToSnapshot?.(() => this.notifyEditorChanged(popup, sessionId)) ?? null
    popup.focus()
    return true
  }

  /** Releases protocol handling without closing an independently opened reader. */
  public destroy(): void {
    window.removeEventListener('message', this.receiveMessage)
    this.unsubscribeFromSnapshot?.()
    this.unsubscribeFromSnapshot = null
    this.popup = null
    this.sessionId = null
    this.initialSnapshot = null
    this.lastSnapshot = null
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
      const currentSnapshot = this.readSnapshot()
      if (currentSnapshot !== null && this.snapshotChanged(snapshot, currentSnapshot)) {
        this.lastSnapshot = currentSnapshot
        popup.postMessage({ type: 'editor-changed', sessionId: event.data.sessionId }, window.location.origin)
      }
      return
    }

    const snapshot = this.readSnapshot()
    if (snapshot === null) return
    this.lastSnapshot = snapshot
    popup.postMessage({
      type: 'snapshot',
      sessionId: event.data.sessionId,
      requestId: event.data.requestId,
      document: this.codec.encode(snapshot.document),
      selectedPageId: snapshot.selectedPageId,
    }, window.location.origin)
  }

  /** Sends one coalescible notification when the owner's document or selection changes. */
  private notifyEditorChanged(popup: Window, sessionId: string): void {
    if (popup.closed) {
      this.destroy()
      return
    }
    const snapshot = this.readSnapshot()
    const previous = this.lastSnapshot
    if (snapshot === null || previous === null || !this.snapshotChanged(previous, snapshot)) return
    this.lastSnapshot = snapshot
    popup.postMessage({ type: 'editor-changed', sessionId }, window.location.origin)
  }

  /** Compares only the document and selected page observed by the preview. */
  private snapshotChanged(
    previous: PopupPreviewHostSnapshot<Document>,
    next: PopupPreviewHostSnapshot<Document>,
  ): boolean {
    return previous.document !== next.document || previous.selectedPageId !== next.selectedPageId
  }
}
