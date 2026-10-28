import type { RevelationTransitionOverrides } from '../../../revelation/revelation-types'

export type RichTextAttributeValue = string | number | boolean | null

export interface RichTextMark {
  readonly type: string
  readonly attrs?: Readonly<Record<string, RichTextAttributeValue>>
}

export interface RichTextNode {
  readonly type: string
  readonly attrs?: Readonly<Record<string, RichTextAttributeValue>>
  readonly text?: string
  readonly marks?: readonly RichTextMark[]
  readonly content?: readonly RichTextNode[]
}

export interface RichTextDocument {
  readonly type: 'doc'
  readonly content: readonly RichTextNode[]
}

export interface SectionContent {
  readonly title: string
  readonly markup: string
  readonly content: RichTextDocument
  readonly revelation: RevelationTransitionOverrides
}
