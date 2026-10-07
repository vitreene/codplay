import { describe, expect, it } from 'vitest'
import { createElceApiRouter } from './api-router'

describe('Elcé API Fetch router', () => {
  it('returns an HTTP response for a path without a registered endpoint', async () => {
    const router = createElceApiRouter()

    const response = await router.fetch(new Request('http://elce.test/api/projects'))

    expect(response.status).toBe(404)
  })
})
