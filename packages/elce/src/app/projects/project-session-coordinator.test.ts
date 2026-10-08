import { describe, expect, it, vi } from 'vitest'
import { createInitialDocument, ElceDocument } from '../../domain/document/document-model'
import type { ElceDocument as ElceDocumentModel } from '../../domain/document/document-model'
import type { ElceProjectSummary } from '../../infrastructure/project-api/project-api-types'
import { ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import type { DocumentSyncState, ElceDocumentStore, MediaBlob } from '../../infrastructure/indexed-db/document-store-types'
import { ProjectSessionCoordinator } from './project-session-coordinator'

class MemoryProjectStore implements ElceDocumentStore {
  public readonly documents = new Map<string, ElceDocumentModel>()
  public readonly checkpoints = new Map<string, DocumentSyncState>()
  public readonly media = new Map<string, Blob>()
  public readonly deletedProjects: string[] = []

  public async loadDocument(documentId: string): Promise<ElceDocumentModel | null> {
    return this.documents.get(documentId) ?? null
  }

  public async saveDocument(document: ElceDocumentModel): Promise<void> {
    this.documents.set(document.id, document)
    const previous = await this.loadSyncState(document.id)
    await this.saveSyncState({ ...previous, status: 'pending' })
  }

  public async saveDocumentAndDeleteMedia(document: ElceDocumentModel, mediaIds: readonly string[]): Promise<void> {
    await this.saveDocument(document)
    for (const mediaId of mediaIds) this.media.delete(mediaId)
  }

  public async deleteDocument(documentId: string): Promise<void> {
    this.deletedProjects.push(documentId)
    this.documents.delete(documentId)
    this.checkpoints.delete(documentId)
  }

  public async deleteMedia(mediaIds: readonly string[]): Promise<void> {
    for (const mediaId of mediaIds) this.media.delete(mediaId)
  }

  public async loadSyncState(documentId: string): Promise<DocumentSyncState> {
    return this.checkpoints.get(documentId) ?? {
      documentId,
      remoteRevision: null,
      uploadedMediaIds: [],
      status: 'pending',
    }
  }

  public async saveSyncState(state: DocumentSyncState): Promise<void> {
    this.checkpoints.set(state.documentId, state)
  }

  public async saveMedia(media: MediaBlob): Promise<void> {
    this.media.set(media.id, media.blob)
  }

  public async loadMedia(mediaId: string): Promise<Blob | null> {
    return this.media.get(mediaId) ?? null
  }
}

describe('Elcé project session lifecycle', () => {
  it('creates a uniquely identified project and closes it without deleting the server copy', async () => {
    const remote = new Map<string, ElceDocumentModel>()
    const store = new MemoryProjectStore()
    const { coordinator } = createCoordinator(remote, store)
    const emptyDocument = createInitialDocument()

    const created = await coordinator.perform({ kind: 'create' }, emptyDocument, null, 'waiting', false)

    expect(created.status).toBe('opening')
    expect(created.activeProject).toMatchObject({ name: 'Projet 1', revision: 0 })
    expect(created.document?.id).not.toBe('elce-document')
    expect(remote.has(created.document!.id)).toBe(true)
    expect(store.checkpoints.get(created.document!.id)).toMatchObject({ remoteRevision: 0, status: 'synced' })

    const closed = await coordinator.perform({ kind: 'close' }, created.document!, created.activeProject, 'waiting', false)

    expect(closed.status).toBe('list')
    expect(closed.activeProject).toBeNull()
    expect(remote.has(created.document!.id)).toBe(true)
    expect(store.documents.has(created.document!.id)).toBe(false)
    expect(store.deletedProjects).toEqual([created.document!.id])
  })

  it('retains edit access after deleting a different, inactive project', async () => {
    const remote = new Map<string, ElceDocumentModel>()
    const current = documentForProject('current-project', 'Courant')
    const inactive = documentForProject('inactive-project', 'Inactif')
    remote.set(current.id, current)
    remote.set(inactive.id, inactive)
    const store = new MemoryProjectStore()
    const { coordinator } = createCoordinator(remote, store)
    const currentSummary = summaryFor(current)
    const inactiveSummary = summaryFor(inactive)
    await coordinator.perform({ kind: 'open', projectId: current.id }, createInitialDocument(), null, 'waiting', false)

    const deleted = await coordinator.perform({ kind: 'delete', projectId: inactive.id }, current, currentSummary, 'waiting', true)

    expect(deleted.projects.map((project) => project.id)).toEqual([current.id])
    expect(deleted.activeProject).toEqual(currentSummary)
    expect(deleted.editAccess).toBe('active')
    expect(deleted.status).toBe('active')
    expect(remote.has(inactive.id)).toBe(false)
    expect(remote.has(current.id)).toBe(true)
    expect(store.deletedProjects).toEqual([inactive.id])
    expect(inactiveSummary.id).toBe(inactive.id)
  })

  it('does not create a project during bootstrap when the server list is empty', async () => {
    const remote = new Map<string, ElceDocumentModel>()
    const store = new MemoryProjectStore()
    const { coordinator, request } = createCoordinator(remote, store)

    const bootstrapped = await coordinator.perform(
      { kind: 'bootstrap', rememberedProjectId: null },
      createInitialDocument(),
      null,
      'waiting',
      false,
    )

    expect(bootstrapped).toMatchObject({ projects: [], activeProject: null, document: null, status: 'list' })
    expect(remote.size).toBe(0)
    expect(request.mock.calls.map(([, init]) => init?.method ?? 'GET')).toEqual(['GET'])
  })
})

/** Creates the API fake and lifecycle coordinator used by the tests. */
function createCoordinator(
  remote: Map<string, ElceDocumentModel>,
  store: MemoryProjectStore,
): Readonly<{ coordinator: ProjectSessionCoordinator; request: ReturnType<typeof vi.fn<typeof fetch>> }> {
  const request = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = new URL(input.toString())
    switch (`${init?.method ?? 'GET'} ${url.pathname}`) {
      case 'GET /api/projects':
        return Response.json({ projects: [...remote.values()].map(summaryFor) })
      case 'POST /api/projects': {
        const data = JSON.parse(String(init?.body)) as Parameters<typeof ElceDocument.fromJSON>[0]
        const document = ElceDocument.fromJSON(data)
        remote.set(document.id, document)
        return Response.json({ project: summaryFor(document) }, { status: 201, headers: { ETag: '"0"' } })
      }
      case `GET /api/projects/${decodeURIComponent(url.pathname.split('/').at(-1) ?? '')}`: {
        const projectId = decodeURIComponent(url.pathname.split('/').at(-1) ?? '')
        const document = remote.get(projectId)
        if (document === undefined) return Response.json({ error: 'project_not_found' }, { status: 404 })
        return Response.json({ project: summaryFor(document), document: document.toJSON() }, {
          headers: { ETag: '"0"' },
        })
      }
      case `DELETE /api/projects/${decodeURIComponent(url.pathname.split('/').at(-1) ?? '')}`: {
        remote.delete(decodeURIComponent(url.pathname.split('/').at(-1) ?? ''))
        return new Response(null, { status: 204 })
      }
      default:
        throw new Error(`Requête non prévue dans ce test : ${init?.method ?? 'GET'} ${url.pathname}`)
    }
  })
  return {
    coordinator: new ProjectSessionCoordinator(store, new ElceProjectApiClient('http://elce.test', request), null),
    request,
  }
}

/** Builds a project identity and generated name for a compact test fixture. */
function documentForProject(id: string, name: string): ElceDocumentModel {
  return ElceDocument.fromJSON({ ...createInitialDocument().toJSON(), id, name })
}

/** Maps the stable document identity to its server-owned project summary. */
function summaryFor(document: ElceDocumentModel): ElceProjectSummary {
  return { id: document.id, name: document.data.name, revision: 0 }
}
