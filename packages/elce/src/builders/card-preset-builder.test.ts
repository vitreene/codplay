import { describe, expect, it } from 'vitest'
import { DEFAULT_PRESET_ID } from '../config/document-config'
import { CARD_PRESETS } from '../config/presets'
import { ElceCardPresetBuilder } from './card-preset-builder'

describe('ElceCardPresetBuilder', () => {
  const builder = new ElceCardPresetBuilder()

  it('resolves every fixed preset to unique markup with identified parent elements', () => {
    for (const preset of Object.values(CARD_PRESETS)) {
      const first = builder.build(preset.id, `${preset.id}-first`, `${preset.id}:first`)
      const second = builder.build(preset.id, `${preset.id}-second`, `${preset.id}:second`)
      const firstElements = Array.from(first.markup.matchAll(/<([a-z][\w-]*)([^>]*)>/gi))

      expect(first.markup).not.toContain('{{')
      expect(second.markup).not.toContain('{{')
      expect(first.markup).not.toBe(second.markup)
      expect(firstElements.every((element) => /\bid="[^"]+"/.test(element[2] ?? ''))).toBe(true)
      for (const zone of preset.zones) {
        expect(first.markup).toContain(`data-part="${preset.id}:first:${zone.id}"`)
        expect(first.zonePartIds[zone.id]).toBe(`${preset.id}:first:${zone.id}`)
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

    expect(markup.indexOf('data-part="page-a:section:title"'))
      .toBeLessThan(markup.indexOf('id="section-copy"'))
    expect(markup).toContain('<div id="page-a-section-card-body" data-part="page-a:section:body"><p id="section-copy">Texte auteur</p></div>')
  })
})
