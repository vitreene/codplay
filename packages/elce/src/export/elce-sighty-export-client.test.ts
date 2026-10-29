import { describe, expect, it, vi } from 'vitest'
import { BDC_TYPE } from '../config/document-config'
import { applyDocumentCommand } from '../domain/commands/document-commands'
import { createInitialDocument, ElceDocument } from '../domain/document/document-model'
import { requestElceSightyPackage } from './elce-sighty-export-client'

describe('Elcé Sighty export client', () => {
  it('sends the current document and its media bytes and returns the ZIP response', async () => {
    const imageText = '<svg/>'
    const imageBytes = new TextEncoder().encode(imageText)
    const model = documentWithReferencedMedia(imageBytes.byteLength)
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(imageText, { headers: { 'Content-Type': 'image/svg+xml' } }))
      .mockResolvedValueOnce(new Response('PK\u0003\u0004', {
        headers: { 'Content-Type': 'application/zip' },
      }))

    const result = await requestElceSightyPackage(model, { 'media-client': 'https://elce.test/media/client' }, request)

    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[0]?.[0]).toBe('https://elce.test/media/client')
    expect(request.mock.calls[0]?.[1]).toEqual({ cache: 'no-store' })
    const [exportUrl, exportOptions] = request.mock.calls[1]!
    expect(new URL(String(exportUrl)).pathname).toBe('/api/exports/sighty')
    expect(exportOptions?.method).toBe('POST')
    const formData = exportOptions?.body as FormData
    expect(formData.get('document')).toBe(JSON.stringify(model.toJSON()))
    const mediaFile = formData.get('media:media-client') as File
    expect(mediaFile.name).toBe('visuel.svg')
    expect(new Uint8Array(await mediaFile.arrayBuffer())).toEqual(imageBytes)
    expect(result.type).toBe('application/zip')
  })

  it('fails when a document media source is missing or cannot be read', async () => {
    const model = documentWithReferencedMedia(1)

    await expect(requestElceSightyPackage(model, {})).rejects.toThrow('n’est pas disponible')
    await expect(requestElceSightyPackage(model, { 'media-client': 'https://elce.test/media/client' }, vi.fn<typeof fetch>().mockResolvedValue(
      new Response('absent', { status: 404 }),
    ))).rejects.toThrow('n’a pas pu être lu')
  })
})

/** Creates a fixture whose direct scene references one media file. */
function documentWithReferencedMedia(size: number): ElceDocument {
  let document = applyDocumentCommand(createInitialDocument(), {
    type: 'media.add',
    media: { id: 'media-client', name: 'visuel.svg', mimeType: 'image/svg+xml', size, caption: '' },
  })
  document = applyDocumentCommand(document, {
    type: 'bdc.create',
    bdcId: 'bdc-client-card',
    bdcType: BDC_TYPE.CARD,
    presetId: 'photo-basic',
    placement: { kind: 'page', pageId: 'page-a' },
  })
  return applyDocumentCommand(document, {
    type: 'bdc.card.media.set',
    bdcId: 'bdc-client-card',
    mediaId: 'media-client',
  })
}
