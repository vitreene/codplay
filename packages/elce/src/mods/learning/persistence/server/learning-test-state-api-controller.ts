import type { LearningTestStatePersistence } from './learning-test-state-persistence'
import { learningTestStateService } from '../../reading/learning-test-state-service'

const INVALID = 'invalid_request'
const NOT_FOUND = 'project_not_found'

/** Handles Learning's preview state independently from project document revisions. */
export class LearningTestStateApiController {
  private readonly persistence: LearningTestStatePersistence

  public constructor(persistence: LearningTestStatePersistence) {
    this.persistence = persistence
  }

  /** Reads the single author-preview state and its independent ETag. */
  public async read(projectId: string): Promise<Response> {
    const value = await this.persistence.readTestState(projectId)
    if (value === null) return error(NOT_FOUND, 404)
    return Response.json({ state: value.state }, { headers: { ETag: etag(value.revision) } })
  }

  /** Saves a test state only against the exact revision previously read. */
  public async write(request: Request, projectId: string): Promise<Response> {
    const revision = parseRevision(request.headers.get('If-Match'))
    if (revision === null) return error(request.headers.has('If-Match') ? INVALID : 'if_match_required', request.headers.has('If-Match') ? 400 : 428)
    const body = await readBody(request)
    if (!isRecord(body) || !learningTestStateService.isValidProjectTestState(body.state)) return error(INVALID, 400)

    const result = await this.persistence.saveTestState(projectId, revision, body.state)
    switch (result.kind) {
      case 'not-found': return error(NOT_FOUND, 404)
      case 'revision-mismatch': return error('revision_mismatch', 412)
      case 'saved':
        return Response.json({ state: result.value.state }, { headers: { ETag: etag(result.value.revision) } })
    }
  }
}

/** Parses a JSON request while keeping malformed payloads at the API boundary. */
async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json() as unknown
  } catch {
    return null
  }
}

/** Checks whether an unknown value is a non-array JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parses a strong integer revision ETag. */
function parseRevision(value: string | null): number | null {
  if (value === null) return null
  const match = /^"(0|[1-9]\d*)"$/.exec(value)
  if (match === null) return null
  const revision = Number(match[1])
  return Number.isSafeInteger(revision) ? revision : null
}

/** Formats the preview-state revision as a strong ETag. */
function etag(revision: number): string {
  return `"${revision}"`
}

/** Creates a JSON API error with a stable machine code. */
function error(code: string, status: number): Response {
  return Response.json({ error: code }, { status })
}
