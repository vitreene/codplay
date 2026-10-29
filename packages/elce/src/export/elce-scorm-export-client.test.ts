import { describe, expect, it, vi } from 'vitest'
import { requestElceScormPackage } from './elce-scorm-export-client'

describe('Elcé SCORM export client', () => {
  it('sends the existing Sighty archive and modal options to the separate endpoint', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('PK\u0003\u0004', {
      headers: {
        'Content-Type': 'application/zip',
        'X-Elce-Scorm-Filename': 'Demo-5-scorm-monosco-2026-10-22(2004v4).zip',
      },
    }))
    const sightyPackage = new Blob(['Sighty archive'], { type: 'application/zip' })

    const result = await requestElceScormPackage(sightyPackage, 'Démo 5', '2004v4', true, request)

    expect(request).toHaveBeenCalledOnce()
    const [endpoint, options] = request.mock.calls[0]!
    expect(new URL(String(endpoint)).pathname).toBe('/api/exports/scorm')
    expect(options?.method).toBe('POST')
    const form = options?.body as FormData
    expect(form.get('documentName')).toBe('Démo 5')
    expect(form.get('version')).toBe('2004v4')
    expect(form.get('monoSco')).toBe('true')
    expect((form.get('sightyPackage') as File).name).toBe('scenario.sighty.zip')
    expect(result.filename).toBe('Demo-5-scorm-monosco-2026-10-22(2004v4).zip')
    expect(await result.archive.text()).toBe('PK\u0003\u0004')
  })

  it('shows server diagnostics and rejects a non-ZIP response', async () => {
    await expect(requestElceScormPackage(new Blob(['source']), 'Formation', '1.2', false, vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ message: 'Manifeste invalide.' }, { status: 422 }),
    ))).rejects.toThrow('Manifeste invalide.')
    await expect(requestElceScormPackage(new Blob(['source']), 'Formation', '1.2', false, vi.fn<typeof fetch>().mockResolvedValue(
      new Response('not a zip', { headers: { 'Content-Type': 'text/plain' } }),
    ))).rejects.toThrow('pas renvoyé un package SCORM ZIP')
  })

  it('requires the normalized filename supplied by the API', async () => {
    await expect(requestElceScormPackage(new Blob(['source']), 'Formation', '1.2', false, vi.fn<typeof fetch>().mockResolvedValue(
      new Response('PK\u0003\u0004', { headers: { 'Content-Type': 'application/zip' } }),
    ))).rejects.toThrow('nom de fichier SCORM normalisé')
  })
})
