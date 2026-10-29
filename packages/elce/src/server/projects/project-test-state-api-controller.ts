import type { ProjectTestState } from '../../domain/summary-profile/test-state-types'
import type { ProjectPersistence } from './project-persistence'

const INVALID = 'invalid_request'
const NOT_FOUND = 'project_not_found'

/** Handles the preview-only test state, independently from project document revisions. */
export class ProjectTestStateApiController {
  private readonly persistence: ProjectPersistence

  public constructor(persistence: ProjectPersistence) {
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
    if (!isRecord(body) || !isProjectTestState(body.state)) return error(INVALID, 400)

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

/** Validates the versioned test-state shape before it reaches persistence. */
function isProjectTestState(value: unknown): value is ProjectTestState {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.profileEnabled !== 'boolean'
    || typeof value.profileSubmitted !== 'boolean') return false
  if (!isRecord(value.profileValues) || !isStringArray(value.finishedPageIds)) return false
  if (!isStringValueRecord(value.profileValues) || !isAnswerRecord(value.questionAnswers)) return false
  if (!isRecord(value.evaluationStates)) return false
  return Object.values(value.evaluationStates).every((entry) => isEvaluationState(entry))
}

/** Accepts profile strings, finite numbers and arrays of stable choice ids. */
function isStringValueRecord(value: Record<string, unknown>): boolean {
  return Object.values(value).every((entry) => typeof entry === 'string'
    || typeof entry === 'number' && Number.isFinite(entry)
    || isStringArray(entry))
}

/** Validates persisted Question selections and their current expected answers. */
function isAnswerRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every((entry) => isAnswerState(entry))
}

/** Validates one serialized answer result. */
function isAnswerState(value: unknown): boolean {
  return isRecord(value) && isStringArray(value.answerIds)
    && isStringArray(value.selectedAnswerIds)
    && isStringArray(value.expectedAnswerIds) && typeof value.isCorrect === 'boolean'
}

/** Validates one chapter evaluation snapshot. */
function isEvaluationState(value: unknown): boolean {
  if (!isRecord(value) || !['ready', 'attempting', 'success', 'failure', 'reviewing'].includes(String(value.value))
    || !isRecord(value.context)) return false
  const context = value.context
  if (!isStringArray(context.questionIds) || !isStringArray(context.activeQuestionIds)
    || !isRecord(context.settings) || !isEvaluationAnswerRecord(context.answers)) return false
  if (typeof context.attempt !== 'number' || !Number.isSafeInteger(context.attempt) || context.attempt < 0) return false
  const settings = context.settings
  if (typeof settings.threshold !== 'number' || !Number.isFinite(settings.threshold)
    || settings.attemptLimit !== null && (typeof settings.attemptLimit !== 'number' || !Number.isSafeInteger(settings.attemptLimit) || settings.attemptLimit < 1)
    || settings.retryScope !== 'all' && settings.retryScope !== 'incorrect') return false
  if (context.result === null) return true
  return isRecord(context.result)
    && typeof context.result.questionCount === 'number'
    && typeof context.result.correctCount === 'number'
    && (context.result.score === null || typeof context.result.score === 'number')
    && (context.result.passed === null || typeof context.result.passed === 'boolean')
}

/** Validates the machine's portable answer map independently from reader answers. */
function isEvaluationAnswerRecord(value: unknown): boolean {
  return isRecord(value) && Object.entries(value).every(([questionId, entry]) => isRecord(entry)
    && entry.questionId === questionId
    && isStringArray(entry.answerIds)
    && isStringArray(entry.selectedAnswerIds)
    && isStringArray(entry.expectedAnswerIds))
}

/** Checks whether an unknown object is a JSON record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Checks whether all array members are strings. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
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
