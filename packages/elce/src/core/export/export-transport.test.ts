import { describe, expect, it } from 'vitest'
import type { MediaMetadata } from '../document/content-document-types'
import { appendReferencedExportMedia, requestExportZip } from './export-transport'

const media: MediaMetadata = {
  id: 'media-export',
  name: 'image.svg',
  mimeType: 'image/svg+xml',
  size: 4,
  caption: '',
}

describe('shared export transport', () => {
  it('posts only referenced media and validates its declared byte size', async () => {
    const formData = new FormData()
    const referenced = new Set([media.id])
    const request = async (input: RequestInfo | URL): Promise<Response> => {
      expect(input).toBe('blob:image-export')
      return new Response(new Uint8Array([1, 2, 3, 4]))
    }

    await appendReferencedExportMedia(formData, [media], referenced, { [media.id]: 'blob:image-export' }, request)

    const uploaded = formData.get(`media:${media.id}`)
    expect(uploaded).toBeInstanceOf(File)
    expect((uploaded as File).name).toBe(media.name)
    expect((uploaded as File).size).toBe(media.size)
  })

  it('rejects a referenced media item that has no available source', async () => {
    await expect(appendReferencedExportMedia(
      new FormData(),
      [media],
      new Set([media.id]),
      {},
      async () => new Response(),
    )).rejects.toThrow('Le média « image.svg » n’est pas disponible.')
  })

  it('rejects media fetch errors and byte-size mismatches', async () => {
    const requestFailure = async (): Promise<Response> => new Response(null, { status: 404 })
    await expect(appendReferencedExportMedia(
      new FormData(), [media], new Set([media.id]), { [media.id]: '/media/image.svg' }, requestFailure,
    )).rejects.toThrow('Le média « image.svg » n’a pas pu être lu.')

    const wrongSize = async (): Promise<Response> => new Response(new Uint8Array([1, 2, 3]))
    await expect(appendReferencedExportMedia(
      new FormData(), [media], new Set([media.id]), { [media.id]: '/media/image.svg' }, wrongSize,
    )).rejects.toThrow('La taille du média « image.svg » ne correspond pas au document.')
  })

  it('validates HTTP errors, ZIP content type, and a required server filename', async () => {
    const messages = {
      serverErrorPrefix: 'Erreur serveur : ',
      serverErrorFallback: 'Erreur serveur.',
      invalidZipMessage: 'Réponse invalide.',
    }
    await expect(requestExportZip('/export', new FormData(), async () => new Response(
      JSON.stringify({ message: 'Export refusé.' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    ), messages)).rejects.toThrow('Erreur serveur : Export refusé.')

    await expect(requestExportZip('/export', new FormData(), async () => new Response(
      'not a zip',
      { headers: { 'Content-Type': 'text/plain' } },
    ), messages)).rejects.toThrow('Réponse invalide.')

    await expect(requestExportZip('/export', new FormData(), async () => new Response(
      new Uint8Array([80, 75, 3, 4]),
      { headers: { 'Content-Type': 'application/zip' } },
    ), { ...messages, filenameHeader: 'X-Export-Filename', missingFilenameMessage: 'Nom absent.' }))
      .rejects.toThrow('Nom absent.')
  })
})
