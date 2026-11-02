import { describe, expect, it, vi } from 'vitest'
import { INITIAL_PROJECT_TEST_STATE } from '../reading/learning-test-state-types'
import type { LearningTestStateApiClient } from '../persistence/learning-test-state-api-client'
import { ElceProjectApiError } from '../persistence/learning-test-state-api-client'
import { LearningTestStateSession } from './learning-test-state-session'

describe('LearningTestStateSession', () => {
  it('reads the server state and exposes no write operation', async () => {
    const state = { ...INITIAL_PROJECT_TEST_STATE, finishedPageIds: ['page-a'] }
    const api = fakeApi(vi.fn(async () => ({ state, revision: 3 })))
    const session = await LearningTestStateSession.open(api, 'project-test')

    expect(session.state).toEqual(state)
    expect(session.isPersisted).toBe(true)
    expect('save' in session).toBe(false)
  })

  it('starts from local initial state when the project has no stored test state', async () => {
    const api = fakeApi(vi.fn(async () => { throw new ElceProjectApiError(404, 'project_test_state_not_found') }))
    const session = await LearningTestStateSession.open(api, 'project-test')

    expect(session.state).toEqual(INITIAL_PROJECT_TEST_STATE)
    expect(session.isPersisted).toBe(false)
  })

  it('allows only author preview to start locally after a transport failure', async () => {
    const api = fakeApi(vi.fn(async () => { throw new TypeError('offline') }))
    const session = await LearningTestStateSession.open(api, 'project-test', { allowOffline: true })

    expect(session.state).toEqual(INITIAL_PROJECT_TEST_STATE)
    expect(session.isPersisted).toBe(false)
    await expect(LearningTestStateSession.open(api, 'project-network-preview'))
      .rejects.toThrow('offline')
  })
})

/** Supplies the one read operation owned by a test-state session. */
function fakeApi(readTestState: LearningTestStateApiClient['readTestState']): LearningTestStateApiClient {
  return { readTestState } as LearningTestStateApiClient
}
