import { ScormSession } from '@codplay/sighty-scorm/session'
import type { ScormReaderUpdate, ScormSessionRestore } from '@codplay/sighty-scorm'
import type {
  QuizHuntGameStatePersistence,
  QuizHuntSavedGameState,
} from '../persistence/quiz-hunt-game-state-persistence'

interface QuizHuntScormSuspendData {
  readonly schemaVersion: 1
  readonly documentId: string
  readonly savedGameState: QuizHuntSavedGameState | null
}

/** Adapts one Quiz Hunt run to opaque SCORM suspend data and verdict status. */
export class QuizHuntScormAdapter implements QuizHuntGameStatePersistence {
  private readonly session: ScormSession
  private readonly documentId: string
  private location: string | null
  private savedGameState: QuizHuntSavedGameState | null

  /** Creates the Quiz Hunt persistence adapter from one initialized SCO session. */
  public constructor(
    session: ScormSession,
    documentId: string,
    restore: ScormSessionRestore,
  ) {
    this.session = session
    this.documentId = documentId
    this.location = restore.location
    this.savedGameState = decodeQuizHuntScormSuspendData(restore.suspendData, documentId)
  }

  /** Returns the saved run only when the requested project is this SCO's document. */
  public async readGameState(projectId: string): Promise<QuizHuntSavedGameState | null> {
    if (projectId !== this.documentId) return null
    return this.savedGameState
  }

  /** Persists one run and maps its terminal outcome to standard LMS status fields. */
  public async saveGameState(projectId: string, value: QuizHuntSavedGameState): Promise<boolean> {
    if (projectId !== this.documentId) return false
    this.savedGameState = value
    await this.session.saveReaderState(this.createReaderUpdate())
    return true
  }

  /** Clears run data and the prior LMS verdict before the player starts again. */
  public async clearGameState(projectId: string): Promise<boolean> {
    if (projectId !== this.documentId) return false
    this.savedGameState = null
    this.location = ''
    await this.session.saveReaderState(this.createReaderUpdate())
    return true
  }

  /** Saves the current authored page as the LMS bookmark with the latest run state. */
  public async savePage(pageId: string): Promise<void> {
    this.location = pageId
    await this.session.saveReaderState(this.createReaderUpdate())
  }

  /** Commits the latest bookmark and run data before ending the SCO session. */
  public async close(): Promise<void> {
    await this.session.close(this.createReaderUpdate())
  }

  /** Builds a reader update without sending any numeric score. */
  private createReaderUpdate(): ScormReaderUpdate {
    const state = this.savedGameState?.state
    const gameState = typeof state === 'object' && state !== null
      ? state as Readonly<Record<string, unknown>>
      : undefined
    const outcome = gameState?.outcome
    const successStatus = outcome === 'success' ? 'passed' : outcome === 'failure' ? 'failed' : 'unknown'
    const isComplete = outcome === 'success' || outcome === 'failure'
    const suspendData: QuizHuntScormSuspendData = {
      schemaVersion: 1,
      documentId: this.documentId,
      savedGameState: this.savedGameState,
    }
    return {
      location: this.location,
      suspendData: JSON.stringify(suspendData),
      progress: {
        measure: isComplete ? 1 : 0,
        completionStatus: isComplete ? 'completed' : 'incomplete',
        successStatus,
      },
    }
  }
}

/** Decodes the supported Quiz Hunt suspend-data envelope without failing the launch. */
function decodeQuizHuntScormSuspendData(
  suspendData: string,
  documentId: string,
): QuizHuntSavedGameState | null {
  let value: unknown
  try {
    value = JSON.parse(suspendData)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const envelope = value as Record<string, unknown>
  if (envelope.schemaVersion !== 1 || envelope.documentId !== documentId) return null
  const savedGameState = envelope.savedGameState
  if (typeof savedGameState !== 'object' || savedGameState === null || Array.isArray(savedGameState)) return null
  const candidate = savedGameState as Record<string, unknown>
  if (typeof candidate.seed !== 'number' || !Number.isFinite(candidate.seed)
    || typeof candidate.savedAt !== 'number' || !Number.isFinite(candidate.savedAt)
    || !('state' in candidate)) return null
  return {
    seed: candidate.seed,
    state: candidate.state,
    savedAt: candidate.savedAt,
  }
}
