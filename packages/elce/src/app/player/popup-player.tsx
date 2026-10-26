import { on, type Handle, type RemixNode } from 'remix/ui'

import { FileText, RefreshCw } from 'lucide-static'
import { ElceDocument, createInitialDocument } from '../../domain/document/document-model'
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
  const requestEditor = (type: PopupPreviewRequest['type']): void => {
    if (sessionId === null) return
    if (pendingRequest !== null && pendingRequest.type !== 'ready') return
    if (window.opener === null || window.opener.closed) {
      error = 'La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur.'
      update()
      return
    }
    const id = ++requestId
    pendingRequest = { id, type }
    pending = true
    error = null
    update()
    window.opener.postMessage({ type, sessionId, requestId: id }, window.location.origin)
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
      sceneCache,
    })
    if (composition !== null) {
      const currentComposition = composition
      void currentComposition.initialize().catch((cause: unknown) => {
        if (!handle.signal.aborted && composition === currentComposition) {
          error = cause instanceof Error ? cause.message : 'La prévisualisation n’a pas pu démarrer.'
          update()
        }
      })
    }
  }

  handle.queueTask(() => {
    document.title = 'Elcé — lecture'
    const store = new IndexedDbDocumentStore()
    const api = new ElceProjectApiClient()
    let disposed = false
    let receivedEditorSnapshot = false
    let fallbackTimer: number | null = null

    /** Loads an editor snapshot or synchronized project into the real player. */
    const presentDocument = async (
      documentModel: ElceDocument,
      selectedPageId: PageId | null,
      fromServer: boolean,
    ): Promise<void> => {
      try {
        const mediaSources = fromServer
          ? loadServerMediaSources(documentModel, api)
          : await loadMediaSources(documentModel, store, api, sourceUrls)
        if (disposed || handle.signal.aborted) return
        testStateSession = await ProjectTestStateSession.open(api, documentModel.id, { allowOffline: !isNetworkPreview })
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
        await presentSnapshot(nextSnapshot)
        if (disposed || handle.signal.aborted) return
        pendingRequest = null
        pending = false
        update()
      } catch (cause: unknown) {
        if (!disposed && !handle.signal.aborted) {
          error = cause instanceof Error ? cause.message : 'La lecture du document a échoué.'
          pendingRequest = null
          pending = false
          update()
        }
      }
    }

    /** Accepts only messages from the editor that opened this reader session. */
    const receiveMessage = (event: MessageEvent): void => {
      if (sessionId === null) return
      if (event.origin !== window.location.origin || event.source !== window.opener) return
      if (!isPopupPreviewResponse(event.data) || event.data.sessionId !== sessionId) return
      if (event.data.requestId !== pendingRequest?.id) return
      if (event.data.type === 'snapshot') {
        if (event.data.requestId === 0) receivedEditorSnapshot = true
        try {
          void presentDocument(ElceDocument.fromJSON(event.data.document), event.data.selectedPageId, false)
        } catch (cause: unknown) {
          pendingRequest = null
          pending = false
          error = cause instanceof Error ? cause.message : 'Le document reçu est invalide.'
          update()
        }
        return
      }
      if (event.data.type === 'edited-page') {
        const previous = readerSnapshot
        if (previous === null) return
        const selectedPageId = event.data.selectedPageId
        const pageExists = selectedPageId === null || previous.documentModel.pages.some((page) => page.id === selectedPageId)
        pendingRequest = null
        if (!pageExists) {
          requestEditor('synchronize')
          return
        }
        const nextSnapshot = { ...previous, selectedPageId }
        pendingRequest = null
        void presentSnapshot(nextSnapshot)
          .then(() => {
            pending = false
            error = null
            update()
          })
          .catch((cause: unknown) => {
            pending = false
            error = cause instanceof Error ? cause.message : 'La page éditée n’a pas pu être affichée.'
            update()
          })
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
      window.opener?.postMessage({ type: 'ready', sessionId, requestId: 0 }, window.location.origin)
      fallbackTimer = window.setTimeout(() => {
        if (receivedEditorSnapshot || readerSnapshot !== null) return
        void store.loadDocument(createInitialDocument().id).then((stored) => {
          if (disposed || receivedEditorSnapshot) return
          if (stored === null) {
            pendingRequest = null
            error = 'Aucun document Elcé n’est disponible pour la lecture.'
            update()
            return
          }
          void presentDocument(stored, startPageId, false)
        }).catch((cause: unknown) => {
          if (!disposed) {
            pendingRequest = null
            error = cause instanceof Error ? cause.message : 'La lecture du document a échoué.'
            update()
          }
        })
      }, 3000)
    }

    const dispose = (): void => {
      disposed = true
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer)
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
    requestEditor,
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
  readonly requestEditor: (type: PopupPreviewRequest['type']) => void
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
  const { snapshot, error, pending, requestEditor, isNetworkPreview } = state
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
          aria-expanded={state.testControlsOpen}
          aria-controls="elce-popup-reader-test-panel"
          disabled={snapshot === null || pending}
          mix={on<HTMLButtonElement, 'click'>('click', state.onToggleTestControls)}
        >
          {renderLucideIcon(SUMMARY_PROFILE_ACCESS_ICON, 'elce-popup-reader-test-controls-icon')}
          Test auteur
        </button>
        <button
          id="elce-popup-reader-edited-page"
          type="button"
          title="Réafficher la page éditée"
          aria-label="Réafficher la page éditée"
          disabled={snapshot === null || pending}
          mix={on<HTMLButtonElement, 'click'>('click', () => requestEditor('show-edited-page'))}
        >
          {renderLucideIcon(FileText, 'elce-popup-reader-edited-page-icon')}
          <span
            id="elce-popup-reader-edited-page-label"
            className="elce-popup-reader__action-label"
          >
            Réafficher la page éditée
          </span>
        </button>
        <button
          id="elce-popup-reader-sync"
          type="button"
          title={pending ? 'Synchronisation…' : 'Synchroniser'}
          aria-label={pending ? 'Synchronisation…' : 'Synchroniser'}
          disabled={snapshot === null || pending}
          mix={on<HTMLButtonElement, 'click'>('click', () => requestEditor('synchronize'))}
        >
          {renderLucideIcon(RefreshCw, 'elce-popup-reader-sync-icon')}
          <span
            id="elce-popup-reader-sync-label"
            className="elce-popup-reader__action-label"
          >
            {pending ? 'Synchronisation…' : 'Synchroniser'}
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
      {snapshot === null && !isNetworkPreview
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
