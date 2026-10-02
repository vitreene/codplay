import { useEffect, useRef } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import type { Editor, JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Italic,
  Pilcrow,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline,
  type LucideIcon,
} from 'lucide-react'
import { SECTION_EDITOR_HEADING_LEVELS } from '../../config/document-config'
import type { RichTextDocument } from '../../domain/document-types'
import { ELCE_ANCHOR_TRANSACTION_META, createElceAnchorExtension } from './elce-anchor-extension'
import type { ElceAnchorTransaction } from './anchor-types'
import type { SectionEditorProps } from './section-editor-types'

const SECTION_EDITOR_EXTENSIONS = [
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

/** Edits one Section with the POC's bounded rich-text toolbar. */
export function SectionEditor({ bdc, createFileDropTarget, resolveMediaSource, onChange }: SectionEditorProps) {
  const section = bdc.section
  const sectionRef = useRef(section)
  sectionRef.current = section
  const editor = useEditor({
    extensions: [...SECTION_EDITOR_EXTENSIONS, createElceAnchorExtension({ createFileDropTarget, resolveMediaSource })],
    content: toTiptapContent(section?.content ?? emptyDocument()),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: `elce-editor-content-${bdc.id}`,
        class: 'elce-editor-content',
        'data-placeholder': 'Écrire le contenu…',
      },
    },
    onUpdate: ({ editor: currentEditor, transaction }) => {
      const content = currentEditor.getJSON() as RichTextDocument
      const change = readAnchorChange(transaction)
      switch (change?.kind) {
        case 'file-drop':
          onChange({
            kind: 'file-drop',
            file: change.file,
            target: change.target,
            title: sectionRef.current?.title ?? '',
            content,
            markup: currentEditor.getHTML(),
          })
          break
        case 'move':
          onChange({
            kind: 'anchor-move',
            anchorBdcId: change.bdcId,
            title: sectionRef.current?.title ?? '',
            content,
            markup: currentEditor.getHTML(),
          })
          break
        case 'remove':
          onChange({
            kind: 'anchor-remove',
            anchorBdcId: change.bdcId,
            title: sectionRef.current?.title ?? '',
            content,
            markup: currentEditor.getHTML(),
          })
          break
        default:
          onChange({ kind: 'content', title: sectionRef.current?.title ?? '', content, markup: currentEditor.getHTML() })
          break
      }
    },
  })
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => readToolbarState(currentEditor),
  }) ?? EMPTY_TOOLBAR_STATE

  useEffect(() => {
    if (editor === null || section === null) return
    const current = JSON.stringify(editor.getJSON())
    const next = JSON.stringify(section.content)
    if (current !== next) editor.commands.setContent(toTiptapContent(section.content))
  }, [editor, section])

  if (section === null) {
    return <p id={`elce-editor-empty-${bdc.id}`}>Ce bdc n’est pas une Section éditable.</p>
  }

  const run = (command: () => boolean): void => {
    command()
    editor?.commands.focus()
  }

  return (
    <div id={`elce-section-editor-${bdc.id}`} className="elce-section-editor">
      <input
        id={`elce-section-title-${bdc.id}`}
        className="elce-section-title-input"
        aria-label="Titre de section"
        placeholder="Titre (facultatif)"
        value={section.title}
        onChange={(event) => onChange({ kind: 'content', title: event.target.value, content: section.content, markup: section.markup })}
      />
      <div id={`elce-section-toolbar-${bdc.id}`} className="elce-section-toolbar" role="toolbar" aria-label="Mise en forme">
        <ToolbarButton id={`elce-section-bold-${bdc.id}`} label="Gras" icon={Bold} active={toolbarState.bold} onClick={() => run(() => editor?.chain().toggleBold().run() ?? false)} />
        <ToolbarButton id={`elce-section-italic-${bdc.id}`} label="Italique" icon={Italic} active={toolbarState.italic} onClick={() => run(() => editor?.chain().toggleItalic().run() ?? false)} />
        <ToolbarButton id={`elce-section-underline-${bdc.id}`} label="Souligné" icon={Underline} active={toolbarState.underline} onClick={() => run(() => editor?.chain().toggleUnderline().run() ?? false)} />
        <ToolbarButton id={`elce-section-subscript-${bdc.id}`} label="Indice" icon={SubscriptIcon} active={toolbarState.subscript} onClick={() => run(() => editor?.chain().toggleSubscript().run() ?? false)} />
        <ToolbarButton id={`elce-section-superscript-${bdc.id}`} label="Exposant" icon={SuperscriptIcon} active={toolbarState.superscript} onClick={() => run(() => editor?.chain().toggleSuperscript().run() ?? false)} />
        {SECTION_EDITOR_HEADING_LEVELS.map((level) => (
          <ToolbarButton
            id={`elce-section-heading-${level}-${bdc.id}`}
            key={level}
            label={`Titre H${level}`}
            icon={headingIcon(level)}
            active={toolbarState.headingLevel === level}
            onClick={() => run(() => editor?.chain().toggleHeading({ level }).run() ?? false)}
          />
        ))}
        <ToolbarButton id={`elce-section-paragraph-${bdc.id}`} label="Paragraphe" icon={Pilcrow} active={toolbarState.paragraph} onClick={() => run(() => editor?.chain().setParagraph().run() ?? false)} />
        <ToolbarButton id={`elce-section-align-left-${bdc.id}`} label="Aligner à gauche" icon={AlignLeft} active={toolbarState.textAlign === 'left'} onClick={() => run(() => editor?.chain().setTextAlign('left').run() ?? false)} />
        <ToolbarButton id={`elce-section-align-center-${bdc.id}`} label="Centrer" icon={AlignCenter} active={toolbarState.textAlign === 'center'} onClick={() => run(() => editor?.chain().setTextAlign('center').run() ?? false)} />
        <ToolbarButton id={`elce-section-align-right-${bdc.id}`} label="Aligner à droite" icon={AlignRight} active={toolbarState.textAlign === 'right'} onClick={() => run(() => editor?.chain().setTextAlign('right').run() ?? false)} />
        <ToolbarButton id={`elce-section-align-justify-${bdc.id}`} label="Justifier" icon={AlignJustify} active={toolbarState.textAlign === 'justify'} onClick={() => run(() => editor?.chain().setTextAlign('justify').run() ?? false)} />
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

type ToolbarButtonProps = Readonly<{
  readonly id: string
  readonly label: string
  readonly icon: LucideIcon
  readonly active: boolean
  readonly onClick: () => void
}>

/** Renders one compact icon command while retaining an accessible name. */
function ToolbarButton({ id, label, icon: Icon, active, onClick }: ToolbarButtonProps) {
  return (
    <button
      id={id}
      type="button"
      aria-label={label}
      aria-pressed={active}
      data-active={active}
      title={label}
      onClick={onClick}
    >
      <Icon aria-hidden="true" size={15} strokeWidth={2} />
    </button>
  )
}

type ToolbarTextAlign = 'left' | 'center' | 'right' | 'justify'

type ToolbarState = Readonly<{
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly subscript: boolean
  readonly superscript: boolean
  readonly headingLevel: number | null
  readonly paragraph: boolean
  readonly textAlign: ToolbarTextAlign | null
}>

const EMPTY_TOOLBAR_STATE: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  subscript: false,
  superscript: false,
  headingLevel: null,
  paragraph: false,
  textAlign: null,
}

/** Reads every active command from the current Tiptap selection. */
function readToolbarState(editor: Editor | null): ToolbarState {
  if (editor === null) return EMPTY_TOOLBAR_STATE
  const headingLevel = SECTION_EDITOR_HEADING_LEVELS.find((level) => editor.isActive('heading', { level })) ?? null
  const textAlign = readTextAlign(editor)
  return {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    subscript: editor.isActive('subscript'),
    superscript: editor.isActive('superscript'),
    headingLevel,
    paragraph: editor.isActive('paragraph'),
    textAlign,
  }
}

/** Resolves the selected block alignment, treating the default as left. */
function readTextAlign(editor: Editor): ToolbarTextAlign {
  for (const alignment of ['left', 'center', 'right', 'justify'] as const) {
    if (editor.isActive({ textAlign: alignment })) return alignment
  }
  return 'left'
}

/** Selects the Lucide heading glyph matching the requested HTML level. */
function headingIcon(level: (typeof SECTION_EDITOR_HEADING_LEVELS)[number]): LucideIcon {
  switch (level) {
    case 1:
      return Heading1
    case 2:
      return Heading2
    case 3:
      return Heading3
    case 4:
      return Heading4
    case 5:
      return Heading5
    case 6:
      return Heading6
    default:
      return assertNeverHeadingLevel(level)
  }
}

function assertNeverHeadingLevel(value: never): never {
  throw new Error(`Niveau de titre non pris en charge : ${String(value)}`)
}

/** Creates the minimum document accepted by the Section editor. */
function emptyDocument(): RichTextDocument {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

/** Clones Elcé rich-text data into the mutable JSON shape expected by Tiptap. */
function toTiptapContent(content: RichTextDocument): JSONContent {
  return JSON.parse(JSON.stringify(content)) as JSONContent
}

/** Reads the Elcé transaction marker emitted by the anchor interaction plugin. */
function readAnchorChange(transaction: { getMeta: (key: string) => unknown }): ElceAnchorTransaction | null {
  return transaction.getMeta(ELCE_ANCHOR_TRANSACTION_META) as ElceAnchorTransaction | null
}
