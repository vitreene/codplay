import { on, type Handle, type RemixNode } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'
import { FileText, RefreshCw } from 'lucide-static'
import { ElceDocument, createInitialDocument } from '../../domain/document/document-model'
import type { PageId } from '../../domain/document/document-types'
import { IndexedDbDocumentStore } from '../../infrastructure/indexed-db/document-store'
import { ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import type { ElcePageSceneCache } from '../../player/player-composition-types'
import type { ElcePlayerComposition } from '../../player/elce-player-composition'
import { renderLucideIcon } from '../remix/lucide-static-icon'
import { isPopupPreviewResponse, type PopupPreviewRequest } from './popup-preview-messages'
import { createPlayerPreviewComposition, isCatalogPage } from './player-preview'

type PopupPlayerProps = Readonly<{
  sessionId: string
  startPageId: PageId | null
}>

type ReaderSnapshot = Readonly<{
  documentModel: ElceDocument
  selectedPageId: PageId | null
  mediaSources: Readonly<Record<string, string>>
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

/** Renders the independent popup while preserving the existing XState message protocol. */
export function PopupPlayer(handle: Handle<PopupPlayerProps>) {
  const { sessionId, startPageId } = handle.props
  let readerSnapshot: ReaderSnapshot | null = null
  let error: string | null = null
  let pending = false
  const sourceUrls = new Map<string, string>()
  const sceneCache: ElcePageSceneCache = new Map()
  let composition: ElcePlayerComposition | null = null
  let requestId = 0
  let pendingRequest: PendingRequest | null = { id: 0, type: 'ready' }

  /** Refreshes the native Remix view while its component is still mounted. */
  const update = (): void => {
    if (!handle.signal.aborted) void handle.update()
  }

  /** Requests a fresh editor snapshot or its selected page through the opener. */
  const requestEditor = (type: PopupPreviewRequest['type']): void => {
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

    /** Loads one editor or persisted document into the reader's own media context. */
    const presentDocument = async (documentModel: ElceDocument, selectedPageId: PageId | null): Promise<void> => {
      try {
        const mediaSources = await loadMediaSources(documentModel, store, api, sourceUrls)
        if (disposed || handle.signal.aborted) return
        const nextSnapshot = {
          documentModel,
          selectedPageId,
          mediaSources,
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
      if (event.origin !== window.location.origin || event.source !== window.opener) return
      if (!isPopupPreviewResponse(event.data) || event.data.sessionId !== sessionId) return
      if (event.data.requestId !== pendingRequest?.id) return
      if (event.data.type === 'snapshot') {
        if (event.data.requestId === 0) receivedEditorSnapshot = true
        try {
          void presentDocument(ElceDocument.fromJSON(event.data.document), event.data.selectedPageId)
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

    window.addEventListener('message', receiveMessage)
    window.opener?.postMessage({ type: 'ready', sessionId, requestId: 0 }, window.location.origin)
    const fallbackTimer = window.setTimeout(() => {
      if (receivedEditorSnapshot || readerSnapshot !== null) return
      void store.loadDocument(createInitialDocument().id).then((stored) => {
        if (disposed || receivedEditorSnapshot) return
        if (stored === null) {
          pendingRequest = null
          error = 'Aucun document Elcé n’est disponible pour la lecture.'
          update()
          return
        }
        void presentDocument(stored, startPageId)
      }).catch((cause: unknown) => {
        if (!disposed) {
          pendingRequest = null
          error = cause instanceof Error ? cause.message : 'La lecture du document a échoué.'
          update()
        }
      })
    }, 3000)

    const dispose = (): void => {
      disposed = true
      window.clearTimeout(fallbackTimer)
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
  })
}

interface PopupReaderState {
  readonly snapshot: ReaderSnapshot | null
  readonly error: string | null
  readonly pending: boolean
  readonly requestEditor: (type: PopupPreviewRequest['type']) => void
}

/** Renders the popup toolbar, messages, and host for the real player composition. */
function renderPopupReader(state: PopupReaderState): RemixNode {
  const { snapshot, error, pending, requestEditor } = state
  return jsx('div', {
    id: 'elce-popup-reader',
    className: 'elce-popup-reader',
    children: [
      jsx('header', {
        id: 'elce-popup-reader-header',
        className: 'elce-popup-reader__header',
        children: [
          jsx('h1', { id: 'elce-popup-reader-title', children: 'Lecture Elcé' }),
          jsx('div', {
            id: 'elce-popup-reader-actions',
            className: 'elce-popup-reader__actions',
            children: [
              jsx('button', {
                id: 'elce-popup-reader-edited-page',
                type: 'button',
                title: 'Réafficher la page éditée',
                'aria-label': 'Réafficher la page éditée',
                disabled: snapshot === null || pending,
                mix: on<HTMLButtonElement, 'click'>('click', () => requestEditor('show-edited-page')),
                children: [
                  renderLucideIcon(FileText, 'elce-popup-reader-edited-page-icon', 16),
                  jsx('span', {
                    id: 'elce-popup-reader-edited-page-label',
                    className: 'elce-popup-reader__action-label',
                    children: 'Réafficher la page éditée',
                  }),
                ],
              }),
              jsx('button', {
                id: 'elce-popup-reader-sync',
                type: 'button',
                title: pending ? 'Synchronisation…' : 'Synchroniser',
                'aria-label': pending ? 'Synchronisation…' : 'Synchroniser',
                disabled: snapshot === null || pending,
                mix: on<HTMLButtonElement, 'click'>('click', () => requestEditor('synchronize')),
                children: [
                  renderLucideIcon(RefreshCw, 'elce-popup-reader-sync-icon', 16),
                  jsx('span', {
                    id: 'elce-popup-reader-sync-label',
                    className: 'elce-popup-reader__action-label',
                    children: pending ? 'Synchronisation…' : 'Synchroniser',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      jsx('main', {
        id: 'elce-popup-reader-main',
        className: 'elce-popup-reader__main',
        children: [
          error === null ? null : jsx('p', { id: 'elce-popup-reader-error', role: 'alert', children: error }),
          snapshot === null
            ? jsx('p', { id: 'elce-popup-reader-loading', children: 'Chargement de la lecture…' })
            : jsx('div', {
                id: 'elce-player-stage',
                className: 'elce-player-stage',
                'aria-label': 'Prévisualisation du document',
                children: isCatalogPage(snapshot.documentModel, snapshot.selectedPageId)
                  ? jsx('p', {
                      id: 'elce-player-catalog-message',
                      children: 'Cette page est dans le catalogue et n’est pas diffusée.',
                    })
                  : null,
              }),
        ],
      }),
    ],
  })
}
