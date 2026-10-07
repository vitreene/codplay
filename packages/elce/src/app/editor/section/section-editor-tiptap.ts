import { Editor, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { SECTION_EDITOR_HEADING_LEVELS } from '../../../config/document-config'
import type { RichTextDocument } from '../../../domain/document/document-types'
import type { ElceSectionChange } from '../../../domain/anchor/anchor-types'
import { ELCE_ANCHOR_TRANSACTION_META } from '../anchor/elce-anchor-extension'
import type { ElceAnchorTransaction } from '../anchor/anchor-types'

export type SectionToolbarTextAlign = 'left' | 'center' | 'right' | 'justify'

export type SectionToolbarState = Readonly<{
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly subscript: boolean
  readonly superscript: boolean
  readonly headingLevel: number | null
  readonly paragraph: boolean
  readonly textAlign: SectionToolbarTextAlign | null
}>

export const EMPTY_SECTION_TOOLBAR_STATE: SectionToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  subscript: false,
  superscript: false,
  headingLevel: null,
  paragraph: false,
  textAlign: null,
}

export const SECTION_EDITOR_EXTENSIONS = [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    dropcursor: false,
    gapcursor: false,
    hardBreak: false,
    heading: { levels: [...SECTION_EDITOR_HEADING_LEVELS] },
    horizontalRule: false,
    link: false,
    listItem: false,
    listKeymap: false,
    orderedList: false,
    strike: false,
    trailingNode: false,
    undoRedo: false,
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Subscript,
  Superscript,
]

/** Creates the minimum rich-text document accepted by a Section. */
export function emptySectionDocument(): RichTextDocument {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

/** Clones Section data into the mutable JSON shape expected by Tiptap. */
export function toTiptapContent(content: RichTextDocument): JSONContent {
  return JSON.parse(JSON.stringify(content)) as JSONContent
}

/** Reads the transaction marker emitted by the anchor interaction plugin. */
export function readAnchorChange(transaction: { getMeta: (key: string) => unknown }): ElceAnchorTransaction | null {
  return transaction.getMeta(ELCE_ANCHOR_TRANSACTION_META) as ElceAnchorTransaction | null
}

/** Converts one Tiptap update into the existing typed Section change. */
export function sectionChangeFromTransaction(editor: Editor, transaction: { getMeta: (key: string) => unknown }, title: string): ElceSectionChange {
  const content = editor.getJSON() as RichTextDocument
  const markup = editor.getHTML()
  const anchorChange = readAnchorChange(transaction)

  switch (anchorChange?.kind) {
    case 'file-drop':
      return { kind: 'file-drop', file: anchorChange.file, target: anchorChange.target, title, content, markup }
    case 'catalog-drop':
      return { kind: 'catalog-drop', target: anchorChange.target, title, content, markup }
    case 'move':
      return { kind: 'anchor-move', anchorBdcId: anchorChange.bdcId, title, content, markup }
    case 'remove':
      return { kind: 'anchor-remove', anchorBdcId: anchorChange.bdcId, title, content, markup }
    case 'return':
      return { kind: 'anchor-return', anchorBdcId: anchorChange.bdcId, title, content, markup }
    default:
      return { kind: 'content', title, content, markup }
  }
}

/** Reads every active toolbar command from the current Tiptap selection. */
export function readSectionToolbarState(editor: Editor): SectionToolbarState {
  const headingLevel = SECTION_EDITOR_HEADING_LEVELS.find((level) => editor.isActive('heading', { level })) ?? null
  return {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    subscript: editor.isActive('subscript'),
    superscript: editor.isActive('superscript'),
    headingLevel,
    paragraph: editor.isActive('paragraph'),
    textAlign: readSectionTextAlign(editor),
  }
}

/** Resolves the selected block alignment, treating the default as left. */
function readSectionTextAlign(editor: Editor): SectionToolbarTextAlign {
  for (const alignment of ['left', 'center', 'right', 'justify'] as const) {
    if (editor.isActive({ textAlign: alignment })) return alignment
  }
  return 'left'
}
