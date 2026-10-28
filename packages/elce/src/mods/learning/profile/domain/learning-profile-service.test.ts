import { describe, expect, it } from 'vitest'
import { applyDocumentCommand } from '../../../../domain/commands/document-commands'
import { learningDocumentService } from '../../document/learning-document-service'
import { LearningDocument } from '../../document/learning-document'
import type { ProfileDefinition, ProfileProperty } from './learning-profile-types'
import { learningProfileService } from './learning-profile-service'

const textProperty: ProfileProperty = {
  id: 'property-region',
  name: 'region',
  label: 'Région',
  type: 'text',
  required: false,
  choices: [],
}

describe('Elcé profile rules', () => {
  it('normalizes text comparisons and never matches a missing value', () => {
    const document = documentWithProfile({
      properties: [textProperty],
      fieldPropertyIds: [],
      constraints: [{
        id: 'constraint-region',
        target: { kind: 'chapter', id: 'chapter-1' },
        conditions: [{
          propertyId: textProperty.id,
          condition: { kind: 'text', operator: 'equals', value: 'Nord' },
          joinWithNext: null,
        }],
      }],
      readingConstraints: [],
    })

    expect(learningProfileService.bdcMatchesProfile(document, 'bdc-section-1', { [textProperty.id]: ' nord ' })).toBe(true)
    expect(learningProfileService.bdcMatchesProfile(document, 'bdc-section-1', {})).toBe(false)
  })

  it('resolves defaults and reports missing required fields', () => {
    const required: ProfileProperty = { ...textProperty, required: true }
    expect(learningProfileService.resolveProfileValues([{ ...textProperty, defaultValue: 'Sud' }], {})).toEqual({ [textProperty.id]: 'Sud' })
    expect(learningProfileService.validateProfileValues([required], [required.id], {})).toEqual(['Région est obligatoire.'])
    expect(learningProfileService.validateProfileValues([required], [required.id], { [required.id]: 'Alpes' })).toEqual([])
  })

  it('blocks property removal and reports each remaining usage', () => {
    const document = documentWithProfile({
      properties: [textProperty],
      fieldPropertyIds: [textProperty.id],
      constraints: [{
        id: 'visibility-region',
        target: { kind: 'chapter', id: 'chapter-1' },
        conditions: [{
          propertyId: textProperty.id,
          condition: { kind: 'text', operator: 'equals', value: 'Nord' },
          joinWithNext: null,
        }],
      }],
      readingConstraints: [],
    })

    expect(learningProfileService.profilePropertyUsages(document, textProperty.id)).toEqual([
      'champ du Formulaire',
      'visibilité chapter chapter-1',
    ])
    const profile = { ...document.data.profile, properties: [] }
    expect(() => applyDocumentCommand(document, { type: 'profile.definition.update', profile }))
      .toThrow(/Utilisations : champ du Formulaire/)
  })

  it('evaluates mixed visibility conditions with AND taking precedence over OR', () => {
    const propertyA: ProfileProperty = { ...textProperty, id: 'property-a', name: 'a' }
    const propertyB: ProfileProperty = { ...textProperty, id: 'property-b', name: 'b' }
    const propertyC: ProfileProperty = { ...textProperty, id: 'property-c', name: 'c' }
    const document = documentWithProfile({
      properties: [propertyA, propertyB, propertyC],
      fieldPropertyIds: [],
      constraints: [{
        id: 'visibility-mixed',
        target: { kind: 'chapter', id: 'chapter-1' },
        conditions: [
          { propertyId: propertyA.id, condition: { kind: 'text', operator: 'equals', value: 'yes' }, joinWithNext: 'or' },
          { propertyId: propertyB.id, condition: { kind: 'text', operator: 'equals', value: 'yes' }, joinWithNext: 'and' },
          { propertyId: propertyC.id, condition: { kind: 'text', operator: 'equals', value: 'yes' }, joinWithNext: null },
        ],
      }],
      readingConstraints: [],
    })
    const yes = 'yes'

    expect(learningProfileService.bdcMatchesProfile(document, 'bdc-section-1', { [propertyA.id]: yes, [propertyB.id]: 'no', [propertyC.id]: 'no' })).toBe(true)
    expect(learningProfileService.bdcMatchesProfile(document, 'bdc-section-1', { [propertyA.id]: 'no', [propertyB.id]: yes, [propertyC.id]: yes })).toBe(true)
    expect(learningProfileService.bdcMatchesProfile(document, 'bdc-section-1', { [propertyA.id]: 'no', [propertyB.id]: yes, [propertyC.id]: 'no' })).toBe(false)

    const properties = new Map([[propertyA.id, propertyA], [propertyB.id, propertyB], [propertyC.id, propertyC]])
    expect(learningProfileService.profileVisibilityMatches([
      { propertyId: propertyA.id, condition: { kind: 'text', operator: 'equals', value: yes }, joinWithNext: 'and' },
      { propertyId: propertyB.id, condition: { kind: 'text', operator: 'equals', value: yes }, joinWithNext: 'or' },
      { propertyId: propertyC.id, condition: { kind: 'text', operator: 'equals', value: yes }, joinWithNext: null },
    ], properties, { [propertyA.id]: yes, [propertyB.id]: 'no', [propertyC.id]: yes })).toBe(true)
    expect(learningProfileService.profileVisibilityMatches([
      { propertyId: propertyA.id, condition: { kind: 'text', operator: 'equals', value: yes }, joinWithNext: 'and' },
      { propertyId: propertyB.id, condition: { kind: 'text', operator: 'equals', value: yes }, joinWithNext: 'or' },
      { propertyId: propertyC.id, condition: { kind: 'text', operator: 'equals', value: yes }, joinWithNext: null },
    ], properties, { [propertyA.id]: yes, [propertyB.id]: 'no', [propertyC.id]: 'no' })).toBe(false)
  })

  it('lets a local visibility replace the complete inherited list', () => {
    const secondProperty: ProfileProperty = { ...textProperty, id: 'property-level', name: 'level' }
    const chapterVisibility = {
      id: 'chapter-visibility',
      target: { kind: 'chapter' as const, id: 'chapter-1' },
      conditions: [
        { propertyId: textProperty.id, condition: { kind: 'text' as const, operator: 'equals' as const, value: 'Nord' }, joinWithNext: 'and' as const },
        { propertyId: secondProperty.id, condition: { kind: 'text' as const, operator: 'equals' as const, value: 'débutant' }, joinWithNext: null },
      ],
    }
    const pageVisibility = {
      id: 'page-visibility',
      target: { kind: 'page' as const, id: 'page-a' },
      conditions: [{
        propertyId: textProperty.id,
        condition: { kind: 'text' as const, operator: 'equals' as const, value: 'Sud' },
        joinWithNext: null,
      }],
    }
    const document = documentWithProfile({
      properties: [textProperty, secondProperty],
      fieldPropertyIds: [],
      constraints: [chapterVisibility, pageVisibility],
      readingConstraints: [],
    })

    expect(learningProfileService.profileVisibilityForBdc(document, 'bdc-section-1')).toEqual(pageVisibility)
    expect(learningProfileService.bdcMatchesProfile(document, 'bdc-section-1', { [textProperty.id]: 'Sud' })).toBe(true)
    expect(learningProfileService.bdcMatchesProfile(document, 'bdc-section-1', { [textProperty.id]: 'Nord' })).toBe(false)
  })

  it('keeps locked chapter and page content in the projection while denying access', () => {
    const document = documentWithProfile({
      properties: [textProperty],
      fieldPropertyIds: [],
      constraints: [{
        id: 'locked-chapter',
        target: { kind: 'chapter', id: 'chapter-1' },
        conditions: [{
          propertyId: textProperty.id,
          condition: { kind: 'text', operator: 'equals', value: 'teacher' },
          joinWithNext: null,
        }],
        unmetBehavior: 'lock',
      }],
      readingConstraints: [],
    })

    expect(learningProfileService.pageVisibilityAllowsAccess(document, 'page-a', { [textProperty.id]: 'student' })).toBe(false)
    expect(learningProfileService.chapterVisibilityAllowsAccess(document, 'chapter-1', { [textProperty.id]: 'student' })).toBe(false)
    expect(learningProfileService.bdcMatchesProfile(document, 'bdc-section-1', { [textProperty.id]: 'student' })).toBe(true)
    expect(learningProfileService.bdcMatchesProfile(document, 'bdc-section-1', { [textProperty.id]: 'teacher' })).toBe(true)
  })

  it('does not allow the summary lock effect to target a BDC', () => {
    const document = learningDocumentService.createInitialDocument()
    const profile: ProfileDefinition = {
      ...document.data.profile,
      properties: [textProperty],
      constraints: [{
        id: 'locked-bdc',
        target: { kind: 'bdc', id: 'bdc-section-1' },
        conditions: [{
          propertyId: textProperty.id,
          condition: { kind: 'text', operator: 'equals', value: 'teacher' },
          joinWithNext: null,
        }],
        unmetBehavior: 'lock',
      }],
    }

    expect(() => applyDocumentCommand(document, { type: 'profile.definition.update', profile }))
      .toThrow('Le verrouillage de visibilité ne cible pas les BDC : bdc:bdc-section-1')
  })

  it('tracks references in document titles and BDC text and rejects unknown identifiers', () => {
    const source = learningDocumentService.createInitialDocument()
    const sectionBdc = source.bdcs[0]
    if (sectionBdc?.section == null) throw new Error('Profile reference fixture has no Section.')
    const document = new LearningDocument({
      ...source.data,
      summary: { ...source.data.summary, title: `Sommaire {{profile:${textProperty.id}}}` },
      chapters: source.chapters.map((chapter) => ({ ...chapter, name: `Chapitre {{profile:${textProperty.id}}}` })),
      pages: source.pages.map((page) => ({ ...page, name: `Page {{profile:${textProperty.id}}}` })),
      bdcs: source.bdcs.map((bdc) => bdc.id !== sectionBdc.id ? bdc : {
        ...bdc,
        section: {
          ...sectionBdc.section!,
          title: `Section {{profile:${textProperty.id}}}`,
          content: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: `Texte {{profile:${textProperty.id}}}` }] }],
          },
        },
      }),
      profile: { ...source.data.profile, properties: [textProperty] },
    })

    expect(learningProfileService.profilePropertyUsages(document, textProperty.id)).toEqual(expect.arrayContaining([
      'titre du Sommaire',
      `titre du chapitre ${source.chapters[0]?.id}`,
      `titre de la page ${source.pages[0]?.id}`,
      `titre de la Section ${sectionBdc.id}`,
      `texte de la Section ${sectionBdc.id}`,
    ]))
    expect(() => applyDocumentCommand(document, {
      type: 'profile.definition.update',
      profile: { ...document.data.profile, properties: [] },
    })).toThrow(/titre du Sommaire/)
  })

  it('rejects explicit prerequisite cycles with the chapter chain', () => {
    let document = learningDocumentService.createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-2', name: 'Chapitre 2',
    })
    const profile: ProfileDefinition = {
      ...document.data.profile,
      readingConstraints: [
        { id: 'read-1', target: { kind: 'chapter', id: 'chapter-1' }, requirement: { kind: 'chapters', chapterIds: ['chapter-2'] } },
        { id: 'read-2', target: { kind: 'chapter', id: 'chapter-2' }, requirement: { kind: 'chapters', chapterIds: ['chapter-1'] } },
      ],
    }

    expect(() => applyDocumentCommand(document, { type: 'profile.definition.update', profile }))
      .toThrow('Cycle de prérequis : chapter-1 → chapter-2 → chapter-1')
  })

  it('checks every named prerequisite edge when detecting a cycle', () => {
    let document = learningDocumentService.createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-2', name: 'Chapitre 2',
    })
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-3', name: 'Chapitre 3',
    })
    const profile: ProfileDefinition = {
      ...document.data.profile,
      readingConstraints: [
        {
          id: 'read-1',
          target: { kind: 'chapter', id: 'chapter-1' },
          requirement: { kind: 'chapters', chapterIds: ['chapter-2', 'chapter-3'] },
        },
        {
          id: 'read-3',
          target: { kind: 'chapter', id: 'chapter-3' },
          requirement: { kind: 'chapters', chapterIds: ['chapter-1'] },
        },
      ],
    }

    expect(() => applyDocumentCommand(document, { type: 'profile.definition.update', profile }))
      .toThrow('Cycle de prérequis : chapter-1 → chapter-3 → chapter-1')
  })

  it('detects a cycle that combines an explicit chapter and the previous chapter', () => {
    let document = learningDocumentService.createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-2', name: 'Chapitre 2',
    })
    const profile: ProfileDefinition = {
      ...document.data.profile,
      readingConstraints: [
        {
          id: 'read-1',
          target: { kind: 'chapter', id: 'chapter-1' },
          requirement: { kind: 'chapters', chapterIds: ['chapter-2'] },
        },
        {
          id: 'read-2',
          target: { kind: 'chapter', id: 'chapter-2' },
          requirement: { kind: 'previous-chapter' },
        },
      ],
    }

    expect(() => applyDocumentCommand(document, { type: 'profile.definition.update', profile }))
      .toThrow('Cycle de prérequis : chapter-1 → chapter-2 → chapter-1')
  })
})

/** Creates a valid document carrying one candidate profile definition. */
function documentWithProfile(profile: ProfileDefinition) {
  const document = learningDocumentService.createInitialDocument()
  return applyDocumentCommand(document, { type: 'profile.definition.update', profile })
}
