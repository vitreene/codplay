import type { RevelationTransitionOverrides } from '../../../revelation/revelation-types'
import type { ElceTextValue, RichTextDocument } from '../../../document/rich-text-types'

export type { ElceTextValue, RichTextAttributeValue, RichTextDocument, RichTextMark, RichTextNode } from '../../../document/rich-text-types'

export interface SectionContent {
  readonly title: ElceTextValue
  readonly markup: string
  readonly content: RichTextDocument
  readonly revelation: RevelationTransitionOverrides
}
