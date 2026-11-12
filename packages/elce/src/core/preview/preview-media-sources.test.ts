/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'
import { loadPreviewMediaSources, loadServerPreviewMediaSources } from './preview-media-sources'

describe('preview media sources', () => {
  it('replaces a confirmed local Blob URL with the stable project media URL', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const sourceUrls = new Map([['media-a', 'blob:pending']])
    const store = {
      loadSyncState: vi.fn(async () => ({ uploadedMediaIds: ['media-a'] })),
      loadMedia: vi.fn(async () => new Blob()),
    }
    const urlProvider = { mediaUrl: vi.fn(() => '/api/projects/project-a/media/media-a') }

    await expect(loadPreviewMediaSources({
      documentId: 'project-a',
      media: [{ id: 'media-a' }],
      store,
      urlProvider,
      sourceUrls,
    })).resolves.toEqual({ 'media-a': '/api/projects/project-a/media/media-a' })
    expect(sourceUrls.get('media-a')).toBe('/api/projects/project-a/media/media-a')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pending')
    expect(store.loadMedia).not.toHaveBeenCalled()
  })

  it('reuses a local Blob URL while the upload remains pending', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pending')
    const loadMedia = vi.fn(async () => new Blob(['media']))
    const sourceUrls = new Map<string, string>()
    const options = {
      documentId: 'project-a',
      media: [{ id: 'media-a' }],
      store: { loadSyncState: async () => ({ uploadedMediaIds: [] }), loadMedia },
      urlProvider: { mediaUrl: () => '/api/projects/project-a/media/media-a' },
      sourceUrls,
    }

    await expect(loadPreviewMediaSources(options)).resolves.toEqual({ 'media-a': 'blob:pending' })
    await expect(loadPreviewMediaSources(options)).resolves.toEqual({ 'media-a': 'blob:pending' })
    expect(loadMedia).toHaveBeenCalledTimes(1)
  })

  it('builds server-preview URLs without reading local storage or creating Blob URLs', () => {
    const urlProvider = { mediaUrl: vi.fn((projectId: string, mediaId: string) => `/api/${projectId}/${mediaId}`) }
    expect(loadServerPreviewMediaSources({
      documentId: 'project-a',
      media: [{ id: 'media-a' }, { id: 'media-b' }],
      urlProvider,
    })).toEqual({ 'media-a': '/api/project-a/media-a', 'media-b': '/api/project-a/media-b' })
    expect(urlProvider.mediaUrl).toHaveBeenCalledTimes(2)
  })
})
