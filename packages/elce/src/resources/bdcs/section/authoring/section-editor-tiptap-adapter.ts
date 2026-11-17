import { Editor, type EditorEvents } from '@tiptap/core'
import { DOMSerializer } from '@tiptap/pm/model'
import { ANCHOR } from '../../../anchoring/anchor-config'
import type { RichTextDocument, SectionContent } from '../domain/section-types'
import type { ElceSectionChange } from '../../../anchoring/domain/anchor-types'
import type { ElceAnchorExtensionOptions } from '../../../anchoring/authoring/anchor-types'
import type { CardAnchorSide, CardAnchorWidth } from '../../../anchoring/card-placement/card-anchor-placement'
import {
  EMPTY_SECTION_TOOLBAR_STATE,
  SECTION_EDITOR_EXTENSIONS,
  emptySectionDocument,
  readSectionToolbarState,
  sectionChangeFromTransaction,
  toTiptapContent,
} from './section-editor-tiptap'
import type { SectionToolbarState } from './section-editor-tiptap'
import { createElceAnchorExtension } from '../../../anchoring/authoring/elce-anchor-extension'
import type { SectionChangeSelection } from '../../../anchoring/authoring/anchor-drop-facade'
import type { SectionSelection } from './section-selection-types'
import type { ElceTextValue } from '../../../document/rich-text-types'
import type { ListContent } from '../../../list/domain/list-types'
import { createListBdcReferenceNode } from '../../../list/authoring/list-bdc-extension'
import { ListService } from '../../../list/domain/list-service'
import { createStableId } from '../../../../core/document/stable-id'

export interface SectionTextFeature {
  readonly extensions: Editor['options']['extensions']
  readonly attributes: Readonly<Record<string, string>>
  readonly onInsertListBdc?: (bdcId: string, content: RichTextDocument, markup: string, list: ListContent) => void
  readonly onUpdateListBdc?: (bdcId: string, list: ListContent) => void
  attach(editor: Editor): () => void
}

export interface SectionTiptapAdapterOptions {
  readonly bdcId: string
  readonly section: SectionContent
  readonly editingAnchorCardId?: string | null
  readonly textFeature?: SectionTextFeature
  readonly listBdcContents?: ReadonlyMap<string, ListContent>
  readonly anchorOptions?: ElceAnchorExtensionOptions
  readonly onChange: (change: ElceSectionChange, selection?: SectionChangeSelection) => void
  readonly onToolbarState: (state: SectionToolbarState) => void
}

/** Owns a Tiptap Editor lifecycle while keeping document changes in Elcé commands. */
export class SectionTiptapAdapter {
  public readonly editor: Editor
  private readonly bdcId: string
  private section: SectionContent
  private readonly anchorNodeViewRefreshers = new Set<() => void>()
  private readonly listNodeViewRefreshers = new Set<() => void>()
  private readonly listBdcContents = new Map<string, ListContent>()
  private readonly onChange: (change: ElceSectionChange, selection?: SectionChangeSelection) => void
  private readonly onToolbarState: (state: SectionToolbarState) => void
  private readonly textFeature: SectionTextFeature | undefined
  private readonly detachTextFeature: () => void
  private lastToolbarState = EMPTY_SECTION_TOOLBAR_STATE
  private beforeSelection: SectionSelection | undefined
  private editingAnchorCardId: string | null = null
  private editingAnchorCardBlockSize: number | null = null
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
  public constructor(host: HTMLElement, options: SectionTiptapAdapterOptions) {
    this.bdcId = options.bdcId
    this.section = options.section
    this.editingAnchorCardId = options.editingAnchorCardId ?? null
    this.onChange = options.onChange
    this.onToolbarState = options.onToolbarState
    this.textFeature = options.textFeature
    this.updateListBdcContents(options.listBdcContents ?? new Map())
    const anchorExtensions = options.anchorOptions === undefined ? [] : [createElceAnchorExtension({
      ...options.anchorOptions,
      getEditingAnchorCardState: (bdcId) => this.editingAnchorCardId === bdcId
        ? { blockSize: this.editingAnchorCardBlockSize }
        : null,
      registerNodeViewRefresh: (_bdcId, refresh) => {
        this.anchorNodeViewRefreshers.add(refresh)
        return () => this.anchorNodeViewRefreshers.delete(refresh)
      },
    })]
    this.editor = new Editor({
      element: null,
      extensions: [
        ...SECTION_EDITOR_EXTENSIONS,
        ...(options.textFeature?.extensions ?? []),
        ...(options.textFeature?.onInsertListBdc === undefined || options.textFeature.onUpdateListBdc === undefined ? [] : [createListBdcReferenceNode({
          getListContent: (listBdcId) => this.listBdcContents.get(listBdcId) ?? null,
          onUpdateList: (listBdcId, list) => this.textFeature?.onUpdateListBdc?.(listBdcId, list),
          createRowId: () => createStableId('list-row'),
          registerNodeViewRefresh: (refresh) => {
            this.listNodeViewRefreshers.add(refresh)
            return () => this.listNodeViewRefreshers.delete(refresh)
          },
        })]),
        ...anchorExtensions,
      ],
      content: toTiptapContent(options.section.content ?? emptySectionDocument()),
      editorProps: {
        attributes: {
          id: `elce-editor-content-${options.bdcId}`,
          class: 'elce-editor-content',
          'data-placeholder': 'Écrire le contenu…',
          ...options.textFeature?.attributes,
        },
      },
    })
    this.editor.on('beforeTransaction', this.onBeforeTransaction)
    this.editor.on('update', this.onUpdate)
    this.editor.on('transaction', this.onTransaction)
    this.editor.mount(host)
    this.detachTextFeature = options.textFeature?.attach(this.editor) ?? (() => undefined)
    this.lastToolbarState = readSectionToolbarState(this.editor)
    this.onToolbarState(this.lastToolbarState)
  }

  /** Reconciles a controller snapshot without treating it as a new author edit. */
  public updateSection(section: SectionContent, listBdcContents: ReadonlyMap<string, ListContent> = new Map()): void {
    this.section = section
    this.updateListBdcContents(listBdcContents)
    const current = JSON.stringify(this.editor.getJSON())
    const next = JSON.stringify(section.content)
    if (current !== next) this.editor.commands.setContent(toTiptapContent(section.content), { emitUpdate: false })
    this.refreshAnchorNodeViews()
  }

  /** Supplies the latest child payloads to inline List NodeViews. */
  public updateListBdcContents(contents: ReadonlyMap<string, ListContent>): void {
    this.listBdcContents.clear()
    for (const [bdcId, list] of contents) this.listBdcContents.set(bdcId, list)
    for (const refresh of this.listNodeViewRefreshers) refresh()
  }

  /** Saves a title edit together with the current rich JSON and exported markup. */
  public updateTitle(title: ElceTextValue): void {
    this.onChange({
      kind: 'content',
      title,
      content: this.editor.getJSON() as RichTextDocument,
      markup: this.editor.getHTML(),
    })
  }

  /** Inserts a List BDC after the current Section text block through the Learning command. */
  public insertListBdc(): void {
    const onInsertListBdc = this.textFeature?.onInsertListBdc
    if (onInsertListBdc === undefined) return
    const bdcId = createStableId('bdc-list')
    const rowId = createStableId('list-row')
    const list = new ListService().createDefault(rowId)
    const { state } = this.editor
    const position = state.selection.$from.depth > 0 ? state.selection.$from.after(1) : state.selection.to
    const node = this.editor.schema.nodes.listBdc?.create({ bdcId })
    if (node === undefined) return
    let transaction = state.tr.insert(position, node)
    if (position === state.doc.content.size) {
      const paragraph = this.editor.schema.nodes.paragraph?.create()
      if (paragraph !== undefined) transaction = transaction.insert(position + node.nodeSize, paragraph)
    }
    const content = transaction.doc.toJSON() as RichTextDocument
    const container = this.editor.view.dom.ownerDocument.createElement('div')
    container.append(DOMSerializer.fromSchema(this.editor.schema).serializeFragment(transaction.doc.content))
    onInsertListBdc(bdcId, content, container.innerHTML, list)
  }

  /** Updates placement attributes on one existing Card anchor through normal Section edits. */
  public updateAnchorPlacement(bdcId: string, width: CardAnchorWidth, side: CardAnchorSide): void {
    const { state } = this.editor
    let position: number | null = null
    state.doc.descendants((node, nodePosition) => {
      if (node.type.name !== ANCHOR.NODE_NAME || node.attrs.bdcId !== bdcId) return
      position = nodePosition
      return false
    })
    if (position === null) return
    const currentNode = state.doc.nodeAt(position)
    if (currentNode === null) return
    if (currentNode.attrs.placementWidth === width && currentNode.attrs.placementSide === side) return
    this.editor.view.dispatch(state.tr.setNodeMarkup(position, undefined, {
      ...currentNode.attrs,
      placementWidth: width,
      placementSide: side,
    }))
  }

  /** Temporarily gives one selected Card anchor the measured edit-panel footprint. */
  public setEditingAnchorCard(bdcId: string | null, blockSize: number | null = null): void {
    if (this.editingAnchorCardId === bdcId && this.editingAnchorCardBlockSize === blockSize) return
    this.editingAnchorCardId = bdcId
    this.editingAnchorCardBlockSize = bdcId === null ? null : blockSize
    this.refreshAnchorNodeViews()
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
    this.detachTextFeature()
    this.anchorNodeViewRefreshers.clear()
    this.listNodeViewRefreshers.clear()
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
    && left.dotLeader === right.dotLeader
    && left.textAlign === right.textAlign
}
