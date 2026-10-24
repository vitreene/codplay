import { assertDocumentInvariants } from '../../domain/commands/document-commands'
import { ELCE_DOCUMENT_VERSION, ElceDocument } from '../../domain/document/document-model'
import type { ElceDocumentData } from '../../domain/document/document-types'
import type { ProjectPersistence, ProjectSummary } from './project-persistence'
import { lostProjectEditGrant, missingProjectEditGrant, projectEditGrantFrom } from './project-edit-grant'

const API_ERROR = {
  INVALID_REQUEST: 'invalid_request',
  PROJECT_NOT_FOUND: 'project_not_found',
  PROJECT_ALREADY_EXISTS: 'project_already_exists',
  REVISION_MISMATCH: 'revision_mismatch',
  IF_MATCH_REQUIRED: 'if_match_required',
} as const

type JsonBody = Readonly<{ kind: 'valid'; value: unknown }> | Readonly<{ kind: 'invalid' }>
type ParsedDocument = Readonly<{ kind: 'valid'; document: ElceDocument }> | Readonly<{ kind: 'invalid' }>
type ParsedRevision = Readonly<{ kind: 'valid'; revision: number }> | Readonly<{ kind: 'missing' }> | Readonly<{ kind: 'invalid' }>

/** Handles the HTTP operations for the local project catalog. */
export class ProjectApiController {
  private readonly persistence: ProjectPersistence

  public constructor(persistence: ProjectPersistence) {
    this.persistence = persistence
  }

  /** Reserves editing for one page, or reports the current owner's exclusion. */
  public async acquireEditAccess(request: Request, projectId: string): Promise<Response> {
    const body = await readJsonBody(request)
    if (body.kind === 'invalid' || !isRecord(body.value)
      || typeof body.value.pageId !== 'string' || body.value.pageId.length === 0
      || body.value.force !== undefined && typeof body.value.force !== 'boolean') {
      return apiError(API_ERROR.INVALID_REQUEST, 400)
    }
    const result = await this.persistence.acquireEditAccess(projectId, body.value.pageId, body.value.force === true)
    switch (result.kind) {
      case 'granted': return Response.json({ grantId: result.grantId, recovered: result.recovered })
      case 'occupied': return apiError('edit_access_occupied', 409)
      case 'not-found': return apiError(API_ERROR.PROJECT_NOT_FOUND, 404)
    }
  }

  /** Renews the caller's live grant without extending an expired right. */
  public async renewEditAccess(request: Request, projectId: string): Promise<Response> {
    const grant = projectEditGrantFrom(request)
    if (grant === null) return missingProjectEditGrant()
    return await this.persistence.renewEditAccess(projectId, grant)
      ? new Response(null, { status: 204 }) : lostProjectEditGrant()
  }

  /** Checks a grant after a lost release response without acquiring anew. */
  public async hasEditAccess(request: Request, projectId: string): Promise<Response> {
    const grant = projectEditGrantFrom(request)
    if (grant === null) return missingProjectEditGrant()
    return Response.json({ held: await this.persistence.hasEditAccess(projectId, grant) })
  }

  /** Releases only the current page grant. */
  public async releaseEditAccess(request: Request, projectId: string): Promise<Response> {
    const grant = projectEditGrantFrom(request)
    if (grant === null) return missingProjectEditGrant()
    return await this.persistence.releaseEditAccess(projectId, grant)
      ? new Response(null, { status: 204 }) : lostProjectEditGrant()
  }

  /** Returns project summaries without loading their document bodies. */
  public async listProjects(): Promise<Response> {
    const projects = await this.persistence.listProjects()
    return Response.json({ projects })
  }

  /** Creates a project from the v6 document authored by the browser. */
  public async createProject(request: Request): Promise<Response> {
    const body = await readJsonBody(request)
    if (body.kind === 'invalid') return apiError(API_ERROR.INVALID_REQUEST, 400)

    const parsed = parseDocument(body.value)
    if (parsed.kind === 'invalid') return apiError(API_ERROR.INVALID_REQUEST, 400)

    const result = await this.persistence.createProject(parsed.document)
    switch (result.kind) {
      case 'already-exists':
        return apiError(API_ERROR.PROJECT_ALREADY_EXISTS, 409)
      case 'created':
        return projectResponse(result.project, 201)
    }
  }

  /** Returns one project and its complete document with the current ETag. */
  public async getProject(projectId: string): Promise<Response> {
    const stored = await this.persistence.findProject(projectId)
    switch (stored) {
      case null:
        return apiError(API_ERROR.PROJECT_NOT_FOUND, 404)
      default:
        return Response.json(
          { project: stored.project, document: stored.document.toJSON() },
          { headers: { ETag: revisionEtag(stored.project.revision) } },
        )
    }
  }

  /** Renames a project and returns the revision produced by persistence. */
  public async renameProject(request: Request, projectId: string): Promise<Response> {
    const grant = projectEditGrantFrom(request)
    if (grant === null) return missingProjectEditGrant()
    const body = await readJsonBody(request)
    if (body.kind === 'invalid') return apiError(API_ERROR.INVALID_REQUEST, 400)

    const name = projectNameFrom(body.value)
    if (name.kind === 'invalid') return apiError(API_ERROR.INVALID_REQUEST, 400)

    const result = await this.persistence.renameProject(projectId, name.value, grant)
    switch (result.kind) {
      case 'not-found':
        return apiError(API_ERROR.PROJECT_NOT_FOUND, 404)
      case 'edit-access-lost':
        return lostProjectEditGrant()
      case 'updated':
        return projectResponse(result.project)
    }
  }

  /** Deletes a project and reports whether the identifier existed. */
  public async deleteProject(request: Request, projectId: string): Promise<Response> {
    const grant = projectEditGrantFrom(request)
    if (grant === null) return missingProjectEditGrant()
    const deleted = await this.persistence.deleteProject(projectId, grant)
    switch (deleted) {
      case 'not-found':
        return apiError(API_ERROR.PROJECT_NOT_FOUND, 404)
      case 'edit-access-lost':
        return lostProjectEditGrant()
      case 'deleted':
        return new Response(null, { status: 204 })
    }
  }

  /** Replaces a project document only when its current revision matches If-Match. */
  public async saveDocument(request: Request, projectId: string): Promise<Response> {
    const grant = projectEditGrantFrom(request)
    if (grant === null) return missingProjectEditGrant()
    const revision = revisionFrom(request.headers.get('If-Match'))
    switch (revision.kind) {
      case 'missing':
        return apiError(API_ERROR.IF_MATCH_REQUIRED, 428)
      case 'invalid':
        return apiError(API_ERROR.INVALID_REQUEST, 400)
      case 'valid':
        break
    }

    const body = await readJsonBody(request)
    if (body.kind === 'invalid') return apiError(API_ERROR.INVALID_REQUEST, 400)

    const parsed = parseDocument(body.value)
    if (parsed.kind === 'invalid' || parsed.document.id !== projectId) {
      return apiError(API_ERROR.INVALID_REQUEST, 400)
    }

    const result = await this.persistence.saveDocument(projectId, revision.revision, parsed.document, grant)
    switch (result.kind) {
      case 'edit-access-lost':
        return lostProjectEditGrant()
      case 'not-found':
        return apiError(API_ERROR.PROJECT_NOT_FOUND, 404)
      case 'revision-mismatch':
        return apiError(API_ERROR.REVISION_MISMATCH, 412)
      case 'saved':
        return projectResponse(result.project)
    }
  }
}

/** Reads a JSON request body without leaking parse errors through the router. */
async function readJsonBody(request: Request): Promise<JsonBody> {
  try {
    return { kind: 'valid', value: await request.json() as unknown }
  } catch {
    return { kind: 'invalid' }
  }
}

/** Rehydrates and validates a v6 document using the existing domain invariants. */
function parseDocument(value: unknown): ParsedDocument {
  if (!isDocumentData(value)) return { kind: 'invalid' }

  try {
    const document = ElceDocument.fromJSON(value)
    assertDocumentInvariants(document)
    return { kind: 'valid', document }
  } catch {
    return { kind: 'invalid' }
  }
}

/** Narrows untrusted JSON to the required top-level document fields. */
function isDocumentData(value: unknown): value is ElceDocumentData {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && value.version === ELCE_DOCUMENT_VERSION
}

/** Extracts the project name from a rename request body. */
function projectNameFrom(value: unknown): Readonly<{ kind: 'valid'; value: string }> | Readonly<{ kind: 'invalid' }> {
  if (!isRecord(value) || typeof value.name !== 'string') return { kind: 'invalid' }
  return { kind: 'valid', value: value.name }
}

/** Checks whether a parsed JSON value can be addressed by string properties. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parses the strong revision ETag required by document replacement. */
function revisionFrom(value: string | null): ParsedRevision {
  switch (value) {
    case null:
      return { kind: 'missing' }
    default: {
      const match = /^"(0|[1-9]\d*)"$/.exec(value)
      switch (match) {
        case null:
          return { kind: 'invalid' }
        default: {
          const revision = Number(match[1])
          switch (Number.isSafeInteger(revision)) {
            case true:
              return { kind: 'valid', revision }
            case false:
              return { kind: 'invalid' }
          }
        }
      }
    }
  }
}

/** Formats a project summary and exposes its revision as an ETag. */
function projectResponse(project: ProjectSummary, status = 200): Response {
  return Response.json(
    { project },
    { status, headers: { ETag: revisionEtag(project.revision) } },
  )
}

/** Encodes a project revision as a strong HTTP ETag. */
function revisionEtag(revision: number): string {
  return `"${revision}"`
}

/** Returns a consistent JSON error response for project API failures. */
function apiError(code: string, status: number): Response {
  return Response.json({ error: code }, { status })
}
