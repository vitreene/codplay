import type { MediaId, MediaMetadata } from '../../document/content-document-types'
import type { ElceProjectSummary } from './project-api-types'
import type { ProjectDocumentCodec } from './project-document-codec'
import { ElceProjectApiError, ProjectHttpTransport } from './project-http-transport'

interface ProjectResponse {
  readonly project: ElceProjectSummary
}

interface ProjectListResponse {
  readonly projects: readonly ElceProjectSummary[]
}

interface ProjectDocumentResponse<TSerialized> extends ProjectResponse {
  readonly document: TSerialized
}

interface MediaResponse {
  readonly media: { readonly id: string; readonly url: string }
}

interface EditAccessResponse {
  readonly grantId: string
  readonly recovered?: boolean
}

interface EditAccessStateResponse {
  readonly held: boolean
}

/** Sends generic project document and media requests through one transport. */
export class ProjectApiClient<TDocument, TSerialized> {
  private readonly codec: ProjectDocumentCodec<TDocument, TSerialized>
  public readonly transport: ProjectHttpTransport
  private readonly grants = new Map<string, Readonly<{ pageId: string; grantId: string }>>()

  public constructor(
    codec: ProjectDocumentCodec<TDocument, TSerialized>,
    transport: ProjectHttpTransport = new ProjectHttpTransport(),
  ) {
    this.codec = codec
    this.transport = transport
  }

  /** Reserves editing for one page and remembers the returned server grant. */
  public async acquireEditAccess(
    projectId: string,
    pageId: string,
    force = false,
  ): Promise<Readonly<{ grantId: string; recovered: boolean }> | null> {
    const response = await this.transport.request(`/api/projects/${encodeURIComponent(projectId)}/edit-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, ...(force ? { force: true } : {}) }),
    })
    if (response.status === 409) {
      const body = await response.json().catch(() => null) as { error?: string } | null
      if (body?.error === 'edit_access_occupied') return null
      throw new ElceProjectApiError(response.status, body?.error ?? 'request_failed')
    }
    const { grantId, recovered = false } = await this.transport.readResponseJson<EditAccessResponse>(response)
    this.grants.set(projectId, { pageId, grantId })
    return { grantId, recovered }
  }

  /** Renews the current grant and reports when another page already replaced it. */
  public async renewEditAccess(projectId: string): Promise<boolean> {
    const response = await this.transport.request(`/api/projects/${encodeURIComponent(projectId)}/edit-access`, {
      method: 'PUT',
      headers: this.editHeaders(projectId),
    })
    if (response.status === 204) return true
    if (response.status === 409) {
      const body = await response.json().catch(() => null) as { error?: string } | null
      if (body?.error === 'edit_access_lost') return false
      throw new ElceProjectApiError(response.status, body?.error ?? 'request_failed')
    }
    await this.transport.readResponseJson<never>(response)
    return false
  }

  /** Checks ownership after an ambiguous release response. */
  public async stillHasEditAccess(projectId: string): Promise<boolean> {
    const response = await this.transport.request(`/api/projects/${encodeURIComponent(projectId)}/edit-access`, {
      headers: this.editHeaders(projectId),
    })
    return (await this.transport.readResponseJson<EditAccessStateResponse>(response)).held
  }

  /** Releases the grant held by this API client. */
  public async releaseEditAccess(projectId: string): Promise<void> {
    const response = await this.transport.request(`/api/projects/${encodeURIComponent(projectId)}/edit-access`, {
      method: 'DELETE',
      headers: this.editHeaders(projectId),
    })
    if (response.status !== 204) await this.transport.readResponseJson<never>(response)
    this.grants.delete(projectId)
  }

  /** Discards a grant that the server reports as no longer held. */
  public forgetEditAccess(projectId: string): void {
    this.grants.delete(projectId)
  }

  /** Creates the remote project from the active document and returns its revision. */
  public async createProject(document: TDocument): Promise<number> {
    const response = await this.transport.request('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.codec.writeDocument(document)),
    })
    await this.transport.readResponseJson<ProjectResponse>(response)
    return this.transport.revisionFrom(response)
  }

  /** Lists the server-owned project catalogue without loading document bodies. */
  public async listProjects(): Promise<readonly ElceProjectSummary[]> {
    const response = await this.transport.request('/api/projects')
    return (await this.transport.readResponseJson<ProjectListResponse>(response)).projects
  }

  /** Renames one server project and returns its updated summary. */
  public async renameProject(projectId: string, name: string): Promise<ElceProjectSummary> {
    const response = await this.transport.request(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.editHeaders(projectId) },
      body: JSON.stringify({ name }),
    })
    return (await this.transport.readResponseJson<ProjectResponse>(response)).project
  }

  /** Deletes one server project and its media files. */
  public async deleteProject(projectId: string): Promise<void> {
    const response = await this.transport.request(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
      headers: this.editHeaders(projectId),
    })
    if (response.status === 204) return
    await this.transport.readResponseJson<never>(response)
    throw new Error('Réponse API de suppression de projet non traitée.')
  }

  /** Reads one server document and its current revision. */
  public async readProject(documentId: string): Promise<Readonly<{ document: TDocument; revision: number }>> {
    const response = await this.transport.request(`/api/projects/${encodeURIComponent(documentId)}`, { cache: 'no-store' })
    const body = await this.transport.readResponseJson<ProjectDocumentResponse<TSerialized>>(response)
    return { document: this.codec.readDocument(body.document), revision: this.transport.revisionFrom(response) }
  }

  /** Saves the latest local document against the revision previously read. */
  public async saveDocument(document: TDocument, revision: number): Promise<number> {
    const response = await this.transport.request(`/api/projects/${encodeURIComponent(this.codec.documentId(document))}/document`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': `"${revision}"`,
        ...this.editHeaders(this.codec.documentId(document)),
      },
      body: JSON.stringify(this.codec.writeDocument(document)),
    })
    await this.transport.readResponseJson<ProjectResponse>(response)
    return this.transport.revisionFrom(response)
  }

  /** Transfers one local Blob and returns its absolute server URL. */
  public async uploadMedia(documentId: string, media: MediaMetadata, blob: Blob): Promise<string> {
    const response = await this.transport.request(`/api/projects/${encodeURIComponent(documentId)}/media/${encodeURIComponent(media.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': media.mimeType, ...this.editHeaders(documentId) },
      body: blob,
    })
    switch (response.status) {
      case 204:
        return this.mediaUrl(documentId, media.id)
      case 201: {
        const body = await this.transport.readResponseJson<MediaResponse>(response)
        return this.transport.url(body.media.url).toString()
      }
      default:
        await this.transport.readResponseJson<never>(response)
        throw new Error('Réponse API média non traitée.')
    }
  }

  /** Builds the stable URL for one server-owned media resource. */
  public mediaUrl(documentId: string, mediaId: MediaId): string {
    return this.transport.url(`/api/projects/${encodeURIComponent(documentId)}/media/${encodeURIComponent(mediaId)}`).toString()
  }

  /** Retrieves confirmed source bytes for a new independent project copy. */
  public async downloadMedia(documentId: string, mediaId: MediaId): Promise<Blob> {
    const response = await this.transport.request(`/api/projects/${encodeURIComponent(documentId)}/media/${encodeURIComponent(mediaId)}`)
    if (!response.ok) throw new ElceProjectApiError(response.status, 'source_media_unavailable', mediaId)
    return response.blob()
  }

  /** Supplies the right required by each existing project mutation. */
  private editHeaders(projectId: string): Record<string, string> {
    const grant = this.grants.get(projectId)
    if (grant === undefined) throw new Error(`Aucun droit d'édition serveur pour ${projectId}.`)
    return { 'X-Elce-Page-Id': grant.pageId, 'X-Elce-Edit-Grant': grant.grantId }
  }

}
