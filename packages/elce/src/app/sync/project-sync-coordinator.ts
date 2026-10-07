import { MEDIA_TYPE } from '../../config/document-config'
import { PROJECT_SYNC_DEBOUNCE_MS } from '../../config/api-config'
import { mediaTypeFromMimeType } from '../../domain/media/media-resource-service'
import type { ElceDocument } from '../../domain/document/document-model'
import type { DocumentSyncState, ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'
import { ElceProjectApiClient, ElceProjectApiError } from '../../infrastructure/project-api/project-api-client'
import type { controllerMachine } from '../controller/controller-machine'
import type { Actor } from 'xstate'

/** Coalesces local saves into serialized project and media API requests. */
export class ProjectSyncCoordinator {
  private readonly controller: Actor<typeof controllerMachine>
  private readonly store: ElceDocumentStore
  private readonly api: ElceProjectApiClient
  private latestDocument: ElceDocument | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private runningCompletion: Promise<void> | null = null
  private queued = false
  private suspended = false
  private lastFailure: unknown = null

  public constructor(
    controller: Actor<typeof controllerMachine>,
    store: ElceDocumentStore,
    api: ElceProjectApiClient = new ElceProjectApiClient(),
  ) {
    this.controller = controller
    this.store = store
    this.api = api
    if (typeof window !== 'undefined') window.addEventListener('online', this.retry)
  }

  /** Schedules synchronization after the matching document has been cached. */
  public schedule(document: ElceDocument): void {
    this.latestDocument = document
    this.lastFailure = null
    this.controller.send({ type: 'document.sync.status', status: 'pending' })
    if (this.timer !== null) clearTimeout(this.timer)
    if (this.suspended) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, PROJECT_SYNC_DEBOUNCE_MS)
  }

  /** Waits for the queued document and every referenced media upload to be acknowledged. */
  public async waitUntilCurrentDocumentSynced(): Promise<void> {
    if (this.suspended) throw new Error('La synchronisation Elcé est suspendue.')

    const document = this.controller.getSnapshot().context.document
    if (this.latestDocument !== document) {
      throw new Error('Le document courant doit être enregistré localement avant sa synchronisation.')
    }

    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.lastFailure = null
    await this.flush()

    if (this.controller.getSnapshot().context.document !== document) {
      throw new Error('Le document a changé pendant l’attente de sa synchronisation.')
    }

    const syncState = await this.store.loadSyncState(document.id)
    switch (syncState.status) {
      case 'synced':
        if (syncState.remoteRevision !== null) return
        break
      case 'conflict':
        throw new Error('Le document présente un conflit avec sa version serveur.')
      case 'pending':
        break
    }

    if (this.lastFailure !== null) throw this.lastFailure
    throw new Error('La synchronisation du document ne s’est pas terminée.')
  }

  /** Stops new network writes and waits for the current write to settle. */
  public async suspend(): Promise<void> {
    this.suspended = true
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    if (this.runningCompletion !== null) await this.runningCompletion
  }

  /** Resumes server synchronization from the latest locally restored document. */
  public resume(document: ElceDocument): void {
    this.suspended = false
    this.schedule(document)
  }

  /** Releases pending timers and the browser network-recovery listener. */
  public destroy(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    if (typeof window !== 'undefined') window.removeEventListener('online', this.retry)
  }

  /** Serializes server writes and repeats with the latest saved document. */
  private async flush(): Promise<void> {
    if (this.running) {
      this.queued = true
      await this.runningCompletion
      return
    }
    if (this.suspended) return
    this.running = true
    let complete!: () => void
    this.runningCompletion = new Promise<void>((resolve) => { complete = resolve })
    try {
      do {
        if (this.suspended) break
        this.queued = false
        const document = this.latestDocument
        if (document === null) return
        await this.synchronize(document)
        if (this.latestDocument !== document && !this.suspended) this.queued = true
      } while (this.queued && !this.suspended)
    } catch (error) {
      this.lastFailure = error
      this.controller.send({ type: 'document.sync.status', status: 'pending' })
      console.error('La synchronisation locale Elcé a échoué.', error)
    } finally {
      this.running = false
      this.runningCompletion = null
      complete()
      if (this.queued && !this.suspended) void this.flush()
    }
  }

  /** Saves the current document revision before transferring its media. */
  private async synchronize(document: ElceDocument): Promise<void> {
    let syncState = await this.store.loadSyncState(document.id)
    if (syncState.status === 'conflict') {
      this.controller.send({ type: 'document.sync.status', status: 'conflict' })
      return
    }
    if (syncState.status === 'synced' && syncState.remoteRevision !== null) {
      this.controller.send({ type: 'document.sync.status', status: 'synced' })
      return
    }

    let remoteRevision: number
    switch (syncState.remoteRevision) {
      case null:
        remoteRevision = await this.createOrConfirmProject(document, syncState)
        if (remoteRevision < 0) return
        break
      default:
        remoteRevision = await this.saveOrConfirmDocument(document, syncState)
        if (remoteRevision < 0) return
        break
    }

    syncState = { ...syncState, remoteRevision, status: 'pending' }
    await this.store.saveSyncState(syncState)

    for (const media of document.medias) {
      if (syncState.uploadedMediaIds.includes(media.id)) continue
      const blob = await this.store.loadMedia(media.id)
      if (blob === null) throw new Error(`Le média local ${media.id} est absent avant son transfert.`)

      let source: string
      try {
        source = await this.api.uploadMedia(document.id, media, blob)
      } catch (error) {
        if (this.mergeServerDuplicate(error, document, media.id)) return
        throw error
      }

      syncState = {
        ...syncState,
        uploadedMediaIds: [...syncState.uploadedMediaIds, media.id],
        status: 'pending',
      }
      await this.store.saveSyncState(syncState)
      if (mediaTypeFromMimeType(media.mimeType) === MEDIA_TYPE.IMAGE) {
        await this.store.deleteMedia([media.id])
        this.replaceMediaSource(media.id, source)
      }
    }

    const status = this.latestDocument === document ? 'synced' : 'pending'
    await this.store.saveSyncState({ ...syncState, status })
    this.controller.send({ type: 'document.sync.status', status })
  }

  /** Creates a project or verifies an identical remote project after a lost checkpoint. */
  private async createOrConfirmProject(document: ElceDocument, syncState: DocumentSyncState): Promise<number> {
    try {
      return await this.api.createProject(document)
    } catch (error) {
      if (!(error instanceof ElceProjectApiError) || error.code !== 'project_already_exists') throw error
      return this.confirmRemoteDocument(document, syncState)
    }
  }

  /** Updates a project with If-Match and marks a changed remote revision as conflict. */
  private async saveOrConfirmDocument(document: ElceDocument, syncState: DocumentSyncState): Promise<number> {
    try {
      return await this.api.saveDocument(document, syncState.remoteRevision!)
    } catch (error) {
      if (!(error instanceof ElceProjectApiError) || error.code !== 'revision_mismatch') throw error
      return this.confirmRemoteDocument(document, syncState)
    }
  }

  /** Accepts a lost response only when the server document already matches locally. */
  private async confirmRemoteDocument(document: ElceDocument, syncState: DocumentSyncState): Promise<number> {
    const remote = await this.api.readProject(document.id)
    if (JSON.stringify(remote.document.toJSON()) === JSON.stringify(document.toJSON())) return remote.revision
    await this.store.saveSyncState({ ...syncState, remoteRevision: remote.revision, status: 'conflict' })
    this.controller.send({ type: 'document.sync.status', status: 'conflict' })
    return -1
  }

  /** Merges content the server identifies as a duplicate through the document command. */
  private mergeServerDuplicate(error: unknown, document: ElceDocument, duplicateMediaId: string): boolean {
    if (!(error instanceof ElceProjectApiError) || error.code !== 'media_already_exists' || error.mediaId === null) return false
    if (!document.medias.some((media) => media.id === error.mediaId)) return false
    if (this.controller.getSnapshot().context.editAccess !== 'active') return false
    this.controller.send({
      type: 'document.apply',
      command: { type: 'media.merge', canonicalMediaId: error.mediaId, duplicateMediaIds: [duplicateMediaId] },
    })
    return true
  }

  /** Replaces the imported Blob URL with the confirmed server URL in XState. */
  private replaceMediaSource(mediaId: string, source: string): void {
    const previous = this.controller.getSnapshot().context.mediaSources[mediaId]
    if (previous?.startsWith('blob:') === true && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previous)
    this.controller.send({ type: 'media.source.register', mediaId, source })
  }

  /** Schedules a retry after the browser reports network access again. */
  private readonly retry = (): void => {
    const document = this.latestDocument
    if (document !== null) this.schedule(document)
  }
}
