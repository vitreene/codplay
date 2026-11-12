import { describe, expect, it } from 'vitest'
import type { RichTextDocument } from '../../../core/document/rich-text-types'
import { authoredTextToPlainText } from '../../../core/document/rich-text-utils'
import { createLearningTextFieldFeature } from './learning-inline-text-field'
import { plainTextFromValue } from './learning-inline-text-value'

describe('Learning rich-text projection', () => {
  it('keeps the Learning labels when projecting a rich value into resource fields', () => {
    const value: RichTextDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Profil : ' },
            { type: 'profileLabel', attrs: { profilePropertyId: 'audience' } },
            { type: 'text', text: ' · ' },
            { type: 'pageLinkLabel', attrs: { pageId: 'page-next', label: null, fallbackLabel: 'Étape suivante' } },
            { type: 'text', text: ' · ' },
            { type: 'localDateLabel', attrs: { kind: 'today', offsetDays: 0 } },
            { type: 'text', text: ' · ' },
            { type: 'localDateLabel', attrs: { kind: 'relative', offsetDays: -2 } },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Suite.' }] },
      ],
    }

    expect(plainTextFromValue(value)).toBe('Profil : {{profile:audience}} · Étape suivante · Date du jour · Il y a 2 j\nSuite.')
    expect(createLearningTextFieldFeature().toPlainText(value)).toBe(plainTextFromValue(value))
  })

  it('keeps the resource default projection neutral and fallback-based', () => {
    const value: RichTextDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [
        { type: 'profileLabel', attrs: { profilePropertyId: 'audience', fallbackLabel: 'Public' } },
        { type: 'text', text: ' · ' },
        { type: 'pageLinkLabel', attrs: { pageId: 'page-next', fallbackLabel: 'Étape suivante' } },
        { type: 'text', text: ' · ' },
        { type: 'localDateLabel', attrs: { kind: 'today', offsetDays: 0 } },
      ] }],
    }

    expect(authoredTextToPlainText(value)).toBe('Public · Étape suivante · Date locale')
  })
})
