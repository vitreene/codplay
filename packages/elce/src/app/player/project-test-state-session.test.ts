import { describe, expect, it, vi } from 'vitest'
import { INITIAL_PROJECT_TEST_STATE } from '../../domain/summary-profile/test-state-types'
import type { ProjectTestState } from '../../domain/summary-profile/test-state-types'
import { ElceProjectApiError, ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import { ProjectTestStateSession } from './project-test-state-session'

describe('ProjectTestStateSession', () => {
  it('serializes writes against each newly returned revision', async () => {
    const saveTestState = vi.fn(async (_projectId: string, _state: ProjectTestState, revision: number) => revision + 1)
    const api = fakeApi({ state: INITIAL_PROJECT_TEST_STATE, revision: 0 }, saveTestState)
    const session = await ProjectTestStateSession.open(api, 'project-test')
    const profileState = { ...INITIAL_PROJECT_TEST_STATE, profileSubmitted: true }
    const progressState = { ...profileState, finishedPageIds: ['page-a'] }

    const first = session.save(profileState)
    const second = session.save(progressState)
    const results = await Promise.all([first, second])

    expect(saveTestState.mock.calls.map(([, , revision]) => revision)).toEqual([0, 1])
    expect(results.map((result) => result.revision)).toEqual([1, 2])
    expect(session.state).toEqual(progressState)
  })

  it('reloads a conflicting server value and rejects later stale snapshots', async () => {
    const serverState = { ...INITIAL_PROJECT_TEST_STATE, finishedPageIds: ['page-b'] }
    const readTestState = vi.fn(async () => ({ state: serverState, revision: 8 }))
    const saveTestState = vi.fn(async () => { throw new ElceProjectApiError(412, 'revision_mismatch') })
    const api = fakeApi({ state: INITIAL_PROJECT_TEST_STATE, revision: 0 }, saveTestState, readTestState)
    const session = await ProjectTestStateSession.open(api, 'project-test')

    const conflict = await session.save({ ...INITIAL_PROJECT_TEST_STATE, finishedPageIds: ['page-a'] })
    const repeated = await session.save({ ...INITIAL_PROJECT_TEST_STATE, finishedPageIds: ['page-c'] })

    expect(conflict).toEqual({ kind: 'conflict', state: serverState, revision: 8 })
    expect(repeated).toEqual({ kind: 'conflict', state: serverState, revision: 8 })
    expect(saveTestState).toHaveBeenCalledTimes(1)
    expect(session.state).toEqual(serverState)
  })

  it('keeps local author preview available offline without pretending the state was persisted', async () => {
    const saveTestState = vi.fn(async () => 1)
    const api = fakeApi(INITIAL_PROJECT_TEST_STATE, saveTestState, vi.fn(async () => { throw new TypeError('offline') }))
    const session = await ProjectTestStateSession.open(api, 'project-test', { allowOffline: true })
    const state = { ...INITIAL_PROJECT_TEST_STATE, profileSubmitted: true }

    await expect(session.save(state)).resolves.toEqual({ kind: 'saved', state, revision: 0 })
    expect(session.isPersisted).toBe(false)
    expect(saveTestState).not.toHaveBeenCalled()
  })
})

/** Supplies the narrow API behavior used by one server-owned test session. */
function fakeApi(
  initial: ProjectTestState | Readonly<{ state: ProjectTestState; revision: number }>,
  saveTestState: ElceProjectApiClient['saveTestState'],
  readTestState: ElceProjectApiClient['readTestState'] = vi.fn(async () => 'state' in initial
    ? initial
    : { state: initial, revision: 0 }),
): ElceProjectApiClient {
  return {
    readTestState,
    saveTestState,
  } as unknown as ElceProjectApiClient
}
