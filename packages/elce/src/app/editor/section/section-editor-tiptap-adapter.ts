import { Editor, type EditorEvents } from '@tiptap/core'
import type { RichTextDocument, SectionContent } from '../../../domain/document/document-types'
import type { ElceSectionChange } from '../../../domain/anchor/anchor-types'
import type { ElceAnchorExtensionOptions } from '../anchor/anchor-types'
import {
  EMPTY_SECTION_TOOLBAR_STATE,
  SECTION_EDITOR_EXTENSIONS,
  emptySectionDocument,
  readSectionToolbarState,
  sectionChangeFromTransaction,
  toTiptapContent,
} from './section-editor-tiptap'
import type { SectionToolbarState } from './section-editor-tiptap'
import { createElceAnchorExtension } from '../anchor/elce-anchor-extension'
import type { SectionChangeSelection } from '../../facades/anchor/anchor-drop-facade'
import type { SectionSelection } from '../../history/document-history'
import type { ProfileProperty } from '../../../domain/summary-profile/summary-profile-types'
import { createProfileLabelExtension } from '../profile/profile-label-extension'
import { PROFILE_TOKEN_INSERT_EVENT } from '../profile/profile-token-events'

export interface SectionTiptapAdapterOptions {
  readonly bdcId: string
  readonly section: SectionContent
  readonly profileProperties: readonly ProfileProperty[]
  readonly anchorOptions: ElceAnchorExtensionOptions
  readonly onChange: (change: ElceSectionChange, selection?: SectionChangeSelection) => void
  readonly onToolbarState: (state: SectionToolbarState) => void
}

/** Owns a Tiptap Editor lifecycle while keeping document changes in Elcé commands. */
export class SectionTiptapAdapter {
  public readonly editor: Editor
  private readonly bdcId: string
  private section: SectionContent
  private readonly anchorNodeViewRefreshers = new Set<() => void>()
  private readonly onChange: (change: ElceSectionChange, selection?: SectionChangeSelection) => void
  private readonly onToolbarState: (state: SectionToolbarState) => void
  private lastToolbarState = EMPTY_SECTION_TOOLBAR_STATE
  private beforeSelection: SectionSelection | undefined
  /** Captures the old selection before Tiptap applies an author transaction. */
  private readonly onBeforeTransaction = ({ editor }: EditorEvents['beforeTransaction']): void => {
    this.beforeSelection = {
      sectionBdcId: this.bdcId,
      anchor: editor.state.selection.anchor,
      head: editor.state.selection.head,
    }
  }
  private readonly onUpdate = ({ editor, transaction }: EditorEvents['update']): void => {
    this.onChange(sectionChangeFromTransaction(editor, transaction, this.section.title), {
      before: this.beforeSelection,
      after: {
        sectionBdcId: this.bdcId,
        anchor: editor.state.selection.anchor,
        head: editor.state.selection.head,
      },
    })
  }
  private readonly onTransaction = ({ editor }: EditorEvents['transaction']): void => {
    const next = readSectionToolbarState(editor)
    if (sameToolbarState(this.lastToolbarState, next)) return
    this.lastToolbarState = next
    this.onToolbarState(next)
  }
  /** Routes the shared profile-variable control into this rich-text selection. */
  private readonly onProfileTokenInsert = (event: Event): void => {
    const propertyId = (event as CustomEvent<{ propertyId?: unknown }>).detail?.propertyId
    if (typeof propertyId === 'string') this.insertProfileLabel(propertyId)
  }

  public constructor(host: HTMLElement, options: SectionTiptapAdapterOptions) {
    this.bdcId = options.bdcId
    this.section = options.section
    this.onChange = options.onChange
    this.onToolbarState = options.onToolbarState
    this.editor = new Editor({
      element: null,
      extensions: [
        ...SECTION_EDITOR_EXTENSIONS,
        createProfileLabelExtension(options.profileProperties),
        createElceAnchorExtension({
          ...options.anchorOptions,
          registerNodeViewRefresh: (_bdcId, refresh) => {
            this.anchorNodeViewRefreshers.add(refresh)
            return () => this.anchorNodeViewRefreshers.delete(refresh)
          },
        }),
      ],
      content: toTiptapContent(options.section.content ?? emptySectionDocument()),
      editorProps: {
        attributes: {
          id: `elce-editor-content-${options.bdcId}`,
          class: 'elce-editor-content',
          'data-placeholder': 'Écrire le contenu…',
          'data-elce-profile-token-target': 'true',
        },
      },
    })
    this.editor.on('beforeTransaction', this.onBeforeTransaction)
    this.editor.on('update', this.onUpdate)
    this.editor.on('transaction', this.onTransaction)
    this.editor.mount(host)
    this.editor.view.dom.addEventListener(PROFILE_TOKEN_INSERT_EVENT, this.onProfileTokenInsert)
    this.lastToolbarState = readSectionToolbarState(this.editor)
    this.onToolbarState(this.lastToolbarState)
  }

  /** Reconciles a controller snapshot without treating it as a new author edit. */
  public updateSection(section: SectionContent): void {
    this.section = section
    const current = JSON.stringify(this.editor.getJSON())
    const next = JSON.stringify(section.content)
    if (current !== next) this.editor.commands.setContent(toTiptapContent(section.content), { emitUpdate: false })
    this.refreshAnchorNodeViews()
  }

  /** Saves a title edit together with the current rich JSON and exported markup. */
  public updateTitle(title: string): void {
    this.onChange({
      kind: 'content',
      title,
      content: this.editor.getJSON() as RichTextDocument,
      markup: this.editor.getHTML(),
    })
  }

  /** Inserts a stable profile-property label at the active rich-text selection. */
  public insertProfileLabel(propertyId: string): void {
    this.editor.chain().focus().insertContent({
      type: 'profileLabel',
      attrs: { profilePropertyId: propertyId },
    }).run()
  }

  /** Restores the caret or range from one global document-history position. */
  public restoreSelection(selection: SectionSelection): void {
    const max = this.editor.state.doc.content.size
    const from = Math.max(0, Math.min(max, Math.min(selection.anchor, selection.head)))
    const to = Math.max(0, Math.min(max, Math.max(selection.anchor, selection.head)))
    this.editor.commands.setTextSelection({ from, to })
    this.editor.commands.focus()
  }

  /** Unsubscribes from Tiptap and destroys its ProseMirror view. */
  public destroy(): void {
    this.editor.off('beforeTransaction', this.onBeforeTransaction)
    this.editor.off('update', this.onUpdate)
    this.editor.off('transaction', this.onTransaction)
    this.editor.view.dom.removeEventListener(PROFILE_TOKEN_INSERT_EVENT, this.onProfileTokenInsert)
    this.anchorNodeViewRefreshers.clear()
    this.editor.destroy()
  }

  /** Refreshes anchor previews when referenced media resolves without a text edit. */
  private refreshAnchorNodeViews(): void {
    for (const refresh of this.anchorNodeViewRefreshers) refresh()
  }
}

/** Compares the finite toolbar state without allocating a reactive store. */
function sameToolbarState(left: SectionToolbarState, right: SectionToolbarState): boolean {
  return left.bold === right.bold
    && left.italic === right.italic
    && left.underline === right.underline
    && left.subscript === right.subscript
    && left.superscript === right.superscript
    && left.headingLevel === right.headingLevel
    && left.paragraph === right.paragraph
    && left.textAlign === right.textAlign
}
