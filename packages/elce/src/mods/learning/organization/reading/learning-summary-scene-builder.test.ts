import { describe, expect, it } from 'vitest'
import { BDC_TYPE, DEFAULT_PRESET_ID } from '../../learning-definition'
import { PAGE_LOCATION } from '../learning-page-placement'
import { BDC_LOCATION } from '../../../../core/document/content-location'
import { applyDocumentCommand, createPageCommand, createSummaryBdcCommand } from '../../../../domain/commands/document-commands'
import { learningDocumentService } from '../../document/learning-document-service'
import { buildSummaryBdcScene, buildSummaryEntries } from './learning-summary-scene-builder'

describe('Learning Summary BDC scene builder', () => {
  it('uses the host chapter as a relative scope and shares the display mode', () => {
    const document = createScopedDocument()
    const pageScope = { kind: 'chapter' as const, chapterId: 'chapter-1' }

    expect(buildSummaryEntries(document, pageScope).map(({ id, pageId, kind }) => ({ id, pageId, kind }))).toEqual([
      { id: 'page-a', pageId: 'page-a', kind: 'page' },
      { id: 'page-b', pageId: 'page-b', kind: 'page' },
      { id: 'page-c', pageId: 'page-c', kind: 'page' },
    ])
    expect(buildSummaryEntries(document, { kind: 'root' }).map(({ id, pageId }) => ({ id, pageId }))).toEqual([
      { id: 'page-a', pageId: 'page-a' },
      { id: 'page-b', pageId: 'page-b' },
      { id: 'page-c', pageId: 'page-c' },
    ])

    const chaptersOnly = applyDocumentCommand(document, {
      type: 'summary.settings.update',
      summary: { ...document.data.summary, displayMode: 'chapters' },
    })
    expect(buildSummaryEntries(chaptersOnly, pageScope).map(({ id, pageId, kind, parentChapterId }) => ({
      id,
      pageId,
      kind,
      parentChapterId,
    }))).toEqual([{
      id: 'chapter-child',
      pageId: 'page-b',
      kind: 'chapter',
      parentChapterId: 'chapter-1',
    }])
    expect(buildSummaryEntries(chaptersOnly, { kind: 'root' }).map(({ id }) => id)).toEqual(['chapter-1'])
  })

  it('builds a list-only embedded scene and exposes the main-summary action only when available', () => {
    const document = createScopedDocument()
    const page = document.pages.find((candidate) => candidate.id === 'page-a')
    if (page === undefined) throw new Error('The host page is missing.')

    const withMainSummary = applyDocumentCommand(document, {
      type: 'summary.settings.update',
      summary: { ...document.data.summary, showAtRoot: true },
    })
    const summaryPage = withMainSummary.pages.find((candidate) => candidate.id === page.id)
    if (summaryPage === undefined) throw new Error('The host page is missing from the updated document.')
    const built = buildSummaryBdcScene(withMainSummary, summaryPage, 'bdc-summary', 'summary appearance')
    const story = built.stories[0]
    if (story === undefined) throw new Error('The Summary BDC story is missing.')
    const root = story.persos.find((perso) => perso.id === 'page-a-bdc-summary-summary-root')
    const returnToMainId = `${withMainSummary.id}:summary:page-a:bdc-summary-return-to-main-summary`
    const returnToMain = story.persos.find((perso) => perso.id === returnToMainId)
    const rootMarkup = root?.initial?.markup

    expect(built.mountMarkup).toContain(built.mountPartId)
    expect(rootMarkup).toContain('elce-summary--embedded')
    expect(rootMarkup).toContain('summary appearance')
    expect(rootMarkup).not.toContain('elce-summary__title')
    expect(returnToMain?.initial?.content).toBe('Retour au Sommaire principal')

    const withoutMainSummary = buildSummaryBdcScene(document, page, 'bdc-summary', 'summary appearance')
    expect(withoutMainSummary.stories[0]?.persos.some((perso) => perso.id === returnToMainId)).toBe(false)
  })

  it('creates a page-only BDC with its configured preset and rejects catalogue placement', () => {
    const document = learningDocumentService.createInitialDocument()
    const created = applyDocumentCommand(document, createSummaryBdcCommand('bdc-summary', 'page-a', 1))

    expect(created.pages[0]?.bdcIds).toEqual(['bdc-section-1', 'bdc-summary'])
    expect(created.bdcs.find((bdc) => bdc.id === 'bdc-summary')).toMatchObject({
      type: BDC_TYPE.SUMMARY,
      presetId: DEFAULT_PRESET_ID.SUMMARY,
      pageId: 'page-a',
      parentBdcId: null,
      section: null,
      question: null,
      card: null,
    })
    expect(() => applyDocumentCommand(document, {
      type: 'bdc.create',
      bdcId: 'bdc-summary-catalog',
      bdcType: BDC_TYPE.SUMMARY,
      presetId: DEFAULT_PRESET_ID.SUMMARY,
      placement: { kind: BDC_LOCATION.CATALOG },
    })).toThrow('Un BDC Sommaire doit être placé directement dans une page.')
  })
})

/** Creates nested chapters, pages, and a Summary BDC on a page in the scope root. */
function createScopedDocument() {
  let document = learningDocumentService.createInitialDocument()
  document = applyDocumentCommand(document, {
    type: 'chapter.create',
    chapterId: 'chapter-child',
    name: 'Chapitre enfant',
    parentChapterId: 'chapter-1',
  })
  document = applyDocumentCommand(document, createPageCommand({
    pageId: 'page-b',
    bdcId: 'bdc-section-b',
    name: 'Page B',
    placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-child' },
  }))
  document = applyDocumentCommand(document, {
    type: 'chapter.create',
    chapterId: 'chapter-grandchild',
    name: 'Chapitre petit-enfant',
    parentChapterId: 'chapter-child',
  })
  document = applyDocumentCommand(document, createPageCommand({
    pageId: 'page-c',
    bdcId: 'bdc-section-c',
    name: 'Page C',
    placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-grandchild' },
  }))
  return applyDocumentCommand(document, createSummaryBdcCommand('bdc-summary', 'page-a', 1))
}
