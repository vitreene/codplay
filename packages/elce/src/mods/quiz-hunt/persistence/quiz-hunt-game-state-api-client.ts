import type { QuizHuntSavedGameState } from './quiz-hunt-game-state-persistence'
import { QuizHuntHttpTransport } from './quiz-hunt-project-api'

/** Reads, saves, and resets the diffusion state owned by Quiz Hunt. */
export class QuizHuntGameStateApiClient {
  private readonly transport: QuizHuntHttpTransport

  public constructor(transport = new QuizHuntHttpTransport()) {
    this.transport = transport
  }

  /** Loads the state from the shared SQLite database, if a run has started. */
  public async readGameState(projectId: string): Promise<QuizHuntSavedGameState | null> {
    const response = await this.transport.request(gameStatePath(projectId), { cache: 'no-store' })
    const body = await this.transport.readResponseJson<{ state: unknown }>(response)
    if (body.state === null) return null
    if (!isSavedGameState(body.state)) throw new Error('L’état de partie Quiz Hunt reçu est invalide.')
    return body.state
  }

  /** Persists the seed and Sighty-owned game context. */
  public async saveGameState(projectId: string, state: QuizHuntSavedGameState): Promise<boolean> {
    const response = await this.transport.request(gameStatePath(projectId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    })
    await this.transport.readResponseJson<{ state: QuizHuntSavedGameState }>(response)
    return true
  }

  /** Removes the prior row before a new release run is initialized. */
  public async clearGameState(projectId: string): Promise<boolean> {
    const response = await this.transport.request(gameStatePath(projectId), { method: 'DELETE' })
    if (!response.ok) await this.transport.readResponseJson<unknown>(response)
    return true
  }
}

/** Resolves one mod-namespaced state route through the shared project transport. */
function gameStatePath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/game-state`
}

/** Checks the persisted envelope before passing its game payload to Sighty. */
function isSavedGameState(value: unknown): value is QuizHuntSavedGameState {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && 'seed' in value
    && typeof value.seed === 'number'
    && Number.isInteger(value.seed)
    && value.seed >= 0
    && value.seed <= 4_294_967_295
    && 'state' in value
    && typeof value.state === 'object'
    && value.state !== null
    && !Array.isArray(value.state)
    && 'savedAt' in value
    && typeof value.savedAt === 'number'
    && Number.isSafeInteger(value.savedAt)
    && value.savedAt >= 0
}
