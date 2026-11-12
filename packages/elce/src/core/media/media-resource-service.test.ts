import { describe, expect, it } from 'vitest'
import { ElceMediaResourceService } from './media-resource-service'

describe('ElceMediaResourceService', () => {
  it('matches identical bytes independently of the imported filename', async () => {
    const service = new ElceMediaResourceService()
    const file = new File(['same bytes'], 'renamed.png', { type: 'image/png' })
    const existing = {
      id: 'media-original',
      
      name: 'original.png',
      mimeType: 'image/png',
      size: file.size,
      caption: '',
    }
    const imported = service.createImport(file)
    if (imported === null) throw new Error('Le service média doit accepter le fichier image de test.')

    await expect(service.findDuplicate(file, [existing], async () => new Blob(['same bytes'])))
      .resolves.toEqual(existing)
  })

  it('keeps same-sized different bytes as separate media resources', async () => {
    const service = new ElceMediaResourceService()
    const file = new File(['same bytes'], 'same.png', { type: 'image/png' })
    const existing = {
      id: 'media-original',
      
      name: 'same.png',
      mimeType: 'image/png',
      size: file.size,
      caption: '',
    }
    const imported = service.createImport(file)
    if (imported === null) throw new Error('Le service média doit accepter le fichier image de test.')

    await expect(service.findDuplicate(file, [existing], async () => new Blob(['diff bytes'])))
      .resolves.toBeNull()
  })

  it('reuses identical bytes even when the imported MIME differs', async () => {
    const service = new ElceMediaResourceService()
    const file = new File(['same bytes'], 'copy.mp4', { type: 'video/mp4' })
    const existing = {
      id: 'media-image',
      
      name: 'photo.png',
      mimeType: 'image/png',
      size: file.size,
      caption: '',
    }
    const imported = service.createImport(file)
    if (imported === null) throw new Error('Le service média doit accepter le fichier vidéo de test.')

    await expect(service.findDuplicate(file, [existing], async () => new Blob(['same bytes'])))
      .resolves.toEqual(existing)
  })
})
