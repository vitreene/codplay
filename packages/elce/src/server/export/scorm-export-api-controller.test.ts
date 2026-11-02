import { describe, expect, it, vi } from 'vitest'
import { createLearningApiRouter } from '../../mods/learning/composition/server/learning-api-router'
import type { ProjectPersistence } from '../../core/server/projects/project-persistence'
import type { LearningDocument } from '../../mods/learning/document/learning-document'
import type { LearningTestStatePersistence } from '../../mods/learning/persistence/server/learning-test-state-persistence'
import { ScormExportApiController } from './scorm-export-api-controller'

describe('SCORM export API route', () => {
  it('passes the existing Sighty ZIP and modal choices to the SCORM CLI adapter', async () => {
    const archive = new Uint8Array([80, 75, 3, 4])
    const exporter = vi.fn(async () => ({ archive, packageCount: 1 }))
    const router = createLearningApiRouter(
      {} as ProjectPersistence<LearningDocument> & LearningTestStatePersistence,
      undefined,
      undefined,
      new ScormExportApiController(exporter, () => new Date('2026-10-22T12:00:00.000Z')),
    )
    const form = new FormData()
    form.set('sightyPackage', new File([archive], 'scenario.sighty.zip', { type: 'application/zip' }))
    form.set('documentName', 'Démo 5 — comparaison Elcé')
    form.set('version', '2004v4')
    form.set('monoSco', 'false')

    const response = await router.fetch(new Request('http://elce.test/api/exports/scorm', {
      method: 'POST',
      body: form,
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/zip')
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="Demo-5-comparaison-Elce-scorm-2026-10-22(2004v4).zip"')
    expect(response.headers.get('X-Elce-Scorm-Filename')).toBe('Demo-5-comparaison-Elce-scorm-2026-10-22(2004v4).zip')
    expect(response.headers.get('X-Elce-Scorm-Package-Count')).toBe('1')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(archive)
    expect(exporter).toHaveBeenCalledWith(archive, { version: '2004v4', monoSco: false })
  })

  it('rejects unsupported edition and mono-SCO values before packaging', async () => {
    const exporter = vi.fn()
    const router = createLearningApiRouter(
      {} as ProjectPersistence<LearningDocument> & LearningTestStatePersistence,
      undefined,
      undefined,
      new ScormExportApiController(exporter),
    )
    const form = new FormData()
    form.set('sightyPackage', new File([new Uint8Array([80, 75])], 'scenario.sighty.zip'))
    form.set('documentName', 'Formation')
    form.set('version', '2004')
    form.set('monoSco', 'yes')

    const response = await router.fetch(new Request('http://elce.test/api/exports/scorm', {
      method: 'POST',
      body: form,
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_scorm_export_version' })
    expect(exporter).not.toHaveBeenCalled()
  })

  it('does not route a SCORM export through document persistence', async () => {
    const archive = new Uint8Array([80, 75, 3, 4])
    const writes = vi.fn()
    const persistence = {
      createProject: writes,
      saveDocument: writes,
    } as unknown as ProjectPersistence<LearningDocument> & LearningTestStatePersistence
    const exporter = vi.fn(async () => ({ archive, packageCount: 1 }))
    const router = createLearningApiRouter(
      persistence,
      undefined,
      undefined,
      new ScormExportApiController(exporter),
    )
    const form = new FormData()
    form.set('sightyPackage', new File([archive], 'scenario.sighty.zip'))
    form.set('documentName', 'Formation test')
    form.set('version', '1.2')
    form.set('monoSco', 'true')

    const response = await router.fetch(new Request('http://elce.test/api/exports/scorm', {
      method: 'POST',
      body: form,
    }))

    expect(response.status).toBe(200)
    expect(exporter).toHaveBeenCalledWith(archive, { version: '1.2', monoSco: true })
    expect(writes).not.toHaveBeenCalled()
  })
})
