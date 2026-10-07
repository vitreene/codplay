import { describe, expect, it, vi } from 'vitest'
import { createInitialDocument } from '../../domain/document/document-model'
import type { MediaMetadata } from '../../domain/document/document-types'
import { ElceProjectApiClient } from './project-api-client'

const apiOrigin = 'http://127.0.0.1:5181'

describe('Elcé project API client', () => {
  it('calls the browser fetch function with its global receiver', async () => {
    const document = createInitialDocument()
    let requestReceiver: unknown
    const request = vi.fn(function (this: unknown, _input: RequestInfo | URL) {
      requestReceiver = this
      return Promise.resolve(Response.json(
        { project: { id: document.id, name: document.data.name, revision: 0 } },
        { status: 201, headers: { ETag: '"0"' } },
      ))
    })
    const api = new ElceProjectApiClient(apiOrigin, request as unknown as typeof fetch)

    await api.createProject(document)

    expect(requestReceiver).toBe(globalThis)
  })

  it('creates the active document and reads its revision from ETag', async () => {
    const document = createInitialDocument()
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { project: { id: document.id, name: document.data.name, revision: 0 } },
      { status: 201, headers: { ETag: '"0"' } },
    ))
    const api = new ElceProjectApiClient(apiOrigin, request)

    await expect(api.createProject(document)).resolves.toBe(0)

    expect(request).toHaveBeenCalledWith(new URL('/api/projects', apiOrigin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(document.toJSON()),
    })
  })

  it('saves against the known server revision', async () => {
    const document = createInitialDocument()
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { project: { id: document.id, name: document.data.name, revision: 5 } },
      { headers: { ETag: '"5"' } },
    ))
    const api = new ElceProjectApiClient(apiOrigin, request)

    await expect(api.saveDocument(document, 4)).resolves.toBe(5)
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'PUT',
      headers: { 'If-Match': '"4"', 'Content-Type': 'application/json' },
    })
  })

  it('uploads a media Blob and resolves the stable server URL', async () => {
    const media: MediaMetadata = { id: 'media-image', name: 'photo.webp', mimeType: 'image/webp', size: 3, caption: '' }
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { media: { id: media.id, url: `/api/projects/elce-document/media/${media.id}` } },
      { status: 201 },
    ))
    const api = new ElceProjectApiClient(apiOrigin, request)
    const blob = new Blob(['img'], { type: media.mimeType })

    await expect(api.uploadMedia('elce-document', media, blob)).resolves.toBe(
      `${apiOrigin}/api/projects/elce-document/media/media-image`,
    )
    expect(request.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'image/webp' }, body: blob })
  })

  it('preserves a canonical duplicate media identifier from the API error', async () => {
    const media: MediaMetadata = { id: 'media-duplicate', name: 'photo.webp', mimeType: 'image/webp', size: 3, caption: '' }
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(
      { error: 'media_already_exists', mediaId: 'media-canonical' },
      { status: 409 },
    ))
    const api = new ElceProjectApiClient(apiOrigin, request)

    await expect(api.uploadMedia('elce-document', media, new Blob(['img'])))
      .rejects.toMatchObject({ code: 'media_already_exists', mediaId: 'media-canonical' })
  })
})
