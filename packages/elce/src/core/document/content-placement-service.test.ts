import { describe, expect, it } from 'vitest'
import type { ContentBdc, ContentChapter, ContentPage } from './content-document-types'
import { assertContentPlacementInvariants, findBdc, findChapter, findPage } from './content-placement-service'

describe('content placement lookup services', () => {
  it('finds resource views without requiring a Learning document', () => {
    const page: ContentPage = {
      id: 'page-one',
      name: 'Page one',
      type: 'resource-page',
      chapterId: null,
      bdcIds: ['bdc-one'],
    }
    const bdc: ContentBdc = {
      id: 'bdc-one',
      type: 'resource-bdc',
      presetId: 'resource-preset',
      pageId: page.id,
      parentBdcId: null,
    }
    const chapter: ContentChapter = {
      id: 'chapter-one',
      name: 'Chapter one',
      type: 'resource-chapter',
      pageIds: [page.id],
    }

    expect(findPage([page], page.id)).toBe(page)
    expect(findBdc([bdc], bdc.id)).toBe(bdc)
    expect(findChapter([chapter], chapter.id)).toBe(chapter)
  })

  it('preserves structural lookup errors', () => {
    expect(() => findPage([], 'missing-page')).toThrow('Page inconnue : missing-page')
    expect(() => findBdc([], 'missing-bdc')).toThrow('Bdc inconnu : missing-bdc')
    expect(() => findChapter([], 'missing-chapter')).toThrow('Chapitre inconnu : missing-chapter')
  })

  it('validates independent page and BDC placement data', () => {
    const page: ContentPage = {
      id: 'page-one',
      name: 'Page one',
      type: 'resource-page',
      chapterId: null,
      bdcIds: ['bdc-one'],
    }
    const bdc: ContentBdc = {
      id: 'bdc-one',
      type: 'resource-bdc',
      presetId: 'resource-preset',
      pageId: page.id,
      parentBdcId: null,
    }

    expect(assertContentPlacementInvariants({
      pages: [page],
      bdcs: [bdc],
      catalogPageIds: [],
      catalogBdcIds: [],
      scenarioPageIds: [page.id],
    })).toEqual(new Set([bdc.id]))
    expect(() => assertContentPlacementInvariants({
      pages: [page, page],
      bdcs: [bdc],
      catalogPageIds: [],
      catalogBdcIds: [],
      scenarioPageIds: [page.id, page.id],
    })).toThrow('Page dupliquée : page-one')
  })
})
