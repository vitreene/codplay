import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
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
  Trash2,
  Underline,
  X,
  type LucideIcon,
} from 'lucide-react'
import { SECTION_EDITOR_HEADING_LEVELS } from '../../../config/document-config'
import { createElceAnchorExtension } from '../anchor/elce-anchor-extension'
import type { SectionEditorProps } from './section-editor-types'
import { CardBdcEditorFields } from '../card/card-editor-fields'
import {
  EMPTY_SECTION_TOOLBAR_STATE,
  SECTION_EDITOR_EXTENSIONS,
  emptySectionDocument,
  readSectionToolbarState,
  sectionChangeFromTransaction,
  toTiptapContent,
} from './section-editor-tiptap'

/** Edits one Section with the POC's bounded rich-text toolbar. */
export function SectionEditor({ bdc, onDelete, createFileDropTarget, createCatalogDropTarget, resolveCard, anchorCards = [], mediaById = {}, cardActions, onChange }: SectionEditorProps) {
  const section = bdc.section
  const [editingAnchorBdcId, setEditingAnchorBdcId] = useState<string | null>(null)
  const sectionRef = useRef(section)
  sectionRef.current = section
  const editor = useEditor({
    extensions: [...SECTION_EDITOR_EXTENSIONS, createElceAnchorExtension({
      createFileDropTarget,
      createCatalogDropTarget,
      resolveCard,
      onEditCard: setEditingAnchorBdcId,
    })],
    content: toTiptapContent(section?.content ?? emptySectionDocument()),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: `elce-editor-content-${bdc.id}`,
        class: 'elce-editor-content',
        'data-placeholder': 'Écrire le contenu…',
      },
    },
    onUpdate: ({ editor: currentEditor, transaction }) => {
      onChange(sectionChangeFromTransaction(currentEditor, transaction, sectionRef.current?.title ?? ''))
    },
  })
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor === null ? EMPTY_SECTION_TOOLBAR_STATE : readSectionToolbarState(currentEditor),
  }) ?? EMPTY_SECTION_TOOLBAR_STATE
  const editingAnchorBdc = anchorCards.find((card) => card.id === editingAnchorBdcId)

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
      <div id={`elce-section-heading-${bdc.id}`} className="elce-section-heading">
        <input
          id={`elce-section-title-${bdc.id}`}
          className="elce-section-title-input"
          aria-label="Titre de section"
          placeholder="Titre (facultatif)"
          value={section.title}
          onChange={(event) => onChange({ kind: 'content', title: event.target.value, content: section.content, markup: section.markup })}
        />
        <button
          id={`elce-section-delete-${bdc.id}`}
          className="elce-bdc-icon-button elce-bdc-icon-button--danger"
          type="button"
          aria-label="Supprimer le bloc texte"
          title="Supprimer le bloc texte"
          onClick={onDelete}
        ><Trash2 aria-hidden="true" size={16} /></button>
      </div>
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
      {editingAnchorBdc !== undefined && cardActions !== undefined && (
        <section id={`elce-anchor-card-editor-${editingAnchorBdc.id}`} className="elce-anchor-card-editor" aria-label="Modifier la carte ancrée">
          <header id={`elce-anchor-card-editor-header-${editingAnchorBdc.id}`} className="elce-anchor-card-editor__header">
            <h3 id={`elce-anchor-card-editor-title-${editingAnchorBdc.id}`}>Carte</h3>
            <button
              id={`elce-anchor-card-editor-close-${editingAnchorBdc.id}`}
              className="elce-bdc-icon-button"
              type="button"
              aria-label="Fermer l’édition de la carte"
              title="Fermer"
              onClick={() => setEditingAnchorBdcId(null)}
            ><X aria-hidden="true" size={14} /></button>
          </header>
          <CardBdcEditorFields
            bdc={editingAnchorBdc}
            mediaById={mediaById}
            actions={cardActions}
            idPrefix="elce-anchor-card"
            imageAspectRatio={null}
          />
        </section>
      )}
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

/** Rejects an unsupported heading level exhaustively. */
function assertNeverHeadingLevel(value: never): never {
  throw new Error(`Niveau de titre non pris en charge : ${String(value)}`)
}
