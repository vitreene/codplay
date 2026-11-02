import type { ProjectTestState } from '../reading/learning-test-state-types'
import { ElceProjectApiError, ProjectHttpTransport } from '../../../core/persistence/project-api/project-http-transport'

interface TestStateResponse {
  readonly state: ProjectTestState
}

/** Reads and writes Learning test state through the shared project transport. */
export class LearningTestStateApiClient {
  private readonly transport: ProjectHttpTransport

  public constructor(transport: ProjectHttpTransport) {
    this.transport = transport
  }

  /** Reads the current test state and its revision. */
  public async readTestState(projectId: string): Promise<Readonly<{ state: ProjectTestState; revision: number }>> {
    const response = await this.transport.request(`/api/projects/${encodeURIComponent(projectId)}/test-state`, {
      cache: 'no-store',
    })
    const body = await this.transport.readResponseJson<TestStateResponse>(response)
    return { state: body.state, revision: this.transport.revisionFrom(response) }
  }

  /** Saves test state against its independent server revision. */
  public async saveTestState(projectId: string, state: ProjectTestState, revision: number): Promise<number> {
    const response = await this.transport.request(`/api/projects/${encodeURIComponent(projectId)}/test-state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': `"${revision}"` },
      body: JSON.stringify({ state }),
    })
    await this.transport.readResponseJson<TestStateResponse>(response)
    return this.transport.revisionFrom(response)
  }
}

export { ElceProjectApiError }
