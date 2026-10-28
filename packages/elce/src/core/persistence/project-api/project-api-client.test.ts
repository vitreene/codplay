import { describe, expect, it, vi } from 'vitest'
import { ProjectApiClient } from './project-api-client'
import { ProjectHttpTransport } from './project-http-transport'

interface FixtureDocument {
  readonly id: string
  readonly title: string
}

interface FixtureDocumentData {
  readonly projectKey: string
  readonly heading: string
}

const codec = {
  readDocument: (value: FixtureDocumentData): FixtureDocument => ({ id: value.projectKey, title: value.heading }),
  writeDocument: (document: FixtureDocument): FixtureDocumentData => ({ projectKey: document.id, heading: document.title }),
  documentId: (document: FixtureDocument): string => document.id,
}

describe('generic project API client', () => {
  it('reads and writes an injected document format without importing a mod', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(
        { project: { id: 'lesson-one', name: 'Lesson One', revision: 1 }, document: { projectKey: 'lesson-one', heading: 'Original' } },
        { headers: { ETag: '"1"' } },
      ))
      .mockResolvedValueOnce(Response.json(
        { project: { id: 'lesson-two', name: 'Lesson Two', revision: 0 } },
        { status: 201, headers: { ETag: '"0"' } },
      ))
    const transport = new ProjectHttpTransport('http://elce.test', request)
    const api = new ProjectApiClient<FixtureDocument, FixtureDocumentData>(codec, transport)

    await expect(api.readProject('lesson-one')).resolves.toEqual({
      document: { id: 'lesson-one', title: 'Original' },
      revision: 1,
    })
    await expect(api.createProject({ id: 'lesson-two', title: 'Created' })).resolves.toBe(0)
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ projectKey: 'lesson-two', heading: 'Created' }),
    })
  })
})
