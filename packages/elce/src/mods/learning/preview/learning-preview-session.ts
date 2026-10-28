import type { PageId } from '../../../core/document/content-document-types'
import type { PageSceneCache } from '../../../core/reading/page-scene-cache'
import { loadPreviewMediaSources, loadServerPreviewMediaSources } from '../../../core/preview/preview-media-sources'
import { isPopupPreviewResponse, type PopupPreviewRequest } from '../../../core/preview/popup-preview-messages'
import { createLearningDocumentStore } from '../persistence/learning-document-store'
import type { LearningDocumentStore } from '../persistence/learning-document-store'
import { LearningProjectApiClient } from '../persistence/learning-project-api-client'
import { LearningTestStateApiClient } from '../persistence/learning-test-state-api-client'
import { ProjectHttpTransport } from '../../../core/persistence/project-api/project-http-transport'
import type { LearningDocument } from '../document/learning-document'
import type { ProjectTestState } from '../reading/learning-test-state-types'
import { learningTestStateService } from '../reading/learning-test-state-service'
import { LearningTestStateSession } from './learning-test-state-session'
import { learningPreviewService } from './learning-preview-service'
import type { LearningPlayer } from '../reading/learning-player'

export interface LearningPreviewSnapshot {
  readonly documentModel: LearningDocument
  readonly selectedPageId: PageId | null
  readonly mediaSources: Readonly<Record<string, string>>
  readonly testState: ProjectTestState
}

export interface LearningPreviewSessionView {
  readonly snapshot: LearningPreviewSnapshot | null
  readonly error: string | null
  readonly pending: boolean
  readonly testStateNotice: string | null
  readonly testControlsOpen: boolean
  readonly isNetworkPreview: boolean
}

export interface LearningPreviewSessionOptions {
  readonly sessionId: string | null
  readonly projectId: string | null
  readonly startPageId: PageId | null
  readonly stage: () => HTMLElement | null
  readonly store?: LearningDocumentStore
  readonly projectApi?: LearningProjectApiClient
  readonly testStateApi?: LearningTestStateApiClient
}

type PendingRequest = Readonly<{ id: number; type: PopupPreviewRequest['type'] }>

/** Owns one Learning preview's source snapshot, consultation state, and player lifecycle. */
export class LearningPreviewSession {
  private readonly sessionId: string | null
  private readonly projectId: string | null
  private readonly startPageId: PageId | null
  private readonly stage: () => HTMLElement | null
  private readonly store: LearningDocumentStore
  private readonly projectApi: LearningProjectApiClient
  private readonly testStateApi: LearningTestStateApiClient
  private readonly sceneCache: PageSceneCache = new Map()
  private readonly sourceUrls = new Map<string, string>()
  private readonly listeners = new Set<() => void>()
  private snapshot: LearningPreviewSnapshot | null = null
  private composition: LearningPlayer | null = null
  private error: string | null = null
  private pending = false
  private testStateNotice: string | null = null
  private testControlsOpen = false
  private requestId = 0
  private pendingRequest: PendingRequest | null
  private responseTimer: number | null = null
  private started = false
  private destroyed = false
  private receivedEditorSnapshot = false

  /** Receives the Learning adapters and the host stage for this preview window. */
  public constructor(options: LearningPreviewSessionOptions) {
    this.sessionId = options.sessionId
    this.projectId = options.projectId
    this.startPageId = options.startPageId
    this.stage = options.stage
    this.store = options.store ?? createLearningDocumentStore()
    const transport = options.projectApi?.transport ?? new ProjectHttpTransport()
    this.projectApi = options.projectApi ?? new LearningProjectApiClient(transport)
    this.testStateApi = options.testStateApi ?? new LearningTestStateApiClient(transport)
    this.pendingRequest = this.sessionId === null ? null : { id: 0, type: 'ready' }
  }

  /** Returns the current view without exposing mutable session internals. */
  public getView(): LearningPreviewSessionView {
    return {
      snapshot: this.snapshot,
      error: this.error,
      pending: this.pending,
      testStateNotice: this.testStateNotice,
      testControlsOpen: this.testControlsOpen,
      isNetworkPreview: this.projectId !== null,
    }
  }

  /** Subscribes a presentation surface to changes and returns its cleanup. */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Starts network loading or connects this session to its opener exactly once. */
  public start(): void {
    if (this.started || this.destroyed) return
    this.started = true
    document.title = 'Elcé — lecture'

    if (this.projectId !== null) {
      void this.loadServerProject(this.projectId)
      return
    }
    if (this.sessionId === null) return

    window.addEventListener('message', this.receiveMessage)
    if (window.opener === null || window.opener.closed) {
      this.pendingRequest = null
      this.pending = false
      this.error = 'La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur.'
      this.notify()
      return
    }
    window.opener.postMessage({ type: 'ready', sessionId: this.sessionId, requestId: 0 }, window.location.origin)
    this.responseTimer = window.setTimeout(() => {
      if (this.receivedEditorSnapshot || this.snapshot !== null || this.destroyed) return
      this.pendingRequest = null
      this.pending = false
      this.error = window.opener === null || window.opener.closed
        ? 'La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur.'
        : 'L’éditeur n’a pas transmis le document. Rouvre la prévisualisation depuis l’éditeur.'
      this.notify()
    }, 3000)
  }

  /** Requests a fresh document snapshot or the current editor selection. */
  public requestEditor(type: PopupPreviewRequest['type']): void {
    if (this.sessionId === null) return
    if (this.pendingRequest !== null && this.pendingRequest.type !== 'ready') return
    if (window.opener === null || window.opener.closed) {
      this.error = 'La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur.'
      this.notify()
      return
    }
    const id = ++this.requestId
    this.pendingRequest = { id, type }
    this.pending = true
    this.error = null
    this.notify()
    window.opener.postMessage({ type, sessionId: this.sessionId, requestId: id }, window.location.origin)
  }

  /** Renders a received snapshot through the existing Learning player circuit. */
  public async presentSnapshot(
    nextSnapshot: LearningPreviewSnapshot,
    selectedPageId: PageId | null = nextSnapshot.selectedPageId,
  ): Promise<void> {
    if (this.destroyed) return
    const snapshot = { ...nextSnapshot, selectedPageId }
    this.snapshot = snapshot
    this.testStateNotice = learningPreviewService.isPageExcludedByProfile(
      snapshot.documentModel,
      selectedPageId,
      snapshot.testState,
    ) ? 'La page sélectionnée est exclue par le profil du test auteur.' : null
    this.error = null
    this.notify()

    this.composition?.destroy()
    this.composition = null
    const stage = this.stage()
    if (stage === null) {
      this.error = 'La scène de lecture n’est pas disponible.'
      this.notify()
      return
    }

    this.composition = learningPreviewService.createPlayer(stage, {
      documentModel: snapshot.documentModel,
      selectedPageId,
      mediaSources: snapshot.mediaSources,
      testState: snapshot.testState,
      onTestStateChange: (state) => { void this.updateConsultationState(state) },
      sceneCache: this.sceneCache,
    })
    if (this.composition !== null) {
      const currentComposition = this.composition
      void currentComposition.initialize().catch((cause: unknown) => {
        if (!this.destroyed && this.composition === currentComposition) {
          this.error = cause instanceof Error ? cause.message : 'La prévisualisation n’a pas pu démarrer.'
          this.notify()
        }
      })
    }
  }

  /** Updates only the in-memory consultation snapshot, never the project API. */
  public async updateConsultationState(
    state: ProjectTestState,
    options: Readonly<{ rebuild?: boolean; resetSelection?: boolean }> = {},
  ): Promise<void> {
    const current = this.snapshot
    if (this.destroyed || current === null) return
    const submittedNow = !current.testState.profileSubmitted && state.profileSubmitted
    const rebuild = options.rebuild === true || submittedNow
    const selectedPageId = options.resetSelection === true || submittedNow
      ? null
      : this.composition?.getCurrentPageId?.() ?? current.selectedPageId
    this.snapshot = { ...current, selectedPageId, testState: state }
    this.notify()
    if (rebuild) await this.presentSnapshot(this.snapshot, selectedPageId)
  }

  /** Clears profile answers while preserving independent page and question progress. */
  public resetTestProfile(): void {
    if (this.snapshot === null) return
    const state = { ...this.snapshot.testState, profileSubmitted: false, profileValues: {} }
    this.testControlsOpen = false
    void this.updateConsultationState(state, { rebuild: true, resetSelection: true })
  }

  /** Clears page completion, Question answers, and Evaluation attempts only. */
  public resetTestProgress(): void {
    if (this.snapshot === null) return
    const state = {
      ...this.snapshot.testState,
      finishedPageIds: [],
      questionAnswers: {},
      evaluationStates: {},
    }
    this.testControlsOpen = false
    void this.updateConsultationState(state, { rebuild: true })
  }

  /** Toggles profile filtering while preserving the rest of consultation state. */
  public toggleProfileMode(enabled: boolean): void {
    if (this.snapshot === null) return
    const state = { ...this.snapshot.testState, profileEnabled: enabled }
    this.testControlsOpen = false
    void this.updateConsultationState(state, { rebuild: true })
  }

  /** Opens or closes the visual test controls. */
  public toggleTestControls(): void {
    this.testControlsOpen = !this.testControlsOpen
    this.notify()
  }

  /** Closes the message bridge and releases the player, Blob URLs, and scene cache. */
  public destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.responseTimer !== null) window.clearTimeout(this.responseTimer)
    window.removeEventListener('message', this.receiveMessage)
    this.composition?.destroy()
    this.composition = null
    for (const source of this.sourceUrls.values()) {
      if (source.startsWith('blob:')) URL.revokeObjectURL(source)
    }
    this.sourceUrls.clear()
    this.sceneCache.clear()
    this.listeners.clear()
  }

  /** Loads the server document before resolving its media and initial test state. */
  private async loadServerProject(projectId: string): Promise<void> {
    try {
      const { document: documentModel } = await this.projectApi.readProject(projectId)
      if (this.destroyed) return
      const mediaSources = loadServerPreviewMediaSources({
        documentId: documentModel.id,
        media: documentModel.medias,
        urlProvider: this.projectApi,
      })
      await this.presentDocument(documentModel, this.startPageId, true, mediaSources)
    } catch (cause: unknown) {
      if (this.destroyed) return
      this.error = cause instanceof Error ? cause.message : 'La lecture du document a échoué.'
      this.notify()
    }
  }

  /** Resolves media, reads and reconciles test state, then replaces the player. */
  private async presentDocument(
    documentModel: LearningDocument,
    selectedPageId: PageId | null,
    fromServer: boolean,
    serverMediaSources?: Readonly<Record<string, string>>,
  ): Promise<void> {
    try {
      const mediaSources = serverMediaSources ?? await loadPreviewMediaSources({
        documentId: documentModel.id,
        media: documentModel.medias,
        store: this.store,
        urlProvider: this.projectApi,
        sourceUrls: this.sourceUrls,
      })
      if (this.destroyed) return
      const testStateSession = await LearningTestStateSession.open(
        this.testStateApi,
        documentModel.id,
        { allowOffline: !fromServer },
      )
      if (this.destroyed) return
      const testState = learningTestStateService.reconcileProjectTestState(documentModel, testStateSession.state)
      const snapshot = {
        documentModel,
        selectedPageId: selectedPageId !== null && documentModel.pages.some((page) => page.id === selectedPageId)
          ? selectedPageId
          : null,
        mediaSources,
        testState,
      }
      await this.presentSnapshot(snapshot)
      if (this.destroyed) return
      this.pendingRequest = null
      this.pending = false
      this.notify()
    } catch (cause: unknown) {
      if (this.destroyed) return
      this.error = cause instanceof Error ? cause.message : 'La lecture du document a échoué.'
      this.pendingRequest = null
      this.pending = false
      this.notify()
    }
  }

  /** Accepts only responses for this session and its active request. */
  private readonly receiveMessage = (event: MessageEvent): void => {
    if (this.sessionId === null || event.origin !== window.location.origin || event.source !== window.opener) return
    if (!isPopupPreviewResponse(event.data) || event.data.sessionId !== this.sessionId) return
    if (event.data.requestId !== this.pendingRequest?.id) return
    if (event.data.type === 'snapshot') {
      if (event.data.requestId === 0) this.receivedEditorSnapshot = true
      try {
        const documentModel = learningPreviewService.decodeDocument(event.data.document)
        void this.presentDocument(documentModel, event.data.selectedPageId, false)
      } catch (cause: unknown) {
        this.pendingRequest = null
        this.pending = false
        this.error = cause instanceof Error ? cause.message : 'Le document reçu est invalide.'
        this.notify()
      }
      return
    }

    const previous = this.snapshot
    if (previous === null) return
    const selectedPageId = event.data.selectedPageId
    const pageExists = selectedPageId === null || previous.documentModel.pages.some((page) => page.id === selectedPageId)
    this.pendingRequest = null
    if (!pageExists) {
      this.requestEditor('synchronize')
      return
    }
    void this.presentSnapshot(previous, selectedPageId).then(() => {
      this.pending = false
      this.error = null
      this.notify()
    }).catch((cause: unknown) => {
      this.pending = false
      this.error = cause instanceof Error ? cause.message : 'La page éditée n’a pas pu être affichée.'
      this.notify()
    })
  }

  /** Notifies the current Remix surface after a session-owned change. */
  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }
}
