import { loadPreviewMediaSources, loadServerPreviewMediaSources } from '../../../core/preview/preview-media-sources'
import { isPopupPreviewResponse, type PopupPreviewRequest } from '../../../core/preview/popup-preview-messages'
import { createQuizHuntDocumentStore } from '../persistence/quiz-hunt-document-store'
import { createQuizHuntProjectApi } from '../persistence/quiz-hunt-project-api'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import type { QuizHuntPlayer } from '../reading/quiz-hunt-player'
import { readQuizHuntDocument } from '../persistence/quiz-hunt-document-codec'

export interface QuizHuntPreviewSnapshot {
  readonly document: QuizHuntDocument
  readonly selectedPageId: string | null
  readonly mediaSources: Readonly<Record<string, string>>
}

export interface QuizHuntPreviewSessionView {
  readonly snapshot: QuizHuntPreviewSnapshot | null
  readonly error: string | null
  readonly pending: boolean
  readonly automaticSync: boolean
  readonly isNetworkPreview: boolean
}

export interface QuizHuntPreviewSessionOptions {
  readonly sessionId: string | null
  readonly projectId: string | null
  readonly startPageId: string | null
  readonly stage: () => HTMLElement | null
}

type PendingRequest = Readonly<{ id: number; type: PopupPreviewRequest['type']; automatic?: boolean }>

/** Owns Quiz Hunt document snapshots, referenced media, and its Sighty player. */
export class QuizHuntPreviewSession {
  private readonly sessionId: string | null
  private readonly projectId: string | null
  private readonly startPageId: string | null
  private readonly stage: () => HTMLElement | null
  private readonly store = createQuizHuntDocumentStore()
  private readonly projectApi = createQuizHuntProjectApi()
  private readonly sourceUrls = new Map<string, string>()
  private readonly listeners = new Set<() => void>()
  private snapshot: QuizHuntPreviewSnapshot | null = null
  private player: QuizHuntPlayer | null = null
  private error: string | null = null
  private pending = false
  private automaticSync: boolean
  private synchronizeAgain = false
  private requestId = 0
  private pendingRequest: PendingRequest | null
  private responseTimer: number | null = null
  private started = false
  private destroyed = false

  /** Receives the mod-specific project identifiers and player host. */
  public constructor(options: QuizHuntPreviewSessionOptions) {
    this.sessionId = options.sessionId
    this.projectId = options.projectId
    this.startPageId = options.startPageId
    this.stage = options.stage
    this.pendingRequest = this.sessionId === null ? null : { id: 0, type: 'ready' }
    this.automaticSync = this.sessionId !== null
  }

  /** Returns the current view state without exposing mutable session internals. */
  public getView(): QuizHuntPreviewSessionView {
    return {
      snapshot: this.snapshot,
      error: this.error,
      pending: this.pending,
      automaticSync: this.automaticSync,
      isNetworkPreview: this.projectId !== null,
    }
  }

  /** Subscribes one Remix view and returns its cleanup function. */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Starts a server project load or connects this local popup to its editor. */
  public start(): void {
    if (this.started || this.destroyed) return
    this.started = true
    document.title = 'Elcé — Quiz Hunt'
    if (this.projectId !== null) {
      void this.loadServerProject(this.projectId)
      return
    }
    if (this.sessionId === null) return

    window.addEventListener('message', this.receiveMessage)
    if (window.opener === null || window.opener.closed) {
      this.pendingRequest = null
      this.error = 'La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur Quiz Hunt.'
      this.notify()
      return
    }
    window.opener.postMessage({ type: 'ready', sessionId: this.sessionId, requestId: 0 }, window.location.origin)
    this.responseTimer = window.setTimeout(() => {
      if (this.snapshot !== null || this.destroyed) return
      this.pendingRequest = null
      this.pending = false
      this.error = window.opener === null || window.opener.closed
        ? 'La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur Quiz Hunt.'
        : 'L’éditeur Quiz Hunt n’a pas transmis le document. Rouvre la prévisualisation depuis l’éditeur.'
      this.notify()
    }, 3000)
  }

  /** Requests the current document and page from the local editor. */
  public requestEditor(type: PopupPreviewRequest['type'], automatic = false): void {
    if (this.sessionId === null) return
    if (this.pendingRequest !== null && this.pendingRequest.type !== 'ready') {
      if (automatic) this.synchronizeAgain = true
      return
    }
    if (window.opener === null || window.opener.closed) {
      this.error = 'La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur Quiz Hunt.'
      this.notify()
      return
    }
    const id = ++this.requestId
    this.pendingRequest = { id, type, automatic }
    this.pending = true
    this.error = null
    this.notify()
    window.opener.postMessage({ type, sessionId: this.sessionId, requestId: id }, window.location.origin)
  }

  /** Follows the selected page in the editor and resumes automatic updates. */
  public returnToEditedPage(): void {
    this.automaticSync = true
    this.synchronizeAgain = false
    this.notify()
    this.requestEditor('synchronize', true)
  }

  /** Stops or resumes the local editor-following connection. */
  public toggleAutomaticSync(): void {
    if (!this.automaticSync) {
      this.returnToEditedPage()
      return
    }
    this.automaticSync = false
    this.synchronizeAgain = false
    this.notify()
  }

  /** Stops the player and releases local media URLs and message listeners. */
  public destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.responseTimer !== null) window.clearTimeout(this.responseTimer)
    window.removeEventListener('message', this.receiveMessage)
    this.player?.destroy()
    this.player = null
    for (const source of this.sourceUrls.values()) {
      if (source.startsWith('blob:')) URL.revokeObjectURL(source)
    }
    this.sourceUrls.clear()
    this.listeners.clear()
  }

  /** Decodes one editor snapshot and rebuilds the player with its selected page. */
  private async presentEditorSnapshot(payload: unknown, selectedPageId: string | null, automatic: boolean): Promise<void> {
    try {
      const documentModel = readQuizHuntDocument(payload)
      const mediaSources = await loadPreviewMediaSources({
        documentId: documentModel.id,
        media: documentModel.medias,
        store: this.store,
        urlProvider: this.projectApi,
        sourceUrls: this.sourceUrls,
      })
      if (this.destroyed) return
      if (automatic && !this.automaticSync) {
        this.finishRequest()
        return
      }
      await this.presentDocument(documentModel, selectedPageId, mediaSources)
      this.finishRequest()
    } catch (cause: unknown) {
      if (this.destroyed) return
      this.error = cause instanceof Error ? cause.message : 'La prévisualisation Quiz Hunt a échoué.'
      this.finishRequest()
      this.notify()
    }
  }

  /** Loads a stable server project before starting its player and media sources. */
  private async loadServerProject(projectId: string): Promise<void> {
    try {
      const { document: documentModel } = await this.projectApi.readProject(projectId)
      if (this.destroyed) return
      const mediaSources = loadServerPreviewMediaSources({
        documentId: documentModel.id,
        media: documentModel.medias,
        urlProvider: this.projectApi,
      })
      await this.presentDocument(documentModel, this.startPageId, mediaSources)
    } catch (cause: unknown) {
      if (this.destroyed) return
      this.error = cause instanceof Error ? cause.message : 'Le projet Quiz Hunt n’a pas pu être chargé.'
      this.notify()
    }
  }

  /** Replaces the existing player with the supplied document snapshot. */
  private async presentDocument(
    documentModel: QuizHuntDocument,
    selectedPageId: string | null,
    mediaSources: Readonly<Record<string, string>>,
  ): Promise<void> {
    this.snapshot = { document: documentModel, selectedPageId, mediaSources }
    this.error = null
    this.notify()
    this.player?.destroy()
    this.player = null
    const stage = this.stage()
    if (stage === null) {
      this.error = 'La scène de lecture Quiz Hunt n’est pas disponible.'
      this.notify()
      return
    }
    const player = new (await import('../reading/quiz-hunt-player')).QuizHuntPlayer({
      stage,
      document: documentModel,
      mediaSources,
      startPageId: selectedPageId ?? undefined,
      context: this.projectId === null ? 'authoring' : 'release',
      onLog: (message, level) => {
        if (level === 'error') console.error(`[Quiz Hunt] ${message}`)
      },
    })
    this.player = player
    void player.initialize().catch((cause: unknown) => {
      if (!this.destroyed || this.player !== player) return
      this.error = cause instanceof Error ? cause.message : 'La prévisualisation Quiz Hunt n’a pas pu démarrer.'
      this.notify()
    })
  }

  /** Handles matching snapshot responses and editor-change notifications. */
  private readonly receiveMessage = (event: MessageEvent): void => {
    if (event.origin !== window.location.origin || event.source !== window.opener) return
    if (this.sessionId === null || !isPopupPreviewResponse(event.data) || event.data.sessionId !== this.sessionId) return
    if (event.data.type === 'editor-changed') {
      if (this.automaticSync) this.requestEditor('synchronize', true)
      return
    }
    const pending = this.pendingRequest
    if (pending === null || pending.id !== event.data.requestId) return
    if (this.responseTimer !== null) window.clearTimeout(this.responseTimer)
    this.responseTimer = null
    this.pending = false
    this.error = null
    void this.presentEditorSnapshot(event.data.document, event.data.selectedPageId, pending.automatic === true)
  }

  /** Completes one local synchronization before scheduling a coalesced follow-up. */
  private finishRequest(): void {
    const pending = this.pendingRequest
    this.pendingRequest = null
    this.pending = false
    this.notify()
    if (pending?.automatic === true && this.synchronizeAgain && this.automaticSync) {
      this.synchronizeAgain = false
      this.requestEditor('synchronize', true)
    }
  }

  /** Notifies mounted views without exposing the listener collection. */
  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }
}
