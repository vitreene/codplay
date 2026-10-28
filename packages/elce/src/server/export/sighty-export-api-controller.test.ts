import { describe, expect, it, vi } from 'vitest'
import { learningDocumentService } from '../../mods/learning/document/learning-document-service'
import { createLearningApiRouter } from '../../mods/learning/composition/server/learning-api-router'
import type { ProjectPersistence } from '../../core/server/projects/project-persistence'
import type { LearningDocument } from '../../mods/learning/document/learning-document'
import type { LearningTestStatePersistence } from '../../mods/learning/persistence/server/learning-test-state-persistence'
import { SightyExportApiController } from './sighty-export-api-controller'

describe('Sighty export API route', () => {
  it('returns a ZIP attachment without writing the document to project storage', async () => {
    const exporter = vi.fn(async () => new Uint8Array([80, 75, 3, 4]))
    const persistenceWrites = vi.fn()
    const persistence = {
      createProject: persistenceWrites,
      saveDocument: persistenceWrites,
    } as unknown as ProjectPersistence<LearningDocument> & LearningTestStatePersistence
    const router = createLearningApiRouter(persistence, undefined, new SightyExportApiController(exporter))
    const document = learningDocumentService.createInitialDocument()
    const form = new FormData()
    form.set('document', JSON.stringify(document.toJSON()))

    const response = await router.fetch(new Request('http://elce.test/api/exports/sighty', {
      method: 'POST',
      body: form,
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/zip')
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="Document-Elce.sighty.zip"')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([80, 75, 3, 4]))
    expect(exporter).toHaveBeenCalledWith(document.toJSON(), new Map())
    expect(persistenceWrites).not.toHaveBeenCalled()
  })

  it('rejects a media payload with the wrong size before invoking the package exporter', async () => {
    const exporter = vi.fn(async () => new Uint8Array([80, 75]))
    const router = createLearningApiRouter(
      {} as ProjectPersistence<LearningDocument> & LearningTestStatePersistence,
      undefined,
      new SightyExportApiController(exporter),
    )
    const document = learningDocumentService.createInitialDocument()
    const data = {
      ...document.toJSON(),
      medias: [{ id: 'media-required', name: 'visuel.svg', mimeType: 'image/svg+xml', size: 1, caption: '' }],
    }
    const form = new FormData()
    form.set('document', JSON.stringify(data))
    form.append('media:media-required', new Blob(['too large']), 'visuel.svg')

    const response = await router.fetch(new Request('http://elce.test/api/exports/sighty', {
      method: 'POST',
      body: form,
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_export_media_size' })
    expect(exporter).not.toHaveBeenCalled()
  })
})
