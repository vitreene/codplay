/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { BDC_TYPE, DEFAULT_PRESET_ID } from '../learning-definition'
import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { STATISTICAL_GRAPH_RENDERING } from '../../../resources/bdcs/statistical-graph/statistical-graph-config'
import { CATALOG_REFERENCE } from '../../../core/catalog/catalog-config'
import { BDC_LOCATION } from '../../../core/document/content-location'
import {
  applyDocumentCommand,
  createCarouselBdcCommand,
  createChapterCommand,
  createDefaultPageCommand,
  createEvaluationResultBdcCommand,
  createQuestionBdcCommand,
  createSectionBdcCommand,
  createStatisticalGraphBdcCommand,
  createStandaloneCardBdcCommand,
} from '../../../domain/commands/document-commands'
import { learningDocumentService } from '../document/learning-document-service'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import { ElceAnchorDropService } from '../../../resources/anchoring/domain/anchor-drop-service'
import { createLearningAnchorDropService } from '../anchoring/learning-anchor-drop-service'
import type { ResourceDocumentData } from '../../../resources/document/resource-document-types'

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

    expect(service.catalogContents(document.data)).toEqual({
      bdcs: [{
        key: `${CATALOG_REFERENCE.BDC}:bdc-image-1`,
        name: 'photo.png',
        bdcType: BDC_TYPE.CARD,
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

  it('reads catalog entries from a resource document without Learning fields', () => {
    const document: ResourceDocumentData = {
      id: 'resource-only',
      pages: [],
      catalogPageIds: [],
      bdcs: [{
        id: 'bdc-section',
        type: 'section',
        presetId: 'section-basic',
        pageId: null,
        parentBdcId: null,
        section: {
          title: 'Section indépendante',
          markup: '<p></p>',
          content: { type: 'doc', content: [] },
          revelation: { intro: null, outro: null },
        },
        question: null,
      }],
      catalogBdcIds: ['bdc-section'],
      medias: [],
    }

    expect(new ElceAnchorDropService().catalogContents(document)).toEqual({
      bdcs: [{
        key: `${CATALOG_REFERENCE.BDC}:bdc-section`,
        name: 'Section indépendante',
        bdcType: 'section',
        reference: { kind: CATALOG_REFERENCE.BDC, bdcId: 'bdc-section' },
      }],
      media: [],
    })
  })

  it('lists every root BDC type and allows Cards or Graphs as inline illustrations', () => {
    const service = createLearningAnchorDropService()
    let document = learningDocumentService.createInitialDocument()
    const fluxPage = document.pages[0]
    if (fluxPage === undefined) throw new Error('Le document ne contient pas de page Flux.')
    const sectionBdcId = fluxPage.bdcIds[0]
    if (sectionBdcId === undefined) throw new Error('La page Flux ne contient pas de Section.')
    document = applyDocumentCommand(document, { type: 'bdc.remove', bdcId: sectionBdcId })
    document = applyDocumentCommand(document, createSectionBdcCommand('bdc-page-section', fluxPage.id, 0))
    document = applyDocumentCommand(document, createStandaloneCardBdcCommand('bdc-text-short', fluxPage.id, DEFAULT_PRESET_ID.TEXT_SHORT))
    document = applyDocumentCommand(document, createQuestionBdcCommand('bdc-question', fluxPage.id, 1))
    document = applyDocumentCommand(document, createCarouselBdcCommand('bdc-carousel', fluxPage.id, 2, 'bdc-carousel-card'))
    document = applyDocumentCommand(document, createStatisticalGraphBdcCommand('bdc-graph', fluxPage.id, 3))

    const evaluationChapter = createChapterCommand(document, 'Évaluation', CHAPTER_TYPE.EVALUATION)
    document = applyDocumentCommand(document, evaluationChapter)
    const evaluationPage = createDefaultPageCommand(
      document,
      { kind: PAGE_LOCATION.CHAPTER, chapterId: evaluationChapter.chapterId },
      'Résultat',
    )
    document = applyDocumentCommand(document, evaluationPage)
    document = applyDocumentCommand(document, createEvaluationResultBdcCommand('bdc-result', evaluationPage.pageId, 1))
    for (const bdcId of ['bdc-text-short', 'bdc-question', 'bdc-carousel', 'bdc-result', 'bdc-graph']) {
      document = applyDocumentCommand(document, { type: 'bdc.remove', bdcId })
    }

    const catalog = service.catalogContents(document.data)
    expect(catalog.bdcs.map(({ bdcType }) => bdcType)).toEqual([
      BDC_TYPE.SECTION,
      BDC_TYPE.CARD,
      BDC_TYPE.QUESTION,
      BDC_TYPE.CAROUSEL,
      BDC_TYPE.EVALUATION_RESULT,
      BDC_TYPE.STATISTICAL_GRAPH,
    ])
    expect(service.createCatalogDropTarget(
      document.data,
      { kind: CATALOG_REFERENCE.BDC, bdcId: 'bdc-text-short' },
      fluxPage.id,
      'bdc-page-section',
    )).toMatchObject({ bdcId: 'bdc-text-short', presetId: DEFAULT_PRESET_ID.TEXT_SHORT })
    const graphTarget = service.createCatalogDropTarget(
      document.data,
      { kind: CATALOG_REFERENCE.BDC, bdcId: 'bdc-graph' },
      fluxPage.id,
      'bdc-page-section',
    )
    expect(graphTarget).toMatchObject({ bdcId: 'bdc-graph', paddingBottom: '56.25%' })
    const graph = document.bdcs.find((bdc) => bdc.id === 'bdc-graph')
    if (graph?.statisticalGraph == null) throw new Error('Le BDC Graphe doit porter son contenu métier.')
    document = applyDocumentCommand(document, {
      type: 'bdc.statistical-graph.update',
      bdcId: 'bdc-graph',
      statisticalGraph: { ...graph.statisticalGraph, rendering: STATISTICAL_GRAPH_RENDERING.TABLE },
    })
    expect(service.createCatalogDropTarget(
      document.data,
      { kind: CATALOG_REFERENCE.BDC, bdcId: 'bdc-graph' },
      fluxPage.id,
      'bdc-page-section',
    )).toMatchObject({ bdcId: 'bdc-graph', paddingBottom: '100%' })
    for (const bdcId of ['bdc-question', 'bdc-carousel', 'bdc-result', sectionBdcId]) {
      expect(service.createCatalogDropTarget(
        document.data,
        { kind: CATALOG_REFERENCE.BDC, bdcId },
        fluxPage.id,
        'bdc-page-section',
      )).toBeNull()
    }
  })

  it('moves a unique catalog bdc or creates a new bdc from a reusable media reference', () => {
    const service = new ElceAnchorDropService()
    const document = createCatalogImageDocument()
    const bdcTarget = service.createCatalogDropTarget(
      document.data,
      { kind: CATALOG_REFERENCE.BDC, bdcId: 'bdc-image-1' },
      'page-a',
      'bdc-section-1',
    )
    const mediaTarget = service.createCatalogDropTarget(
      document.data,
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

    expect(service.createCatalogDropTarget(document.data, reference, null, 'bdc-section-1')).toBeNull()
    expect(service.createCatalogDropTarget(document.data, reference, 'missing-page', 'bdc-section-1')).toBeNull()
    expect(service.createCatalogDropTarget(document.data, reference, 'page-a', 'missing-section')).toBeNull()
    expect(service.createCatalogDropTarget(document.data, { kind: CATALOG_REFERENCE.BDC, bdcId: 'missing-bdc' }, 'page-a', 'bdc-section-1')).toBeNull()
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
  const withMedia = applyDocumentCommand(learningDocumentService.createInitialDocument(), {
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
