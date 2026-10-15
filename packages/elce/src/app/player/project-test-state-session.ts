import { INITIAL_PROJECT_TEST_STATE } from '../../domain/summary-profile/test-state-types'
import type { ProjectTestState } from '../../domain/summary-profile/test-state-types'
import { ElceProjectApiError, ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'

export type ProjectTestStateSaveResult =
  | Readonly<{ kind: 'saved'; state: ProjectTestState; revision: number }>
  | Readonly<{ kind: 'conflict'; state: ProjectTestState; revision: number }>

/** Owns one popup's server revision and serializes its test-state writes. */
export class ProjectTestStateSession {
  private readonly api: ElceProjectApiClient
  private readonly projectId: string
  private revision: number
  private writable: boolean
  private conflicted = false
  private queue: Promise<void> = Promise.resolve()

  private constructor(
    api: ElceProjectApiClient,
    projectId: string,
    state: ProjectTestState,
    revision: number,
    writable: boolean,
  ) {
    this.api = api
    this.projectId = projectId
    this.state = state
    this.revision = revision
    this.writable = writable
  }

  public state: ProjectTestState

  public get isPersisted(): boolean {
    return this.writable
  }

  /** Loads the current server state or starts an unsaved local reader session. */
  public static async open(
    api: ElceProjectApiClient,
    projectId: string,
    options: Readonly<{ allowOffline?: boolean }> = {},
  ): Promise<ProjectTestStateSession> {
    try {
      const current = await api.readTestState(projectId)
      return new ProjectTestStateSession(api, projectId, current.state, current.revision, true)
    } catch (error) {
      if (error instanceof ElceProjectApiError && error.status === 404) {
        return new ProjectTestStateSession(api, projectId, INITIAL_PROJECT_TEST_STATE, 0, false)
      }
      if (options.allowOffline === true && error instanceof TypeError) {
        return new ProjectTestStateSession(api, projectId, INITIAL_PROJECT_TEST_STATE, 0, false)
      }
      throw error
    }
  }

  /** Saves one complete snapshot without allowing a stale popup to overwrite a newer one. */
  public save(state: ProjectTestState): Promise<ProjectTestStateSaveResult> {
    let resolveResult: (result: ProjectTestStateSaveResult) => void = () => undefined
    let rejectResult: (error: unknown) => void = () => undefined
    const result = new Promise<ProjectTestStateSaveResult>((resolve, reject) => {
      resolveResult = resolve
      rejectResult = reject
    })
    this.queue = this.queue.then(async () => {
      if (!this.writable) {
        this.state = state
        resolveResult({ kind: 'saved', state, revision: this.revision })
        return
      }
      if (this.conflicted) {
        resolveResult({ kind: 'conflict', state: this.state, revision: this.revision })
        return
      }
      try {
        const revision = await this.api.saveTestState(this.projectId, state, this.revision)
        this.state = state
        this.revision = revision
        resolveResult({ kind: 'saved', state, revision })
      } catch (error) {
        if (!(error instanceof ElceProjectApiError) || error.status !== 412) {
          rejectResult(error)
          return
        }
        const latest = await this.api.readTestState(this.projectId)
        this.state = latest.state
        this.revision = latest.revision
        this.conflicted = true
        resolveResult({ kind: 'conflict', state: latest.state, revision: latest.revision })
      }
    }).catch((error: unknown) => {
      rejectResult(error)
    })
    return result
  }
}
