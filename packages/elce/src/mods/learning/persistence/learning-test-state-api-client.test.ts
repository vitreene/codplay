import { describe, expect, it, vi } from 'vitest'
import { INITIAL_PROJECT_TEST_STATE } from '../reading/learning-test-state-types'
import { ProjectHttpTransport } from '../../../core/persistence/project-api/project-http-transport'
import { LearningTestStateApiClient } from './learning-test-state-api-client'

const apiOrigin = 'http://127.0.0.1:5181'

describe('Learning test-state API client', () => {
  it('reads and writes test state using its separate server revision and shared transport', async () => {
    const state = { ...INITIAL_PROJECT_TEST_STATE, profileSubmitted: true }
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ state }, { headers: { ETag: '"3"' } }))
      .mockResolvedValueOnce(Response.json({ state }, { headers: { ETag: '"4"' } }))
    const transport = new ProjectHttpTransport(apiOrigin, request)
    const api = new LearningTestStateApiClient(transport)

    await expect(api.readTestState('project-a')).resolves.toEqual({ state, revision: 3 })
    await expect(api.saveTestState('project-a', state, 3)).resolves.toBe(4)
    expect(request.mock.calls).toEqual([
      [new URL('/api/projects/project-a/test-state', apiOrigin), { cache: 'no-store' }],
      [new URL('/api/projects/project-a/test-state', apiOrigin), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': '"3"' },
        body: JSON.stringify({ state }),
      }],
    ])
  })
})
