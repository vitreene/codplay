import type { MediaId } from '../../document/content-document-types'
import { elceApiOrigin } from './project-api-config'

interface ApiErrorResponse {
  readonly error: string
  readonly mediaId?: MediaId
  readonly diagnosticId?: string
  readonly diagnosticReason?: string
}

/** Carries the HTTP status and API code to the local persistence adapter. */
export class ElceProjectApiError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly mediaId: MediaId | null
  public readonly diagnosticId: string | null
  public readonly diagnosticReason: string | null

  public constructor(
    status: number,
    code: string,
    mediaId: MediaId | null = null,
    diagnosticId: string | null = null,
    diagnosticReason: string | null = null,
  ) {
    const diagnostic = diagnosticId === null
      ? ''
      : ` [diagnostic ${diagnosticId}${diagnosticReason === null ? '' : `: ${diagnosticReason}`}]`
    super(`API Elcé : ${code} (${status})${diagnostic}`)
    this.name = 'ElceProjectApiError'
    this.status = status
    this.code = code
    this.mediaId = mediaId
    this.diagnosticId = diagnosticId
    this.diagnosticReason = diagnosticReason
  }
}

/** Owns URL resolution, fetch binding, response errors, and revision parsing. */
export class ProjectHttpTransport {
  private readonly origin: string
  private readonly fetchRequest: typeof fetch

  public constructor(origin: string = elceApiOrigin(), request: typeof fetch = fetch) {
    this.origin = origin
    this.fetchRequest = request.bind(globalThis)
  }

  /** Resolves one API path against the configured origin. */
  public url(path: string): URL {
    return new URL(path, this.origin)
  }

  /** Sends one request through the configured fetch implementation. */
  public request(path: string, init?: RequestInit): Promise<Response> {
    const url = this.url(path)
    return init === undefined ? this.fetchRequest(url) : this.fetchRequest(url, init)
  }

  /** Reads a successful JSON response or raises its structured API error. */
  public async readResponseJson<T>(response: Response): Promise<T> {
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
        typeof error.diagnosticId === 'string' ? error.diagnosticId : null,
        typeof error.diagnosticReason === 'string' ? error.diagnosticReason : null,
      )
    }
    return body as T
  }

  /** Reads a project revision exposed through a strong ETag. */
  public revisionFrom(response: Response): number {
    const match = /^"(0|[1-9]\d*)"$/.exec(response.headers.get('ETag') ?? '')
    if (match === null) throw new Error('La réponse API Elcé ne contient pas de révision ETag valide.')
    const revision = Number(match[1])
    if (!Number.isSafeInteger(revision)) throw new Error('La révision ETag dépasse la limite entière sûre.')
    return revision
  }
}
