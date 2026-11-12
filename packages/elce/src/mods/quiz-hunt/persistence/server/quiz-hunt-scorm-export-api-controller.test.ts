import { describe, expect, it, vi } from 'vitest'
import { QuizHuntScormExportApiController } from './quiz-hunt-scorm-export-api-controller'

describe('Quiz Hunt SCORM export API', () => {
  it('returns one monoSCO archive for the requested edition', async () => {
    const exportPackage = vi.fn(async () => new Uint8Array([80, 75, 3, 4]))
    const controller = new QuizHuntScormExportApiController(
      exportPackage,
      () => new Date('2026-11-05T12:00:00.000Z'),
    )
    const formData = new FormData()
    formData.set('sightyPackage', new File([new Uint8Array([1, 2])], 'quiz-hunt.sighty.zip'))
    formData.set('documentName', 'Quiz Hunt')
    formData.set('version', '2004v4')

    const response = await controller.export(new Request('http://elce.test/api/quiz-hunt/exports/scorm', {
      method: 'POST',
      body: formData,
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Elce-Scorm-Package-Count')).toBe('1')
    expect(response.headers.get('X-Elce-Scorm-Filename')).toBe('Quiz-Hunt-scorm-monosco-2026-11-05(2004v4).zip')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([80, 75, 3, 4]))
    expect(exportPackage).toHaveBeenCalledWith(new Uint8Array([1, 2]), '2004v4')
  })
})
