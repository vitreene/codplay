import { Node as TiptapNode, mergeAttributes } from '@tiptap/core'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import { dropPoint } from '@tiptap/pm/transform'
import { Slice, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { createRoot } from 'remix/component'
import type { ListContent } from '../domain/list-types'
import { renderListEditor, renderListView } from './list-editor'

const LIST_BDC_NODE_NAME = 'listBdc'
const LIST_BDC_DRAG_MIME_TYPE = 'application/x-elce-list-bdc'
const LIST_BDC_DRAG_HANDLE_SELECTOR = '.elce-list-bdc-drag-handle'
const LIST_BDC_PLUGIN_KEY = new PluginKey('listBdcMovement')

export interface ListBdcReferenceNodeOptions {
  readonly getListContent: (bdcId: string) => ListContent | null
  readonly onUpdateList: (bdcId: string, list: ListContent) => void
  readonly createRowId: () => string
  readonly registerNodeViewRefresh?: (refresh: () => void) => () => void
}

/** Creates the atomic block reference and mounts its shared editor in the text flow. */
export function createListBdcReferenceNode(options: ListBdcReferenceNodeOptions) {
  return TiptapNode.create({
    name: LIST_BDC_NODE_NAME,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,

    addNodeView() {
      return ({ node, view, getPos }) => {
        let currentNode = node
        let mode: 'view' | 'edit' = 'view'
        /** Reads the stable owner BDC ID from the current ProseMirror node. */
        const bdcId = (): string => String(currentNode.attrs.bdcId ?? '')
        const dom = document.createElement('div')
        dom.className = 'elce-list-bdc-node-view'
        dom.contentEditable = 'false'
        dom.setAttribute('role', 'group')
        dom.setAttribute('aria-label', 'Liste à points')
        const root = createRoot(dom)
        /** Selects the whole List node before ProseMirror starts its native drag. */
        const selectListForDrag = (event: DragEvent): void => {
          if (!(event.target instanceof Element) || event.target.closest(LIST_BDC_DRAG_HANDLE_SELECTOR) === null) return
          const position = getPos()
          if (typeof position !== 'number') return
          const draggedNode = view.state.doc.nodeAt(position)
          if (draggedNode?.type.name !== LIST_BDC_NODE_NAME) return
          view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, position)))
        }
        dom.addEventListener('dragstart', selectListForDrag, true)
        /** Renders the shared List controls from the latest document payload. */
        const render = (): void => {
          const currentBdcId = bdcId()
          const list = options.getListContent(currentBdcId)
          if (list === null) {
            root.render(null)
            root.flush()
            return
          }
          const idPrefix = `elce-list-inline-${currentBdcId}`
          root.render(mode === 'view'
            ? renderListView(list, idPrefix, () => {
              mode = 'edit'
              render()
            })
            : renderListEditor({
              list,
              idPrefix,
              createId: options.createRowId,
              onChange: (next) => options.onUpdateList(currentBdcId, next),
              onShowView: () => {
                mode = 'view'
                render()
              },
            }))
          root.flush()
        }
        const unregisterRefresh = options.registerNodeViewRefresh?.(render)
        render()
        return {
          dom,
          update: (updatedNode) => {
            if (updatedNode.type.name !== LIST_BDC_NODE_NAME) return false
            currentNode = updatedNode
            render()
            return true
          },
          stopEvent: (event) => {
            if (!(event.target instanceof Element) || !dom.contains(event.target)) return false
            if (event.target.closest(LIST_BDC_DRAG_HANDLE_SELECTOR) !== null && (event.type === 'dragstart' || event.type === 'dragend')) return false
            if ((event.type === 'dragenter' || event.type === 'dragover' || event.type === 'drop')
              && carriesListBdcDrag((event as DragEvent).dataTransfer)) return false
            return true
          },
          ignoreMutation: () => true,
          destroy: () => {
            dom.removeEventListener('dragstart', selectListForDrag, true)
            unregisterRefresh?.()
            root.dispose()
          },
        }
      }
    },

    /** Persists the referenced BDC identity in the rich-text JSON. */
    addAttributes() {
      return { bdcId: { default: null } }
    },

    /** Recognizes the editor marker when a rich-text field is read back as HTML. */
    parseHTML() {
      return [{ tag: 'div[data-elce-list-bdc]' }]
    },

    /** Projects one selectable technical placeholder in the rich-text editor. */
    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes(HTMLAttributes, {
        'data-elce-list-bdc': '',
        class: 'elce-list-bdc-reference',
        contenteditable: 'false',
      }), 'Liste à points']
    },

    addProseMirrorPlugins() {
      let draggedListPosition: number | null = null
      return [new Plugin({
        key: LIST_BDC_PLUGIN_KEY,
        props: {
          handleDOMEvents: {
            dragstart: (view) => {
              draggedListPosition = readSelectedListPosition(view)
              return false
            },
            dragend: () => {
              draggedListPosition = null
              return false
            },
          },
          handleDrop: (view, event, slice, moved) => {
            if (!sliceContainsListBdc(slice)) return false
            if (!moved) return true
            const sourcePosition = draggedListPosition ?? readSelectedListPosition(view)
            const sourceNode = sourcePosition === null ? null : view.state.doc.nodeAt(sourcePosition)
            const draggedBdcId = (event as DragEvent).dataTransfer?.getData(LIST_BDC_DRAG_MIME_TYPE)
            if (sourcePosition === null || sourceNode?.type.name !== LIST_BDC_NODE_NAME
              || draggedBdcId !== String(sourceNode.attrs.bdcId ?? '')) return true
            moveDroppedListBdc(view, event as DragEvent, slice, sourcePosition, sourceNode)
            draggedListPosition = null
            return true
          },
        },
        view: (view) => {
          /** Restores List identity after ProseMirror serializes the native drag slice. */
          const writeListDragReference = (event: Event): void => {
            const sourcePosition = draggedListPosition
            const sourceNode = sourcePosition === null ? null : view.state.doc.nodeAt(sourcePosition)
            const dataTransfer = (event as DragEvent).dataTransfer
            if (sourceNode?.type.name !== LIST_BDC_NODE_NAME || dataTransfer === null) return
            dataTransfer.setData(LIST_BDC_DRAG_MIME_TYPE, String(sourceNode.attrs.bdcId ?? ''))
          }
          view.dom.ownerDocument.addEventListener('dragstart', writeListDragReference)
          return { destroy: () => view.dom.ownerDocument.removeEventListener('dragstart', writeListDragReference) }
        },
      })]
    },
  })
}

/** Checks whether a drag event carries the private identity of a List BDC. */
function carriesListBdcDrag(dataTransfer: DataTransfer | null): boolean {
  return Array.from(dataTransfer?.types ?? []).includes(LIST_BDC_DRAG_MIME_TYPE)
}

/** Reads the selected List node position for native drag handling. */
function readSelectedListPosition(view: EditorView): number | null {
  const selection = view.state.selection
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== LIST_BDC_NODE_NAME) return null
  return selection.from
}

/** Checks whether a dragged ProseMirror slice contains a List reference. */
function sliceContainsListBdc(slice: Slice): boolean {
  let found = false
  slice.content.descendants((node) => {
    if (node.type.name === LIST_BDC_NODE_NAME) found = true
  })
  return found
}

/** Moves one List reference after the paragraph under the drop point. */
function moveDroppedListBdc(
  view: EditorView,
  event: DragEvent,
  slice: Slice,
  sourcePosition: number,
  sourceNode: ProseMirrorNode,
): void {
  const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (coordinates === null) return
  const resolvedPosition = view.state.doc.resolve(coordinates.pos)
  const textblockDepth = Array.from({ length: resolvedPosition.depth }, (_, index) => resolvedPosition.depth - index)
    .find((depth) => resolvedPosition.node(depth).isTextblock)
  const requestedPosition = textblockDepth === undefined ? coordinates.pos : resolvedPosition.after(textblockDepth)
  const insertPosition = dropPoint(view.state.doc, requestedPosition, slice)
  if (insertPosition === null) return
  const sourceEnd = sourcePosition + sourceNode.nodeSize
  if (insertPosition >= sourcePosition && insertPosition <= sourceEnd) return
  const transaction = view.state.tr.delete(sourcePosition, sourceEnd)
  const mappedPosition = transaction.mapping.map(insertPosition)
  transaction
    .replaceRangeWith(mappedPosition, mappedPosition, sourceNode)
    .setSelection(new NodeSelection(transaction.doc.resolve(mappedPosition)))
    .setMeta('uiEvent', 'drop')
  view.dispatch(transaction)
  view.focus()
}
