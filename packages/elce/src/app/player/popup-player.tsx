import { on, type Handle, type RemixNode } from 'remix/ui'

import { FileText, RefreshCw } from 'lucide-static'
import { ElceDocument } from '../../domain/document/document-model'
import type { PageId } from '../../domain/document/document-types'
import { IndexedDbDocumentStore } from '../../infrastructure/indexed-db/document-store'
import { ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import type { ElcePageSceneCache } from '../../player/player-composition-types'
import type { ElcePlayerComposition } from '../../player/elce-player-composition'
import { renderLucideIcon } from '../remix/lucide-static-icon'
import { SUMMARY_PROFILE_ACCESS_ICON } from '../remix/summary-profile-access-icon'
import { isPopupPreviewResponse, type PopupPreviewRequest } from './popup-preview-messages'
import { createPlayerPreviewComposition, isCatalogPage } from './player-preview'
import { ProjectTestStateSession } from './project-test-state-session'
import type { ProjectTestState } from '../../domain/summary-profile/test-state-types'
import { projectReaderDocument } from '../../domain/summary-profile/reader-projection'
import { reconcileProjectTestState } from '../../domain/summary-profile/test-state-reconciliation'

type PopupPlayerProps = Readonly<{
  sessionId: string | null
  projectId?: string | null
  startPageId: PageId | null
}>

type ReaderSnapshot = Readonly<{
  documentModel: ElceDocument
  selectedPageId: PageId | null
  mediaSources: Readonly<Record<string, string>>
  testState: ProjectTestState
}>

type PendingRequest = Readonly<{
  id: number
  type: PopupPreviewRequest['type']
  automatic?: boolean
}>

/** Uses server URLs after upload and local Blob URLs only while upload is pending. */
async function loadMediaSources(
  documentModel: ElceDocument,
  store: IndexedDbDocumentStore,
  api: ElceProjectApiClient,
  sourceUrls: Map<string, string>,
): Promise<Readonly<Record<string, string>>> {
  const sources: Record<string, string> = {}
  const syncState = await store.loadSyncState(documentModel.id)
  const uploadedMediaIds = new Set(syncState.uploadedMediaIds)

  for (const media of documentModel.medias) {
    let source = sourceUrls.get(media.id)
    if (uploadedMediaIds.has(media.id)) {
      const serverSource = api.mediaUrl(documentModel.id, media.id)
      if (source !== serverSource && source?.startsWith('blob:') === true) URL.revokeObjectURL(source)
      source = serverSource
      sourceUrls.set(media.id, source)
    } else if (source === undefined || !source.startsWith('blob:')) {
      const blob = await store.loadMedia(media.id)
      if (blob === null) throw new Error(`Le média ${media.id} est absent du stockage Elcé.`)
      source = URL.createObjectURL(blob)
      sourceUrls.set(media.id, source)
    }
    sources[media.id] = source
  }
  return sources
}

/** Resolves every media resource from the synchronized project's existing API URLs. */
function loadServerMediaSources(
  documentModel: ElceDocument,
  api: ElceProjectApiClient,
): Readonly<Record<string, string>> {
  return Object.fromEntries(documentModel.medias.map((media) => [
    media.id,
    api.mediaUrl(documentModel.id, media.id),
  ]))
}

/** Renders the independent popup while preserving the existing XState message protocol. */
export function PopupPlayer(handle: Handle<PopupPlayerProps>) {
  const { sessionId, startPageId } = handle.props
  const projectId = handle.props.projectId ?? null
  const isNetworkPreview = projectId !== null
  let readerSnapshot: ReaderSnapshot | null = null
  let error: string | null = null
  let pending = false
  let automaticSync = true
  let synchronizeAgain = false
  let testStateNotice: string | null = null
  let testControlsOpen = false
  let testStateSession: ProjectTestStateSession | null = null
  let conflictPresented = false
  const sourceUrls = new Map<string, string>()
  const sceneCache: ElcePageSceneCache = new Map()
  let composition: ElcePlayerComposition | null = null
  let requestId = 0
  let pendingRequest: PendingRequest | null = sessionId === null ? null : { id: 0, type: 'ready' }

  /** Refreshes the native Remix view while its component is still mounted. */
  const update = (): void => {
    if (!handle.signal.aborted) void handle.update()
  }

  /** Saves a committed reader change using the independent server test-state revision. */
  const saveTestState = async (
    state: ProjectTestState,
    options: Readonly<{ rebuild?: boolean; resetSelection?: boolean }> = {},
  ): Promise<void> => {
    const current = readerSnapshot
    const submittedNow = current !== null && !current.testState.profileSubmitted && state.profileSubmitted
    if (current !== null) readerSnapshot = { ...current, testState: state }
    const rebuild = options.rebuild === true || submittedNow
    const selectedPageId = options.resetSelection === true || submittedNow ? null : current?.selectedPageId ?? null
    update()
    if (testStateSession === null) {
      if (rebuild && readerSnapshot !== null) await presentSnapshot({ ...readerSnapshot, selectedPageId, testState: state })
      return
    }
    try {
      const result = await testStateSession.save(state)
      if (result.kind === 'conflict') {
        testStateNotice = 'Le test a changé dans une autre fenêtre. La version serveur a été rechargée.'
        const latest = readerSnapshot
        if (latest !== null && !conflictPresented) {
          conflictPresented = true
          await presentSnapshot({ ...latest, testState: result.state })
        }
        return
      }
      if (!testStateSession.isPersisted) {
        testStateNotice = 'Le projet doit être synchronisé au serveur pour enregistrer le test.'
      }
    } catch (cause: unknown) {
      testStateNotice = cause instanceof Error ? cause.message : 'L’état de test n’a pas pu être enregistré.'
    }
    if (rebuild && readerSnapshot !== null) {
      await presentSnapshot({ ...readerSnapshot, selectedPageId, testState: state })
    }
    update()
  }

  /** Clears only profile answers, leaving page and question progress intact. */
  const resetTestProfile = (): void => {
    if (readerSnapshot === null) return
    const state = { ...readerSnapshot.testState, profileSubmitted: false, profileValues: {} }
    testControlsOpen = false
    void saveTestState(state, { rebuild: true, resetSelection: true })
  }

  /** Clears only page completion, Question answers and Evaluation attempts. */
  const resetTestProgress = (): void => {
    if (readerSnapshot === null) return
    const state = {
      ...readerSnapshot.testState,
      finishedPageIds: [],
      questionAnswers: {},
      evaluationStates: {},
    }
    testControlsOpen = false
    void saveTestState(state, { rebuild: true })
  }

  /** Toggles profile filtering while preserving independently stored progress. */
  const toggleProfileMode = (enabled: boolean): void => {
    if (readerSnapshot === null) return
    const state = { ...readerSnapshot.testState, profileEnabled: enabled }
    testControlsOpen = false
    void saveTestState(state, { rebuild: true })
  }

  /** Requests a fresh editor snapshot or its selected page through the opener. */
  const requestEditor = (type: PopupPreviewRequest['type'], automatic = false): void => {
    if (sessionId === null) return
    if (pendingRequest !== null) {
      if (automatic) {
        synchronizeAgain = true
        return
      }
      if (pendingRequest.type !== 'ready') return
    }
    if (window.opener === null || window.opener.closed) {
      error = 'La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur.'
      update()
      return
    }
    const id = ++requestId
    pendingRequest = { id, type, automatic }
    pending = true
    error = null
    update()
    window.opener.postMessage({ type, sessionId, requestId: id }, window.location.origin)
  }

  /** Resumes following the editor with its latest document and selected page. */
  const returnToEditedPage = (): void => {
    automaticSync = true
    synchronizeAgain = false
    update()
    requestEditor('synchronize', true)
  }

  /** Stops following the editor or restores that link through the same return command. */
  const toggleAutomaticSync = (): void => {
    if (!automaticSync) {
      returnToEditedPage()
      return
    }
    automaticSync = false
    synchronizeAgain = false
    update()
  }

  /** Completes a request and coalesces commits received while its snapshot was loading. */
  const finishRequest = (): void => {
    pendingRequest = null
    pending = false
    update()
    if (!automaticSync || !synchronizeAgain) return
    synchronizeAgain = false
    requestEditor('synchronize', true)
  }

  /** Renders a received snapshot and remounts the same player composition circuit. */
  const presentSnapshot = async (nextSnapshot: ReaderSnapshot): Promise<void> => {
    if (handle.signal.aborted) return
    readerSnapshot = nextSnapshot
    if (nextSnapshot.selectedPageId !== null && nextSnapshot.testState.profileEnabled && nextSnapshot.testState.profileSubmitted) {
      const readerDocument = projectReaderDocument(
        nextSnapshot.documentModel,
        nextSnapshot.testState.profileValues,
        nextSnapshot.testState.profileEnabled,
      )
      if (!readerDocument.pages.some((page) => page.id === nextSnapshot.selectedPageId)) {
        testStateNotice = 'La page sélectionnée est exclue par le profil du test auteur.'
      }
    }
    error = null
    await handle.update()
    if (handle.signal.aborted) return

    composition?.destroy()
    composition = null
    const stage = document.getElementById('elce-player-stage')
    if (stage === null) {
      error = 'La scène de lecture n’est pas disponible.'
      update()
      return
    }

    composition = createPlayerPreviewComposition(stage, {
      documentModel: nextSnapshot.documentModel,
      selectedPageId: nextSnapshot.selectedPageId,
      mediaSources: nextSnapshot.mediaSources,
      testState: nextSnapshot.testState,
      onTestStateChange: (state) => { void saveTestState(state) },
      onPageChange: (selectedPageId) => {
        if (readerSnapshot === null) return
        readerSnapshot = { ...readerSnapshot, selectedPageId }
        if (isNetworkPreview) return
        automaticSync = false
        synchronizeAgain = false
        update()
      },
      sceneCache,
    })
    if (composition !== null) {
      const currentComposition = composition
      await currentComposition.initialize()
    }
  }

  handle.queueTask(() => {
    document.title = 'Elcé — lecture'
    const store = new IndexedDbDocumentStore()
    const api = new ElceProjectApiClient()
    let disposed = false
    let receivedEditorSnapshot = false
    let responseTimer: number | null = null

    /** Loads an editor snapshot or synchronized project into the real player. */
    const presentDocument = async (
      documentModel: ElceDocument,
      selectedPageId: PageId | null,
      fromServer: boolean,
      automatic = false,
    ): Promise<void> => {
      try {
        const mediaSources = fromServer
          ? loadServerMediaSources(documentModel, api)
          : await loadMediaSources(documentModel, store, api, sourceUrls)
        if (disposed || handle.signal.aborted) return
        if (automatic && !automaticSync) {
          finishRequest()
          return
        }
        if (readerSnapshot?.documentModel.id !== documentModel.id || testStateSession === null) {
          testStateSession = await ProjectTestStateSession.open(api, documentModel.id, { allowOffline: !isNetworkPreview })
        }
        conflictPresented = false
        const storedTestState = testStateSession.state
        let testState = reconcileProjectTestState(documentModel, storedTestState)
        if (testState !== storedTestState) {
          try {
            const result = await testStateSession.save(testState)
            if (result.kind === 'conflict') {
              testStateNotice = 'Le test a changé dans une autre fenêtre. La version serveur a été rechargée.'
              conflictPresented = true
              testState = reconcileProjectTestState(documentModel, result.state)
            } else {
              testState = result.state
            }
          } catch (cause: unknown) {
            testStateNotice = cause instanceof Error ? cause.message : 'L’état de test n’a pas pu être enregistré.'
          }
        }
        const nextSnapshot = {
          documentModel,
          selectedPageId: selectedPageId !== null && documentModel.pages.some((page) => page.id === selectedPageId)
            ? selectedPageId
            : null,
          mediaSources,
          testState,
        }
        if (automatic && !automaticSync) {
          finishRequest()
          return
        }
        await presentSnapshot(nextSnapshot)
        if (disposed || handle.signal.aborted) return
        finishRequest()
      } catch (cause: unknown) {
        if (!disposed && !handle.signal.aborted) {
          error = cause instanceof Error ? cause.message : 'La lecture du document a échoué.'
          finishRequest()
        }
      }
    }

    /** Accepts only messages from the editor that opened this reader session. */
    const receiveMessage = (event: MessageEvent): void => {
      if (sessionId === null) return
      if (event.origin !== window.location.origin || event.source !== window.opener) return
      if (!isPopupPreviewResponse(event.data) || event.data.sessionId !== sessionId) return
      if (event.data.type === 'editor-changed') {
        if (automaticSync) requestEditor('synchronize', true)
        return
      }
      if (event.data.requestId !== pendingRequest?.id) return
      if (event.data.type === 'snapshot') {
        if (event.data.requestId === 0) receivedEditorSnapshot = true
        try {
          const automatic = pendingRequest.automatic === true
          void presentDocument(ElceDocument.fromJSON(event.data.document), event.data.selectedPageId, false, automatic)
        } catch (cause: unknown) {
          pendingRequest = null
          pending = false
          error = cause instanceof Error ? cause.message : 'Le document reçu est invalide.'
          update()
        }
        return
      }
    }

    if (isNetworkPreview && projectId !== null) {
      void api.readProject(projectId).then(({ document: documentModel }) => {
        if (!disposed) void presentDocument(documentModel, startPageId, true)
      }).catch((cause: unknown) => {
        if (!disposed && !handle.signal.aborted) {
          error = cause instanceof Error ? cause.message : 'La lecture du document a échoué.'
          update()
        }
      })
    } else if (sessionId !== null) {
      window.addEventListener('message', receiveMessage)
      if (window.opener === null || window.opener.closed) {
        pendingRequest = null
        pending = false
        error = 'La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur.'
        update()
      } else {
        window.opener.postMessage({ type: 'ready', sessionId, requestId: 0 }, window.location.origin)
        responseTimer = window.setTimeout(() => {
          if (receivedEditorSnapshot || readerSnapshot !== null) return
          pendingRequest = null
          pending = false
          error = window.opener === null || window.opener.closed
            ? 'La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur.'
            : 'L’éditeur n’a pas transmis le document. Rouvre la prévisualisation depuis l’éditeur.'
          update()
        }, 3000)
      }
    }

    const dispose = (): void => {
      disposed = true
      if (responseTimer !== null) window.clearTimeout(responseTimer)
      window.removeEventListener('message', receiveMessage)
      composition?.destroy()
      composition = null
      for (const source of sourceUrls.values()) {
        if (source.startsWith('blob:')) URL.revokeObjectURL(source)
      }
      sourceUrls.clear()
      sceneCache.clear()
    }
    handle.signal.addEventListener('abort', dispose, { once: true })
  })

  return () => renderPopupReader({
    snapshot: readerSnapshot,
    error,
    pending,
    onReturnToEditedPage: returnToEditedPage,
    automaticSync,
    onToggleAutomaticSync: toggleAutomaticSync,
    isNetworkPreview,
    testStateNotice,
    testControlsOpen,
    onToggleTestControls: () => { testControlsOpen = !testControlsOpen; update() },
    onResetTestProfile: resetTestProfile,
    onResetTestProgress: resetTestProgress,
    onToggleProfileMode: toggleProfileMode,
  })
}

interface PopupReaderState {
  readonly snapshot: ReaderSnapshot | null
  readonly error: string | null
  readonly pending: boolean
  readonly onReturnToEditedPage: () => void
  readonly automaticSync: boolean
  readonly onToggleAutomaticSync: () => void
  readonly isNetworkPreview: boolean
  readonly testStateNotice: string | null
  readonly testControlsOpen: boolean
  readonly onToggleTestControls: () => void
  readonly onResetTestProfile: () => void
  readonly onResetTestProgress: () => void
  readonly onToggleProfileMode: (enabled: boolean) => void
}

/** Renders the popup toolbar, messages, and host for the real player composition. */
function renderPopupReader(state: PopupReaderState): RemixNode {
  const { snapshot, error, pending, isNetworkPreview } = state
  return <div
    id="elce-popup-reader"
    className={isNetworkPreview ? 'elce-popup-reader elce-popup-reader--network-preview' : 'elce-popup-reader'}
  >
    {isNetworkPreview ? null : <header
      id="elce-popup-reader-header"
      className="elce-popup-reader__header"
    >
      <h1
        id="elce-popup-reader-title"
      >
        Lecture Elcé
      </h1>
      <div
        id="elce-popup-reader-actions"
        className="elce-popup-reader__actions"
      >
        <button
          id="elce-popup-reader-test-controls"
          type="button"
          title="Accéder au profil et aux réglages du test auteur"
          aria-label="Accéder au profil et aux réglages du test auteur"
          aria-expanded={state.testControlsOpen}
          aria-controls="elce-popup-reader-test-panel"
          disabled={snapshot === null || pending}
          mix={on<HTMLButtonElement, 'click'>('click', state.onToggleTestControls)}
        >
          {renderLucideIcon(SUMMARY_PROFILE_ACCESS_ICON, 'elce-popup-reader-test-controls-icon')}
          <span className="elce-popup-reader__action-label">Test auteur</span>
        </button>
        <button
          id="elce-popup-reader-edited-page"
          type="button"
          title="Revenir sur la page éditée et reprendre la synchronisation"
          aria-label="Revenir sur la page éditée et reprendre la synchronisation"
          disabled={snapshot === null || pending}
          mix={on<HTMLButtonElement, 'click'>('click', state.onReturnToEditedPage)}
        >
          {renderLucideIcon(FileText, 'elce-popup-reader-edited-page-icon')}
          <span
            id="elce-popup-reader-edited-page-label"
            className="elce-popup-reader__action-label"
          >
            Revenir sur la page éditée
          </span>
        </button>
        <button
          id="elce-popup-reader-sync"
          type="button"
          title={state.automaticSync ? 'Arrêter la synchronisation automatique' : 'Activer la synchronisation automatique'}
          aria-label={state.automaticSync ? 'Arrêter la synchronisation automatique' : 'Activer la synchronisation automatique'}
          aria-pressed={state.automaticSync}
          disabled={snapshot === null}
          mix={on<HTMLButtonElement, 'click'>('click', state.onToggleAutomaticSync)}
        >
          {renderLucideIcon(RefreshCw, 'elce-popup-reader-sync-icon')}
          <span
            id="elce-popup-reader-sync-label"
            className="elce-popup-reader__action-label"
          >
            {state.automaticSync ? 'Synchro active' : 'Synchro arrêtée'}
          </span>
        </button>
      </div>
    </header>}
    {isNetworkPreview || !state.testControlsOpen || snapshot === null ? null : <section
      id="elce-popup-reader-test-panel"
      className="elce-popup-reader__test-panel"
      role="dialog"
      aria-label="Réglages du test auteur"
    >
      <label id="elce-popup-reader-profile-mode-label" htmlFor="elce-popup-reader-profile-mode">
        <input
          id="elce-popup-reader-profile-mode"
          type="checkbox"
          checked={snapshot.testState.profileEnabled}
          mix={on<HTMLInputElement, 'change'>('change', (event) => state.onToggleProfileMode(event.currentTarget.checked))}
        />
        Appliquer le profil et ses filtres
      </label>
      <button id="elce-popup-reader-reset-profile" type="button" mix={on<HTMLButtonElement, 'click'>('click', state.onResetTestProfile)}>
        Réinitialiser le profil
      </button>
      <button id="elce-popup-reader-reset-progress" type="button" mix={on<HTMLButtonElement, 'click'>('click', state.onResetTestProgress)}>
        Réinitialiser la progression
      </button>
      {state.testStateNotice === null ? null : <p id="elce-popup-reader-test-notice" role="status">{state.testStateNotice}</p>}
    </section>}
    <main
      id="elce-popup-reader-main"
      className={isNetworkPreview ? 'elce-popup-reader__main elce-popup-reader__main--network-preview' : 'elce-popup-reader__main'}
    >
      {error === null ? null : <p
        id="elce-popup-reader-error"
        role="alert"
      >
        {error}
      </p>}
      {snapshot === null && !isNetworkPreview && error === null
        ? <p
          id="elce-popup-reader-loading"
        >
          Chargement de la lecture…
        </p>
        : snapshot === null ? null : <div
          id="elce-player-stage"
          className="elce-player-stage"
          aria-label="Prévisualisation du document"
        >
          {!isNetworkPreview && isCatalogPage(snapshot.documentModel, snapshot.selectedPageId)
            ? <p
              id="elce-player-catalog-message"
            >
              Cette page est dans le catalogue et n’est pas diffusée.
            </p>
            : null}
        </div>}
    </main>
  </div>
}
