/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { BDC_LOCATION, BDC_TYPE, CATALOG_REFERENCE } from '../../config/document-config'
import { applyDocumentCommand } from '../../app/commands/document-commands'
import { createInitialDocument } from '../document/document-model'
import { mediaTypeFromMimeType } from '../media/media-resource-service'
import { ElceAnchorDropFacade } from './anchor-drop-facade'
import { ElceAnchorDropService } from './anchor-drop-service'

describe('ElceAnchorDropService', () => {
  it('builds the stable media target and command for an image drop', () => {
    const service = new ElceAnchorDropService()
    const file = new File(['image'], 'photo.png', { type: 'image/png' })
    const target = service.createFileDropTarget(file, 'page-a')
    if (target === null) throw new Error('La cible image doit être acceptée.')

    const command = service.createDocumentCommand('bdc-section-1', {
      kind: 'file-drop',
      file,
      target,
      title: '',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      markup: '<p></p>',
    })

    expect(mediaTypeFromMimeType(target.media.mimeType)).toBe('image')
    expect(target.paddingBottom).toBe('75%')
    expect(command).toMatchObject({
      type: 'bdc.anchor.create',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      media: { name: 'photo.png', mimeType: 'image/png' },
    })
  })

  it('rejects file types outside the media whitelist', () => {
    const service = new ElceAnchorDropService()
    expect(service.createFileDropTarget(new File(['text'], 'notes.txt', { type: 'text/plain' }), 'page-a')).toBeNull()
  })

  it('returns separate collections for unique catalog bdcs and reusable media', () => {
    const service = new ElceAnchorDropService()
    const document = createCatalogImageDocument()

    expect(service.catalogContents(document)).toEqual({
      bdcs: [{
        key: `${CATALOG_REFERENCE.BDC}:bdc-image-1`,
        name: 'photo.png',
        mediaType: 'image',
        reference: { kind: CATALOG_REFERENCE.BDC, bdcId: 'bdc-image-1' },
      }],
      media: [{
        key: `${CATALOG_REFERENCE.MEDIA}:media-image-1`,
        name: 'photo.png',
        mediaType: 'image',
        reference: { kind: CATALOG_REFERENCE.MEDIA, mediaId: 'media-image-1' },
      }],
    })
  })

  it('moves a unique catalog bdc or creates a new bdc from a reusable media reference', () => {
    const service = new ElceAnchorDropService()
    const document = createCatalogImageDocument()
    const bdcTarget = service.createCatalogDropTarget(
      document,
      { kind: CATALOG_REFERENCE.BDC, bdcId: 'bdc-image-1' },
      'page-a',
      'bdc-section-1',
    )
    const mediaTarget = service.createCatalogDropTarget(
      document,
      { kind: CATALOG_REFERENCE.MEDIA, mediaId: 'media-image-1' },
      'page-a',
      'bdc-section-1',
    )

    if (bdcTarget === null || mediaTarget === null) throw new Error('Les deux références du catalogue doivent être acceptées.')
    expect(bdcTarget.source).toBe(CATALOG_REFERENCE.BDC)
    expect(service.createDocumentCommand('bdc-section-1', catalogDrop(bdcTarget))).toMatchObject({
      type: 'bdc.anchor.attach',
      bdcId: 'bdc-image-1',
      pageId: 'page-a',
    })
    expect(mediaTarget.source).toBe(CATALOG_REFERENCE.MEDIA)
    expect(mediaTarget.bdcId).not.toBe('bdc-image-1')
    expect(service.createDocumentCommand('bdc-section-1', catalogDrop(mediaTarget))).toMatchObject({
      type: 'bdc.anchor.create',
      bdcId: mediaTarget.bdcId,
      media: { id: 'media-image-1' },
    })
  })

  it('rejects references outside the available catalog and Flux Section', () => {
    const service = new ElceAnchorDropService()
    const document = createCatalogImageDocument()
    const reference = { kind: CATALOG_REFERENCE.BDC, bdcId: 'bdc-image-1' } as const

    expect(service.createCatalogDropTarget(document, reference, null, 'bdc-section-1')).toBeNull()
    expect(service.createCatalogDropTarget(document, reference, 'missing-page', 'bdc-section-1')).toBeNull()
    expect(service.createCatalogDropTarget(document, reference, 'page-a', 'missing-section')).toBeNull()
    expect(service.createCatalogDropTarget(document, { kind: CATALOG_REFERENCE.BDC, bdcId: 'missing-bdc' }, 'page-a', 'bdc-section-1')).toBeNull()
  })

  it('sends the complete Section intention through its dispatcher', () => {
    const dispatched: Array<{ sectionBdcId: string; change: unknown }> = []
    const facade = new ElceAnchorDropFacade({ dispatch: (sectionBdcId, change) => dispatched.push({ sectionBdcId, change }) })
    const change = { kind: 'content' as const, title: '', content: { type: 'doc' as const, content: [{ type: 'paragraph' as const }] }, markup: '<p></p>' }

    facade.submitSectionChange('bdc-section-1', change)

    expect(dispatched).toEqual([{ sectionBdcId: 'bdc-section-1', change }])
  })

  it('maps an anchor return to its document command', () => {
    const service = new ElceAnchorDropService()
    const command = service.createDocumentCommand('bdc-section-1', {
      kind: 'anchor-return',
      anchorBdcId: 'bdc-image-1',
      title: '',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      markup: '<p></p>',
    })

    expect(command).toEqual({
      type: 'bdc.anchor.return',
      sectionBdcId: 'bdc-section-1',
      anchorBdcId: 'bdc-image-1',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      markup: '<p></p>',
    })
  })
})

function createCatalogImageDocument() {
  const withMedia = applyDocumentCommand(createInitialDocument(), {
    type: 'media.add',
    media: { id: 'media-image-1',  name: 'photo.png', mimeType: 'image/png', size: 5, caption: '' },
  })
  const withCard = applyDocumentCommand(withMedia, {
    type: 'bdc.create',
    bdcId: 'bdc-image-1',
    bdcType: BDC_TYPE.CARD,
    presetId: 'photo-basic',
    placement: { kind: BDC_LOCATION.CATALOG },
  })
  return applyDocumentCommand(withCard, { type: 'bdc.card.media.set', bdcId: 'bdc-image-1', mediaId: 'media-image-1' })
}

function catalogDrop(target: NonNullable<ReturnType<ElceAnchorDropService['createCatalogDropTarget']>>) {
  return {
    kind: 'catalog-drop' as const,
    target,
    title: '',
    content: { type: 'doc' as const, content: [{ type: 'paragraph' as const }] },
    markup: '<p></p>',
  }
}
