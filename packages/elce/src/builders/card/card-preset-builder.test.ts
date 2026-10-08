import { describe, expect, it } from 'vitest'
import { CARD_LAYOUT_IDS, DEFAULT_PRESET_ID } from '../../config/document-config'
import { CARD_PRESETS } from '../../config/presets'
import { applyDocumentCommand, createCarouselBdcCommand } from '../../domain/commands/document-commands'
import { createInitialDocument } from '../../domain/document/document-model'
import { ElceCardPresetBuilder } from './card-preset-builder'
import { ElceCardBdcSceneBuilder } from './card-bdc-scene-builder'
import { buildQuestionCardPreset } from '../question/question-bdc-scene-builder'

describe('ElceCardPresetBuilder', () => {
  const builder = new ElceCardPresetBuilder()

  it('registers only the layouts supported by the BDC builders', () => {
    expect(Object.keys(CARD_PRESETS).sort()).toEqual([
      ...CARD_LAYOUT_IDS,
      DEFAULT_PRESET_ID.CAROUSEL,
      DEFAULT_PRESET_ID.EVALUATION_RESULT,
      DEFAULT_PRESET_ID.QUESTION,
      DEFAULT_PRESET_ID.SECTION,
    ].sort())
  })

  it('resolves every fixed preset to unique markup with identified elements and comment insertion anchors', () => {
    for (const preset of Object.values(CARD_PRESETS)) {
      /** Supplies concrete branch markup for the dynamic Result preset slot. */
      const createPresetContent = (prefix: string): Readonly<Record<string, string>> => preset.id === DEFAULT_PRESET_ID.EVALUATION_RESULT
        ? { branch: `<section id="${prefix}-branch">${preset.zones.map((zone) => `<!-- data-part="${prefix}:${zone.id}" -->`).join('')}</section>` }
        : {}
      const first = builder.build(preset.id, `${preset.id}-first`, `${preset.id}:first`, createPresetContent(`${preset.id}:first`))
      const second = builder.build(preset.id, `${preset.id}-second`, `${preset.id}:second`, createPresetContent(`${preset.id}:second`))
      const firstElements = Array.from(first.markup.matchAll(/<([a-z][\w-]*)([^>]*)>/gi))

      expect(first.markup).not.toContain('{{')
      expect(second.markup).not.toContain('{{')
      expect(first.markup).not.toBe(second.markup)
      expect(firstElements.every((element) => /\bid="[^"]+"/.test(element[2] ?? ''))).toBe(true)
      expect(first.markup).not.toMatch(/<[a-z][\w-]*[^>]*\bdata-part=/i)
      for (const zone of preset.zones) {
        const optionalQuestionZone = preset.id === DEFAULT_PRESET_ID.QUESTION
          && (zone.id === 'title' || zone.id === 'illustration')
        if (optionalQuestionZone) {
          expect(first.markup).not.toContain(`<!-- data-part="${preset.id}:first:${zone.id}" -->`)
        } else {
          expect(first.markup).toContain(`<!-- data-part="${preset.id}:first:${zone.id}" -->`)
        }
        expect(first.zonePartIds[zone.id]).toBe(`${preset.id}:first:${zone.id}`)
        expect(first.zoneClassNames[zone.id]).toBe(zone.className)
      }
    }
  })

  it('keeps the three required Question zones separate from optional zones', () => {
    const question = CARD_PRESETS[DEFAULT_PRESET_ID.QUESTION]

    expect(question.zones.map(({ id, required }) => [id, required])).toEqual([
      ['title', false],
      ['illustration', false],
      ['question', true],
      ['answers', true],
      ['validation', true],
    ])
    expect(question.zones.map(({ content }) => content)).toEqual(['text', 'media', 'text', 'bdc', 'bdc'])
  })

  it('inserts Section text into its body zone without changing its order', () => {
    const markup = builder.build(
      DEFAULT_PRESET_ID.SECTION,
      'page-a-section-card',
      'page-a:section',
      { body: '<p id="section-copy">Texte auteur</p>' },
    ).markup

    expect(markup.indexOf('<!-- data-part="page-a:section:title" -->'))
      .toBeLessThan(markup.indexOf('id="section-copy"'))
    expect(markup).toContain('<div id="page-a-section-card-body"><!-- data-part="page-a:section:body" --><p id="section-copy">Texte auteur</p></div>')
  })

  it('emits Question hosts only when their optional content exists', () => {
    const empty = buildQuestionCardPreset('question-card', 'question:card', { title: '', mediaId: null })
    const populated = buildQuestionCardPreset('question-card', 'question:card', { title: 'Titre', mediaId: 'media-1' })

    expect(empty.markup).not.toContain('question-card-title-host')
    expect(empty.markup).not.toContain('question-card-illustration')
    expect(populated.markup).toContain('<header id="question-card-title-host"><!-- data-part="question:card:title" --></header>')
    expect(populated.markup).toContain('<div id="question-card-illustration" class="elce-question-illustration"><!-- data-part="question:card:illustration" --></div>')
  })

  it('omits empty optional text elements in every Card layout', () => {
    const initial = createInitialDocument()
    const document = applyDocumentCommand(initial, createCarouselBdcCommand('bdc-carousel-layouts', 'page-a', 1, 'bdc-card-layouts'))
    const card = document.bdcs.find((bdc) => bdc.id === 'bdc-card-layouts')!
    const builder = new ElceCardBdcSceneBuilder()

    for (const presetId of [DEFAULT_PRESET_ID.TEXT_SHORT, DEFAULT_PRESET_ID.TEXT_IMAGE, DEFAULT_PRESET_ID.PHOTO, DEFAULT_PRESET_ID.IMAGE_CAPTION]) {
      const build = builder.build({
        pageId: 'page-a',
        containerBdcId: 'bdc-carousel-layouts',
        bdc: { ...card, presetId },
        mediaSources: {},
        mediaTypes: {},
      })
      expect(build.contentPersos, presetId).toHaveLength(0)
    }
  })

  it('leaves the Question prompt as a comment target instead of an empty legend', () => {
    const markup = builder.build(DEFAULT_PRESET_ID.QUESTION, 'question-card', 'question:card').markup

    expect(markup).toMatch(/<fieldset id="question-card-fieldset">\s*<!-- data-part="question:card:question" -->/)
    expect(markup).not.toContain('<legend')
    expect(markup).toContain('</fieldset>\n          <!-- data-part="question:card:validation" -->')
    expect(markup).not.toContain('question-card-validation')
  })
})
