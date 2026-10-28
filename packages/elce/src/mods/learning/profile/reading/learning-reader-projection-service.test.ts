import { describe, expect, it } from 'vitest'
import { BDC_TYPE, DEFAULT_PRESET_ID } from '../../learning-definition'
import { PAGE_LOCATION } from '../../organization/learning-page-placement'
import { BDC_LOCATION } from '../../../../core/document/content-location'
import { applyDocumentCommand, createPageCommand } from '../../../../domain/commands/document-commands'
import { learningDocumentService } from '../../document/learning-document-service'
import { LearningDocument } from '../../document/learning-document'
import type { ProfileDefinition, ProfileProperty } from '../domain/learning-profile-types'
import { learningReaderProjectionService } from './learning-reader-projection-service'

const audience: ProfileProperty = {
  id: 'profile-audience',
  name: 'audience',
  label: 'Audience',
  type: 'text',
  required: false,
  choices: [],
}

describe('Elcé reader projection', () => {
  it('filters empty pages and chapters without mutating the source document', () => {
    let document = learningDocumentService.createInitialDocument()
    const profile: ProfileDefinition = {
      ...document.data.profile,
      properties: [audience],
      constraints: [{
        id: 'constraint-audience',
        target: { kind: 'bdc', id: 'bdc-section-1' },
        conditions: [{
          propertyId: audience.id,
          condition: { kind: 'text', operator: 'equals', value: 'teacher' },
          joinWithNext: null,
        }],
      }],
    }
    document = applyDocumentCommand(document, { type: 'profile.definition.update', profile })

    const reader = learningReaderProjectionService.projectReaderDocument(document, { [audience.id]: 'student' }, true)

    expect(reader.scenarioPageIds).toEqual([])
    expect(reader.chapters).toEqual([])
    expect(reader.pages).toEqual([])
    expect(reader.bdcs).toEqual([])
    expect(document.scenarioPageIds).toEqual(['page-a'])
    expect(document.bdcs.map(({ id }) => id)).toEqual(['bdc-section-1'])
    expect(learningReaderProjectionService.projectReaderDocument(document, { [audience.id]: 'student' }, false).scenarioPageIds).toEqual(['page-a'])
  })

  it('retains a page and its chapter when their visibility effect is lock', () => {
    const source = learningDocumentService.createInitialDocument()
    const document = applyDocumentCommand(source, {
      type: 'profile.definition.update',
      profile: {
        ...source.data.profile,
        properties: [audience],
        constraints: [{
          id: 'locked-chapter',
          target: { kind: 'chapter', id: 'chapter-1' },
          conditions: [{
            propertyId: audience.id,
            condition: { kind: 'text', operator: 'equals', value: 'teacher' },
            joinWithNext: null,
          }],
          unmetBehavior: 'lock',
        }],
      },
    })

    const reader = learningReaderProjectionService.projectReaderDocument(document, { [audience.id]: 'student' }, true)

    expect(reader.scenarioPageIds).toEqual(['page-a'])
    expect(reader.chapters.map((chapter) => chapter.id)).toEqual(['chapter-1'])
    expect(reader.pages.map((page) => page.id)).toContain('page-a')
    expect(reader.pages.find((page) => page.id === 'page-a')?.bdcIds).toEqual(['bdc-section-1'])
  })

  it('rejects a multi-chapter prerequisite when any named chapter is filtered out', () => {
    let document = learningDocumentService.createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-2', name: 'Chapitre 2',
    })
    document = applyDocumentCommand(document, createPageCommand({
      pageId: 'page-b', bdcId: 'bdc-section-b',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-2' },
    }))
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-3', name: 'Chapitre 3',
    })
    document = applyDocumentCommand(document, createPageCommand({
      pageId: 'page-c', bdcId: 'bdc-section-c',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-3' },
    }))
    document = applyDocumentCommand(document, {
      type: 'profile.definition.update',
      profile: {
        ...document.data.profile,
        properties: [audience],
        constraints: [{
          id: 'hide-chapter-2-content',
          target: { kind: 'bdc', id: 'bdc-section-b' },
          conditions: [{
            propertyId: audience.id,
            condition: { kind: 'text', operator: 'equals', value: 'teacher' },
            joinWithNext: null,
          }],
        }],
        readingConstraints: [{
          id: 'chapter-3-prerequisites',
          target: { kind: 'chapter', id: 'chapter-3' },
          requirement: { kind: 'chapters', chapterIds: ['chapter-1', 'chapter-2'] },
        }],
      },
    })

    expect(() => learningReaderProjectionService.projectReaderDocument(document, { [audience.id]: 'student' }, true))
      .toThrow('Le prérequis du chapitre chapter-3 vise un chapitre exclu : chapter-2')
  })

  it('resolves stable profile references in summary, chapter and page titles', () => {
    const source = learningDocumentService.createInitialDocument()
    const document = new LearningDocument({
      ...source.data,
      summary: { ...source.data.summary, title: `Bonjour {{profile:${audience.id}}}` },
      chapters: source.chapters.map((chapter) => ({ ...chapter, name: `Niveau {{profile:${audience.id}}}` })),
      pages: source.pages.map((page) => ({ ...page, name: `Page {{profile:${audience.id}}}` })),
      profile: { ...source.data.profile, properties: [audience] },
    })

    const reader = learningReaderProjectionService.projectReaderDocument(document, { [audience.id]: '<élève>' }, false)

    expect(reader.data.summary.title).toBe('Bonjour &lt;élève&gt;')
    expect(reader.chapters[0]?.name).toBe('Niveau &lt;élève&gt;')
    expect(reader.pages.find((page) => source.scenarioPageIds.includes(page.id))?.name).toBe('Page &lt;élève&gt;')
  })

  it('removes filtered Carousel children and resolves stable profile tokens in text', () => {
    let document = applyDocumentCommand(learningDocumentService.createInitialDocument(), {
      type: 'bdc.create',
      bdcId: 'bdc-carousel',
      bdcType: BDC_TYPE.CAROUSEL,
      presetId: DEFAULT_PRESET_ID.CAROUSEL,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a', index: 1 },
      initialCardBdcId: 'bdc-card-student',
    })
    document = applyDocumentCommand(document, {
      type: 'bdc.create',
      bdcId: 'bdc-card-teacher',
      bdcType: BDC_TYPE.CARD,
      presetId: DEFAULT_PRESET_ID.TEXT_SHORT,
      placement: { kind: BDC_LOCATION.PARENT, parentBdcId: 'bdc-carousel', index: 1 },
    })
    const profile: ProfileDefinition = {
      ...document.data.profile,
      properties: [audience],
      constraints: [
        {
          id: 'keep-student-card',
          target: { kind: 'bdc', id: 'bdc-card-student' },
          conditions: [{
            propertyId: audience.id,
            condition: { kind: 'text', operator: 'equals', value: 'student' },
            joinWithNext: null,
          }],
        },
        {
          id: 'keep-teacher-card',
          target: { kind: 'bdc', id: 'bdc-card-teacher' },
          conditions: [{
            propertyId: audience.id,
            condition: { kind: 'text', operator: 'equals', value: 'teacher' },
            joinWithNext: null,
          }],
        },
      ],
    }
    document = applyDocumentCommand(document, { type: 'profile.definition.update', profile })

    const reader = learningReaderProjectionService.projectReaderDocument(document, { [audience.id]: 'student' }, true)

    expect(reader.bdcs.find(({ id }) => id === 'bdc-carousel')?.carousel?.cards.map(({ bdcId }) => bdcId))
      .toEqual(['bdc-card-student'])
    expect(reader.bdcs.some(({ id }) => id === 'bdc-card-teacher')).toBe(false)
    expect(learningReaderProjectionService.resolveProfileTokens('Bonjour {{profile:profile-audience}}', { [audience.id]: '<élève>' }))
      .toBe('Bonjour &lt;élève&gt;')
  })

  it('removes a filtered anchored BDC and its authored anchor from both text forms', () => {
    const source = learningDocumentService.createInitialDocument()
    const anchor = 'bdc-hidden-anchor'
    const document = new LearningDocument({
      ...source.data,
      profile: {
        ...source.data.profile,
        properties: [audience],
        constraints: [{
          id: 'hide-anchor',
          target: { kind: 'bdc', id: anchor },
          conditions: [{
            propertyId: audience.id,
            condition: { kind: 'text', operator: 'equals', value: 'teacher' },
            joinWithNext: null,
          }],
        }],
      },
      bdcs: [
        {
          ...source.bdcs[0]!,
          section: {
            ...source.bdcs[0]!.section!,
            markup: '<p>Avant <span id="anchor" data-elce-anchor="true" data-bdc-id="bdc-hidden-anchor" data-part="anchor"></span> après</p>',
            content: {
              type: 'doc',
              content: [{ type: 'paragraph', content: [
                { type: 'text', text: 'Avant ' },
                { type: 'elceAnchor', attrs: { bdcId: anchor, partId: 'anchor' } },
                { type: 'text', text: ' après' },
              ] },
            ],
            },
          },
        },
        {
          id: anchor,
          type: BDC_TYPE.CARD,
          presetId: DEFAULT_PRESET_ID.TEXT_SHORT,
          pageId: null,
          parentBdcId: 'bdc-section-1',
          section: null,
          question: null,
          evaluationResult: null,
          carousel: null,
          card: {
            mediaId: null,
            overline: '',
            title: 'Carte masquée',
            description: '',
            message: '',
            note: '',
            caption: '',
            imagePosition: 'left',
            imageFit: 'cover',
          },
          statisticalGraph: null,
        },
      ],
    })

    const reader = learningReaderProjectionService.projectReaderDocument(document, { [audience.id]: 'student' }, true)

    expect(reader.bdcs.some(({ id }) => id === anchor)).toBe(false)
    expect(reader.bdcs[0]?.section?.markup).not.toContain('data-elce-anchor')
    expect(JSON.stringify(reader.bdcs[0]?.section?.content)).not.toContain('elceAnchor')
    expect(document.bdcs[0]?.section?.markup).toContain('data-elce-anchor')
  })
})
