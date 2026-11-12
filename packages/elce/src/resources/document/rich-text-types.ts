export type { AuthoredTextValue, RichTextAttributeValue, RichTextDocument, RichTextMark, RichTextNode } from '../../core/document/rich-text-types'
import type { AuthoredTextValue } from '../../core/document/rich-text-types'

/** Keeps ordinary Elcé text simple while allowing the Learning editor to promote it. */
export type ElceTextValue = AuthoredTextValue
