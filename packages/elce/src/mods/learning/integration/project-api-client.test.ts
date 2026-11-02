import { describe, expect, it, vi } from 'vitest'
import { learningDocumentService } from '../document/learning-document-service'
import type { MediaMetadata } from '../../../core/document/content-document-types'
import { LearningProjectApiClient } from '../persistence/learning-project-api-client'
import { ProjectHttpTransport } from '../../../core/persistence/project-api/project-http-transport'
import type { ElceProjectSummary } from '../../../infrastructure/project-api/project-api-types'

const apiOrigin = 'http://127.0.0.1:5181'

describe('Elcé project API client', () => {
  it('lists server project summaries without loading documents', async () => {
    const projects: readonly ElceProjectSummary[] = [
      { id: 'project-a', name: 'Projet A', revision: 3 },
      { id: 'project-b', name: 'Projet B', revision: 1 },
    ]
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ projects }))
    const api = new LearningProjectApiClient(new ProjectHttpTransport(apiOrigin, request))

    await expect(api.listProjects()).resolves.toEqual(projects)
    expect(request).toHaveBeenCalledWith(new URL('/api/projects', apiOrigin))
  })

  it('renews its grant and can request the temporary force path', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ grantId: 'test-grant', recovered: true }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const api = new LearningProjectApiClient(new ProjectHttpTransport(apiOrigin, request))

    await expect(api.acquireEditAccess('project-a', 'page-a', true)).resolves.toEqual({
      grantId: 'test-grant', recovered: true,
    })
    await expect(api.renewEditAccess('project-a')).resolves.toBe(true)

    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ pageId: 'page-a', force: true }),
    })
    expect(request.mock.calls[1]).toEqual([
      new URL('/api/projects/project-a/edit-access', apiOrigin),
      { method: 'PUT', headers: { 'X-Elce-Page-Id': 'page-a', 'X-Elce-Edit-Grant': 'test-grant' } },
    ])
  })

  it('renames a project through its server route', async () => {
    const project: ElceProjectSummary = { id: 'project/a', name: 'Nouveau nom', revision: 4 }
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ project }, { headers: { ETag: '"4"' } }))
    const api = await grantedApi(request, project.id)

    await expect(api.renameProject(project.id, project.name)).resolves.toEqual(project)
    expect(request).toHaveBeenCalledWith(new URL('/api/projects/project%2Fa', apiOrigin), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...grantHeaders },
      body: JSON.stringify({ name: project.name }),
    })
  })

  it('deletes a project after a no-content server response', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    const api = await grantedApi(request, 'project/a')

    await expect(api.deleteProject('project/a')).resolves.toBeUndefined()
    expect(request).toHaveBeenCalledWith(new URL('/api/projects/project%2Fa', apiOrigin), { method: 'DELETE', headers: grantHeaders })
  })

  it('reads a structured server document and its revision', async () => {
    const document = learningDocumentService.createInitialDocument()
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { project: { id: document.id, name: document.data.name, revision: 7 }, document: document.toJSON() },
      { headers: { ETag: '"7"' } },
    ))
    const api = new LearningProjectApiClient(new ProjectHttpTransport(apiOrigin, request))

    await expect(api.readProject(document.id)).resolves.toEqual({ document, revision: 7 })
    expect(request).toHaveBeenCalledWith(new URL(`/api/projects/${document.id}`, apiOrigin), { cache: 'no-store' })
  })

  it('calls the browser fetch function with its global receiver', async () => {
    const document = learningDocumentService.createInitialDocument()
    let requestReceiver: unknown
    const request = vi.fn(function (this: unknown, _input: RequestInfo | URL) {
      requestReceiver = this
      return Promise.resolve(Response.json(
        { project: { id: document.id, name: document.data.name, revision: 0 } },
        { status: 201, headers: { ETag: '"0"' } },
      ))
    })
    const api = new LearningProjectApiClient(new ProjectHttpTransport(apiOrigin, request as unknown as typeof fetch))

    await api.createProject(document)

    expect(requestReceiver).toBe(globalThis)
  })

  it('creates the active document and reads its revision from ETag', async () => {
    const document = learningDocumentService.createInitialDocument()
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { project: { id: document.id, name: document.data.name, revision: 0 } },
      { status: 201, headers: { ETag: '"0"' } },
    ))
    const api = new LearningProjectApiClient(new ProjectHttpTransport(apiOrigin, request))

    await expect(api.createProject(document)).resolves.toBe(0)

    expect(request).toHaveBeenCalledWith(new URL('/api/projects', apiOrigin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(document.toJSON()),
    })
  })

  it('saves against the known server revision', async () => {
    const document = learningDocumentService.createInitialDocument()
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { project: { id: document.id, name: document.data.name, revision: 5 } },
      { headers: { ETag: '"5"' } },
    ))
    const api = await grantedApi(request, document.id)

    await expect(api.saveDocument(document, 4)).resolves.toBe(5)
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'PUT',
      headers: { 'If-Match': '"4"', 'Content-Type': 'application/json', ...grantHeaders },
    })
  })

  it('preserves the API diagnostic id and rejection category for a failed save', async () => {
    const document = learningDocumentService.createInitialDocument()
    const diagnosticId = 'bfe3a03d-b7d5-42be-9b72-76f30e0a4be4'
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      error: 'invalid_request',
      diagnosticId,
      diagnosticReason: 'document_invariants_rejected',
    }, { status: 400 }))
    const api = await grantedApi(request, document.id)

    await expect(api.saveDocument(document, 4)).rejects.toMatchObject({
      code: 'invalid_request',
      diagnosticId,
      diagnosticReason: 'document_invariants_rejected',
      message: `API Elcé : invalid_request (400) [diagnostic ${diagnosticId}: document_invariants_rejected]`,
    })
  })

  it('uploads a media Blob and resolves the stable server URL', async () => {
    const media: MediaMetadata = { id: 'media-image', name: 'photo.webp', mimeType: 'image/webp', size: 3, caption: '' }
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { media: { id: media.id, url: `/api/projects/elce-document/media/${media.id}` } },
      { status: 201 },
    ))
    const api = await grantedApi(request, 'elce-document')
    const blob = new Blob(['img'], { type: media.mimeType })

    await expect(api.uploadMedia('elce-document', media, blob)).resolves.toBe(
      `${apiOrigin}/api/projects/elce-document/media/media-image`,
    )
    expect(request.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'image/webp', ...grantHeaders }, body: blob })
  })

  it('preserves a canonical duplicate media identifier from the API error', async () => {
    const media: MediaMetadata = { id: 'media-duplicate', name: 'photo.webp', mimeType: 'image/webp', size: 3, caption: '' }
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { error: 'media_already_exists', mediaId: 'media-canonical' },
      { status: 409 },
    ))
    const api = await grantedApi(request, 'elce-document')

    await expect(api.uploadMedia('elce-document', media, new Blob(['img'])))
      .rejects.toMatchObject({ code: 'media_already_exists', mediaId: 'media-canonical' })
  })
})

const grantHeaders = { 'X-Elce-Page-Id': 'test-page', 'X-Elce-Edit-Grant': 'test-grant' }

/** Gives an isolated client a server grant before testing a mutation. */
async function grantedApi(request: ReturnType<typeof vi.fn<typeof fetch>>, projectId: string): Promise<LearningProjectApiClient> {
  const routed = vi.fn<typeof fetch>((input, init) => {
    if (new URL(input.toString()).pathname.endsWith('/edit-access')) return Promise.resolve(Response.json({ grantId: 'test-grant' }))
    return request(input, init)
  })
  const api = new LearningProjectApiClient(new ProjectHttpTransport(apiOrigin, routed))
  await api.acquireEditAccess(projectId, 'test-page')
  return api
}
