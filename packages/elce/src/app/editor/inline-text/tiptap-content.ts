import type { JSONContent } from '@tiptap/core'
import type { RichTextDocument } from '../../../domain/document/document-types'

/** Clones immutable Elcé rich text into the mutable JSON shape Tiptap accepts. */
export function toTiptapContent(document: RichTextDocument): JSONContent {
  return JSON.parse(JSON.stringify(document)) as JSONContent
}
