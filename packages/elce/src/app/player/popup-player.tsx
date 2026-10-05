import { useEffect, useRef, useState } from 'react'
import { FileText, RefreshCw } from 'lucide-react'
import { ElceDocument, createInitialDocument } from '../../domain/document-model'
import { IndexedDbDocumentStore } from '../../infrastructure/indexed-db/document-store'
import type { ElcePageSceneCache } from '../../player/player-composition-types'
import { PlayerPreview } from './player-preview'
import { isPopupPreviewResponse, type PopupPreviewRequest } from './popup-preview-messages'
import '../layout/app-layout.css'
import './popup-player.css'

type PopupPlayerProps = Readonly<{
  sessionId: string
  startPageId: string | null
}>

type ReaderSnapshot = Readonly<{
  documentModel: ElceDocument
  selectedPageId: string | null
  mediaSources: Readonly<Record<string, string>>
  revision: number
}>

type PendingRequest = Readonly<{
  id: number
  type: PopupPreviewRequest['type']
}>

/** Reads one document's media from the established IndexedDB store into this window. */
async function loadMediaSources(
  documentModel: ElceDocument,
  store: IndexedDbDocumentStore,
  sourceUrls: Map<string, string>,
): Promise<Readonly<Record<string, string>>> {
  const sources: Record<string, string> = {}
  for (const media of documentModel.medias) {
    let source = sourceUrls.get(media.id)
    if (source === undefined) {
      const blob = await store.loadMedia(media.id)
      if (blob === null) throw new Error(`Le média ${media.id} est absent du stockage Elcé.`)
      source = URL.createObjectURL(blob)
      sourceUrls.set(media.id, source)
    }
    sources[media.id] = source
  }
  return sources
}

/** Mounts the real Elcé player in a browser window independent of the editor. */
export function PopupPlayer({ sessionId, startPageId }: PopupPlayerProps) {
  const [snapshot, setSnapshot] = useState<ReaderSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const sourceUrlsRef = useRef(new Map<string, string>())
  const sceneCacheRef = useRef<ElcePageSceneCache>(new Map())
  const snapshotRef = useRef<ReaderSnapshot | null>(null)
  const requestIdRef = useRef(0)
  const pendingRequestRef = useRef<PendingRequest | null>({ id: 0, type: 'ready' })

  /** Requests a fresh editor snapshot or its selected page through the existing parent window. */
  const requestEditor = (type: PopupPreviewRequest['type']) => {
    if (pendingRequestRef.current !== null && pendingRequestRef.current.type !== 'ready') return
    if (window.opener === null || window.opener.closed) {
      setError('La fenêtre de l’éditeur est fermée. Rouvre la lecture depuis l’éditeur.')
      return
    }
    const id = ++requestIdRef.current
    pendingRequestRef.current = { id, type }
    setPending(true)
    setError(null)
    window.opener.postMessage({ type, sessionId, requestId: id }, window.location.origin)
  }

  useEffect(() => {
    let disposed = false
    let receivedEditorSnapshot = false
    const store = new IndexedDbDocumentStore()
    const sourceUrls = sourceUrlsRef.current

    /** Loads one editor or persisted document into the reader's own media context. */
    const presentDocument = async (documentModel: ElceDocument, selectedPageId: string | null) => {
      try {
        const mediaSources = await loadMediaSources(documentModel, store, sourceUrls)
        if (disposed) return
        const nextSnapshot = {
          documentModel,
          selectedPageId,
          mediaSources,
          revision: (snapshotRef.current?.revision ?? -1) + 1,
        }
        snapshotRef.current = nextSnapshot
        setSnapshot(nextSnapshot)
        setError(null)
      } catch (cause: unknown) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'La lecture du document a échoué.')
      } finally {
        if (!disposed) {
          pendingRequestRef.current = null
          setPending(false)
        }
      }
    }

    /** Accepts only messages from the editor that opened this reader session. */
    const receiveMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.opener) return
      if (!isPopupPreviewResponse(event.data) || event.data.sessionId !== sessionId) return
      if (event.data.requestId !== pendingRequestRef.current?.id) return
      if (event.data.type === 'snapshot') {
        if (event.data.requestId === 0) receivedEditorSnapshot = true
        try {
          void presentDocument(ElceDocument.fromJSON(event.data.document), event.data.selectedPageId)
        } catch (cause: unknown) {
          pendingRequestRef.current = null
          setPending(false)
          setError(cause instanceof Error ? cause.message : 'Le document reçu est invalide.')
        }
        return
      }
      if (event.data.type === 'edited-page') {
        const previous = snapshotRef.current
        if (previous === null) return
        const selectedPageId = event.data.selectedPageId
        const pageExists = selectedPageId === null || previous.documentModel.pages.some((page) => page.id === selectedPageId)
        pendingRequestRef.current = null
        if (!pageExists) {
          requestEditor('synchronize')
          return
        }
        const nextSnapshot = { ...previous, selectedPageId, revision: previous.revision + 1 }
        snapshotRef.current = nextSnapshot
        setSnapshot(nextSnapshot)
        setPending(false)
        setError(null)
      }
    }

    window.addEventListener('message', receiveMessage)
    window.opener?.postMessage({ type: 'ready', sessionId, requestId: 0 }, window.location.origin)
    const fallbackTimer = window.setTimeout(() => {
      if (receivedEditorSnapshot || snapshotRef.current !== null) return
      void store.loadDocument(createInitialDocument().id).then((stored) => {
        if (disposed || receivedEditorSnapshot) return
        if (stored === null) {
          pendingRequestRef.current = null
          setError('Aucun document Elcé n’est disponible pour la lecture.')
          return
        }
        void presentDocument(stored, startPageId)
      }).catch((cause: unknown) => {
        if (!disposed) {
          pendingRequestRef.current = null
          setError(cause instanceof Error ? cause.message : 'La lecture du document a échoué.')
        }
      })
    }, 3000)

    return () => {
      disposed = true
      window.clearTimeout(fallbackTimer)
      window.removeEventListener('message', receiveMessage)
      for (const source of sourceUrls.values()) URL.revokeObjectURL(source)
      sourceUrls.clear()
      sceneCacheRef.current.clear()
    }
  }, [sessionId, startPageId])

  return (
    <div id="elce-popup-reader" className="elce-popup-reader">
      <header id="elce-popup-reader-header" className="elce-popup-reader__header">
        <h1 id="elce-popup-reader-title">Lecture Elcé</h1>
        <div id="elce-popup-reader-actions" className="elce-popup-reader__actions">
          <button
            id="elce-popup-reader-edited-page"
            type="button"
            title="Réafficher la page éditée"
            aria-label="Réafficher la page éditée"
            disabled={snapshot === null || pending}
            onClick={() => requestEditor('show-edited-page')}
          >
            <FileText aria-hidden="true" size={16} strokeWidth={2} />
            <span id="elce-popup-reader-edited-page-label" className="elce-popup-reader__action-label">
              Réafficher la page éditée
            </span>
          </button>
          <button
            id="elce-popup-reader-sync"
            type="button"
            title={pending ? 'Synchronisation…' : 'Synchroniser'}
            aria-label={pending ? 'Synchronisation…' : 'Synchroniser'}
            disabled={snapshot === null || pending}
            onClick={() => requestEditor('synchronize')}
          >
            <RefreshCw aria-hidden="true" size={16} strokeWidth={2} />
            <span id="elce-popup-reader-sync-label" className="elce-popup-reader__action-label">
              {pending ? 'Synchronisation…' : 'Synchroniser'}
            </span>
          </button>
        </div>
      </header>
      <main id="elce-popup-reader-main" className="elce-popup-reader__main">
        {error === null ? null : <p id="elce-popup-reader-error" role="alert">{error}</p>}
        {snapshot === null
          ? <p id="elce-popup-reader-loading">Chargement de la lecture…</p>
          : <PlayerPreview
              key={snapshot.revision}
              documentModel={snapshot.documentModel}
              selectedPageId={snapshot.selectedPageId}
              mediaSources={snapshot.mediaSources}
              sceneCache={sceneCacheRef.current}
            />}
      </main>
    </div>
  )
}
