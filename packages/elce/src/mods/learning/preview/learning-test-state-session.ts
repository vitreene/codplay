import { INITIAL_PROJECT_TEST_STATE } from '../reading/learning-test-state-types'
import type { ProjectTestState } from '../reading/learning-test-state-types'
import { ElceProjectApiError } from '../persistence/learning-test-state-api-client'
import type { LearningTestStateApiClient } from '../persistence/learning-test-state-api-client'

/** Reads the initial Learning test state for a preview without exposing a write path. */
export class LearningTestStateSession {
  public readonly state: ProjectTestState
  public readonly isPersisted: boolean
  public readonly revision: number

  private constructor(state: ProjectTestState, isPersisted: boolean, revision: number) {
    this.state = state
    this.isPersisted = isPersisted
    this.revision = revision
  }

  /** Loads the server snapshot or creates the permitted local initial state. */
  public static async open(
    api: LearningTestStateApiClient,
    projectId: string,
    options: Readonly<{ allowOffline?: boolean }> = {},
  ): Promise<LearningTestStateSession> {
    try {
      const current = await api.readTestState(projectId)
      return new LearningTestStateSession(current.state, true, current.revision)
    } catch (error) {
      if (error instanceof ElceProjectApiError && error.status === 404) {
        return new LearningTestStateSession(INITIAL_PROJECT_TEST_STATE, false, 0)
      }
      if (options.allowOffline === true && error instanceof TypeError) {
        return new LearningTestStateSession(INITIAL_PROJECT_TEST_STATE, false, 0)
      }
      throw error
    }
  }
}
