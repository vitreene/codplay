import { describe, expect, it } from 'vitest'
import type { CardPreset } from './card-preset-types'
import { ElceCardPresetBuilder } from './card-preset-builder'

const testPreset: CardPreset = {
  id: 'test-card',
  label: 'Test card',
  rootClassName: 'test-card',
  allowedContent: ['text'],
  markupTemplate: [
    '<article id="{{rootId}}" class="{{rootClassName}}">',
    '<!-- data-part="{{partPrefix}}:body" -->{{content:body}}</article>',
  ].join(''),
  zones: [{ id: 'body', label: 'Body', required: true, content: 'text', className: 'test-card__body' }],
}

describe('ElceCardPresetBuilder', () => {
  it('builds from an injected preset without loading the application registry', () => {
    const builder = new ElceCardPresetBuilder({ [testPreset.id]: testPreset })

    expect(builder.build('test-card', 'section-1', 'section-1:card', { body: '<p id="copy-1">Hello</p>' })).toEqual({
      markup: [
        '<article id="section-1" class="test-card">',
        '<!-- data-part="section-1:card:body" -->',
        '<p id="copy-1">Hello</p></article>',
      ].join(''),
      rootClassName: 'test-card',
      zonePartIds: { body: 'section-1:card:body' },
      zoneClassNames: { body: 'test-card__body' },
    })
  })

  it('rejects a preset that is absent from the injected registry', () => {
    const builder = new ElceCardPresetBuilder({ [testPreset.id]: testPreset })

    expect(() => builder.build('unknown-card', 'section-1', 'section-1:card'))
      .toThrow('Preset de carte inconnu : unknown-card')
    expect(builder.getPreset('unknown-card')).toBeUndefined()
    expect(builder.getPreset(testPreset.id)).toBe(testPreset)
  })
})
