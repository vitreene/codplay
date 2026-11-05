import type { QuizHuntGameStatePersistence, QuizHuntSavedGameState } from '../quiz-hunt-game-state-persistence'

const INVALID = 'invalid_request'
const NOT_FOUND = 'quiz_hunt_project_not_found'

/** Exposes the Quiz Hunt-owned game-state row to Sighty release actions. */
export class QuizHuntGameStateApiController {
  private readonly persistence: QuizHuntGameStatePersistence

  public constructor(persistence: QuizHuntGameStatePersistence) {
    this.persistence = persistence
  }

  /** Reads the saved game snapshot, returning null before the first game save. */
  public async read(projectId: string): Promise<Response> {
    const state = await this.persistence.readGameState(projectId)
    return Response.json({ state })
  }

  /** Saves one validated seed and serializable Sighty game state. */
  public async write(request: Request, projectId: string): Promise<Response> {
    const body = await readBody(request)
    if (!isRecord(body) || !isSeed(body.seed) || !isRecord(body.state) || !isTimestamp(body.savedAt)) {
      return Response.json({ error: INVALID }, { status: 400 })
    }
    const saved: QuizHuntSavedGameState = { seed: body.seed, state: body.state, savedAt: body.savedAt }
    if (!await this.persistence.saveGameState(projectId, saved)) return Response.json({ error: NOT_FOUND }, { status: 404 })
    return Response.json({ state: saved })
  }

  /** Clears only this mod's saved state for Recommencer. */
  public async clear(projectId: string): Promise<Response> {
    return await this.persistence.clearGameState(projectId)
      ? new Response(null, { status: 204 })
      : Response.json({ error: NOT_FOUND }, { status: 404 })
  }
}

/** Reads the JSON body without leaking a parser exception from the API boundary. */
async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json() as unknown
  } catch {
    return null
  }
}

/** Checks whether an unknown value is a plain JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Accepts the unsigned 32-bit seed format used by Quiz Hunt's PRNG. */
function isSeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4_294_967_295
}

/** Requires a finite epoch-millisecond save time. */
function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
