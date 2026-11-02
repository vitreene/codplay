import type { RichTextDocument } from './section-types'

/** Creates the minimum rich-text document accepted by a Section. */
export function createEmptyRichTextDocument(): RichTextDocument {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}
