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

/** Stores ordinary strings or promoted structured text without interpreting its nodes. */
export type AuthoredTextValue = string | RichTextDocument
