import { ElceDocument } from '../../domain/document/document-model'
import type { ElceDocumentData, MediaId, MediaMetadata } from '../../domain/document/document-types'
import { elceApiOrigin } from '../../config/api-config'
import type { ElceProjectSummary } from './project-api-types'

interface ProjectResponse {
  readonly project: ElceProjectSummary
}

interface ProjectListResponse {
  readonly projects: readonly ElceProjectSummary[]
}

interface ProjectDocumentResponse extends ProjectResponse {
  readonly document: ElceDocumentData
}

interface MediaResponse {
  readonly media: { readonly id: string; readonly url: string }
}

interface ApiErrorResponse {
  readonly error: string
  readonly mediaId?: MediaId
}

/** Carries the HTTP status and API code to the local synchronization adapter. */
export class ElceProjectApiError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly mediaId: MediaId | null

  public constructor(status: number, code: string, mediaId: MediaId | null = null) {
    super(`API Elcé : ${code} (${status})`)
    this.name = 'ElceProjectApiError'
    this.status = status
    this.code = code
    this.mediaId = mediaId
  }
}

/** Sends project document and media requests to the local Elcé API. */
export class ElceProjectApiClient {
  private readonly origin: string
  private readonly request: typeof fetch

  public constructor(origin: string = elceApiOrigin(), request: typeof fetch = fetch) {
    this.origin = origin
    this.request = request.bind(globalThis)
  }

  /** Creates the remote project from the active document and returns its revision. */
  public async createProject(document: ElceDocument): Promise<number> {
    const response = await this.request(this.url('/api/projects'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(document.toJSON()),
    })
    await readResponseJson<ProjectResponse>(response)
    return revisionFrom(response)
  }

  /** Lists the server-owned project catalogue without loading document bodies. */
  public async listProjects(): Promise<readonly ElceProjectSummary[]> {
    const response = await this.request(this.url('/api/projects'))
    return (await readResponseJson<ProjectListResponse>(response)).projects
  }

  /** Renames one server project and returns its updated summary. */
  public async renameProject(projectId: string, name: string): Promise<ElceProjectSummary> {
    const response = await this.request(this.url(`/api/projects/${encodeURIComponent(projectId)}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    return (await readResponseJson<ProjectResponse>(response)).project
  }

  /** Deletes one server project and its media files. */
  public async deleteProject(projectId: string): Promise<void> {
    const response = await this.request(this.url(`/api/projects/${encodeURIComponent(projectId)}`), {
      method: 'DELETE',
    })
    if (response.status === 204) return
    await readResponseJson<never>(response)
    throw new Error('Réponse API de suppression de projet non traitée.')
  }

  /** Reads one server document and its current revision. */
  public async readProject(documentId: string): Promise<Readonly<{ document: ElceDocument; revision: number }>> {
    const response = await this.request(this.url(`/api/projects/${encodeURIComponent(documentId)}`))
    const body = await readResponseJson<ProjectDocumentResponse>(response)
    return { document: ElceDocument.fromJSON(body.document), revision: revisionFrom(response) }
  }

  /** Saves the latest local document against the revision previously read. */
  public async saveDocument(document: ElceDocument, revision: number): Promise<number> {
    const response = await this.request(this.url(`/api/projects/${encodeURIComponent(document.id)}/document`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': `"${revision}"`,
      },
      body: JSON.stringify(document.toJSON()),
    })
    await readResponseJson<ProjectResponse>(response)
    return revisionFrom(response)
  }

  /** Transfers one local Blob and returns its absolute server URL. */
  public async uploadMedia(documentId: string, media: MediaMetadata, blob: Blob): Promise<string> {
    const response = await this.request(this.url(`/api/projects/${encodeURIComponent(documentId)}/media/${encodeURIComponent(media.id)}`), {
      method: 'PUT',
      headers: { 'Content-Type': media.mimeType },
      body: blob,
    })
    switch (response.status) {
      case 204:
        return this.mediaUrl(documentId, media.id)
      case 201: {
        const body = await readResponseJson<MediaResponse>(response)
        return new URL(body.media.url, this.origin).toString()
      }
      default:
        await readResponseJson<never>(response)
        throw new Error('Réponse API média non traitée.')
    }
  }

  /** Builds the stable URL for one server-owned media resource. */
  public mediaUrl(documentId: string, mediaId: MediaId): string {
    return this.url(`/api/projects/${encodeURIComponent(documentId)}/media/${encodeURIComponent(mediaId)}`).toString()
  }

  /** Resolves one relative API path against the configured local server origin. */
  private url(path: string): URL {
    return new URL(path, this.origin)
  }
}

/** Reads a successful JSON response or raises its structured API error. */
async function readResponseJson<T>(response: Response): Promise<T> {
  let body: unknown
  try {
    body = await response.json() as unknown
  } catch {
    body = null
  }

  if (!response.ok) {
    const error = typeof body === 'object' && body !== null ? body as Partial<ApiErrorResponse> : {}
    throw new ElceProjectApiError(
      response.status,
      typeof error.error === 'string' ? error.error : 'request_failed',
      typeof error.mediaId === 'string' ? error.mediaId : null,
    )
  }
  return body as T
}

/** Reads a project revision exposed through a strong ETag. */
function revisionFrom(response: Response): number {
  const match = /^"(0|[1-9]\d*)"$/.exec(response.headers.get('ETag') ?? '')
  switch (match) {
    case null:
      throw new Error('La réponse API Elcé ne contient pas de révision ETag valide.')
    default: {
      const revision = Number(match[1])
      if (!Number.isSafeInteger(revision)) throw new Error('La révision ETag dépasse la limite entière sûre.')
      return revision
    }
  }
}
