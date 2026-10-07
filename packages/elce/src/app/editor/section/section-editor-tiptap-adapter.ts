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

export interface SectionTiptapAdapterOptions {
  readonly bdcId: string
  readonly section: SectionContent
  readonly anchorOptions: ElceAnchorExtensionOptions
  readonly onChange: (change: ElceSectionChange) => void
  readonly onToolbarState: (state: SectionToolbarState) => void
}

/** Owns a Tiptap Editor lifecycle while keeping document changes in Elcé commands. */
export class SectionTiptapAdapter {
  public readonly editor: Editor
  private section: SectionContent
  private readonly anchorNodeViewRefreshers = new Set<() => void>()
  private readonly onChange: (change: ElceSectionChange) => void
  private readonly onToolbarState: (state: SectionToolbarState) => void
  private lastToolbarState = EMPTY_SECTION_TOOLBAR_STATE
  private readonly onUpdate = ({ editor, transaction }: EditorEvents['update']): void => {
    this.onChange(sectionChangeFromTransaction(editor, transaction, this.section.title))
  }
  private readonly onTransaction = ({ editor }: EditorEvents['transaction']): void => {
    const next = readSectionToolbarState(editor)
    if (sameToolbarState(this.lastToolbarState, next)) return
    this.lastToolbarState = next
    this.onToolbarState(next)
  }

  public constructor(host: HTMLElement, options: SectionTiptapAdapterOptions) {
    this.section = options.section
    this.onChange = options.onChange
    this.onToolbarState = options.onToolbarState
    this.editor = new Editor({
      element: null,
      extensions: [
        ...SECTION_EDITOR_EXTENSIONS,
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
        },
      },
    })
    this.editor.on('update', this.onUpdate)
    this.editor.on('transaction', this.onTransaction)
    this.editor.mount(host)
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

  /** Unsubscribes from Tiptap and destroys its ProseMirror view. */
  public destroy(): void {
    this.editor.off('update', this.onUpdate)
    this.editor.off('transaction', this.onTransaction)
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
