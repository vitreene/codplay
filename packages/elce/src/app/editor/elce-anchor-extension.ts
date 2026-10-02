import { mergeAttributes, Node } from '@tiptap/core'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { dropPoint } from '@tiptap/pm/transform'
import type { Slice, Node as ProseMirrorNode } from '@tiptap/pm/model'
import { ELCE_ANCHOR } from '../../config/document-config'
import type { BdcId } from '../../domain/document-types'
import type {
  ElceAnchorAttributes,
  ElceAnchorDropTarget,
  ElceAnchorExtensionOptions,
  ElceAnchorTransaction,
} from './anchor-types'

export const ELCE_ANCHOR_TRANSACTION_META = 'elceAnchorAction'

const ELCE_ANCHOR_PLUGIN_KEY = new PluginKey('elceAnchorInteractions')

/** Creates the attributes shared by the editable anchor and its static export. */
export function createElceAnchorAttributes(
  bdcId: BdcId,
  partId: string,
  paddingBottom: string = ELCE_ANCHOR.DEFAULT_PADDING_BOTTOM,
): ElceAnchorAttributes {
  return { bdcId, partId, paddingBottom }
}

/** Builds the Elcé anchor node with the editor-specific drop and move hooks. */
const ElceAnchorNode = Node.create<ElceAnchorExtensionOptions>({
  name: ELCE_ANCHOR.NODE_NAME,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { createFileDropTarget: undefined, resolveMediaSource: undefined }
  },

  addAttributes() {
    return {
      bdcId: { default: null },
      partId: { default: null },
      paddingBottom: { default: ELCE_ANCHOR.DEFAULT_PADDING_BOTTOM },
      mediaId: { default: null },
      mediaType: { default: null },
    }
  },

  parseHTML() {
    return [{
      tag: `span[${ELCE_ANCHOR.DATA_ATTRIBUTE}]`,
      getAttrs: (node) => {
        const element = node as HTMLElement
        return {
          bdcId: element.getAttribute('data-bdc-id'),
          partId: element.getAttribute('data-part'),
          paddingBottom: element.style.paddingBottom || ELCE_ANCHOR.DEFAULT_PADDING_BOTTOM,
          mediaId: element.getAttribute('data-media-id'),
          mediaType: element.getAttribute('data-media-type'),
        }
      },
    }]
  },

  renderHTML({ HTMLAttributes }) {
    const { bdcId, partId, paddingBottom, mediaId, mediaType, ...editableAttributes } = HTMLAttributes
    const resolvedPartId = String(partId ?? '')
    const mediaAttributes = mediaId === null || mediaId === undefined
      ? {}
      : { 'data-media-id': String(mediaId), 'data-media-type': String(mediaType ?? '') }
    return [
      'span',
      mergeAttributes(editableAttributes, {
        id: resolvedPartId,
        [ELCE_ANCHOR.DATA_ATTRIBUTE]: 'true',
        'data-bdc-id': String(bdcId ?? ''),
        'data-part': resolvedPartId,
        ...mediaAttributes,
        class: ELCE_ANCHOR.CLASS_NAME,
        style: `display:inline-block;position:relative;padding-bottom:${String(paddingBottom ?? ELCE_ANCHOR.DEFAULT_PADDING_BOTTOM)};`,
      }),
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = `${ELCE_ANCHOR.CLASS_NAME} elce-anchor-placeholder`
      dom.id = String(node.attrs.partId ?? '')
      dom.dataset.elceAnchor = 'true'
      dom.dataset.bdcId = String(node.attrs.bdcId ?? '')
      dom.dataset.part = String(node.attrs.partId ?? '')
      dom.draggable = true
      dom.contentEditable = 'false'
      dom.style.paddingBottom = String(node.attrs.paddingBottom ?? ELCE_ANCHOR.DEFAULT_PADDING_BOTTOM)
      dom.setAttribute('aria-label', 'Bloc de contenu ancré')
      const mediaId = typeof node.attrs.mediaId === 'string' ? node.attrs.mediaId : null
      const mediaType = node.attrs.mediaType === 'image' || node.attrs.mediaType === 'video' ? node.attrs.mediaType : null
      const source = mediaId !== null && mediaType !== null
        ? this.options.resolveMediaSource?.(mediaId, mediaType) ?? null
        : null

      const bdc = document.createElement('span')
      bdc.className = 'elce-anchor-bdc'
      bdc.id = `${String(node.attrs.bdcId ?? '')}-editor-bdc`
      bdc.dataset.elceBdc = 'true'
      bdc.dataset.bdcId = String(node.attrs.bdcId ?? '')
      if (mediaType !== null) bdc.dataset.mediaType = mediaType
      bdc.setAttribute('aria-label', mediaType === 'video' ? 'Bloc vidéo' : 'Bloc image')

      if (source !== null && mediaType !== null) {
        switch (mediaType) {
          case 'image': {
            const image = document.createElement('img')
            image.className = 'elce-anchor-media-preview'
            image.draggable = false
            image.src = source
            bdc.append(image)
            break
          }
          case 'video': {
            const video = document.createElement('video')
            video.className = 'elce-anchor-media-preview'
            video.src = source
            video.controls = true
            bdc.append(video)
            break
          }
        }
      }

      const handle = document.createElement('span')
      handle.className = 'elce-anchor-handle'
      handle.dataset.elceAnchorHandle = 'true'
      handle.draggable = true
      handle.setAttribute('role', 'button')
      handle.setAttribute('aria-label', 'Déplacer le bloc de contenu')
      handle.textContent = '↕'
      dom.append(bdc, handle)
      return {
        dom,
        ignoreMutation: () => true,
      }
    }
  },

  addProseMirrorPlugins() {
    const createFileDropTarget = this.options.createFileDropTarget
    let draggedAnchorPosition: number | null = null

    return [new Plugin({
      key: ELCE_ANCHOR_PLUGIN_KEY,
      props: {
        handleDOMEvents: {
          dragstart: (view, event) => {
            draggedAnchorPosition = readDraggedAnchorPosition(view, event)
            return false
          },
          dragend: () => {
            draggedAnchorPosition = null
            return false
          },
        },
        handleKeyDown: (view, event) => {
          if ((event.key !== 'Backspace' && event.key !== 'Delete') || !(view.state.selection instanceof NodeSelection)) return false
          const selection = view.state.selection
          if (selection.node.type.name !== ELCE_ANCHOR.NODE_NAME) return false
          const bdcId = String(selection.node.attrs.bdcId ?? '')
          if (bdcId === '') return false
          const transaction = view.state.tr
            .deleteSelection()
            .setMeta(ELCE_ANCHOR_TRANSACTION_META, { kind: 'remove', bdcId } satisfies ElceAnchorTransaction)
          view.dispatch(transaction)
          return true
        },
        handleDrop: (view, event, slice, moved) => {
          const files = event.dataTransfer?.files
          if (files && files.length > 0) {
            const file = files[0]
            const target = createFileDropTarget?.(file) ?? null
            if (target === null) return true
            return insertDroppedFileAnchor(view, event, target, file)
          }
          if (!moved || !sliceContainsAnchor(slice)) return false
          const sourcePosition = draggedAnchorPosition ?? readSelectedAnchorPosition(view)
          if (sourcePosition === null) return false
          const sourceNode = view.state.doc.nodeAt(sourcePosition)
          if (sourceNode === null || sourceNode.type.name !== ELCE_ANCHOR.NODE_NAME) return false
          return moveDroppedAnchor(view, event, slice, sourcePosition, sourceNode)
        },
      },
    })]
  },
})

/** Creates an anchor extension configured with the current editor's file-drop policy. */
export function createElceAnchorExtension(options: ElceAnchorExtensionOptions = {}) {
  return ElceAnchorNode.configure(options)
}

/** Default anchor extension used by tests and contexts without file insertion. */
export const ElceAnchorExtension = createElceAnchorExtension()

/** Inserts a file-created anchor and records the transaction for the command boundary. */
function insertDroppedFileAnchor(
  view: EditorView,
  event: DragEvent,
  target: ElceAnchorDropTarget,
  file: File,
): boolean {
  const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (coordinates === null) return true
  const anchorType = view.state.schema.nodes[ELCE_ANCHOR.NODE_NAME]
  if (anchorType === undefined) return true
  const anchor = anchorType.create({
    bdcId: target.bdcId,
    partId: target.partId,
    paddingBottom: target.paddingBottom,
    mediaId: target.mediaId,
    mediaType: target.bdcType,
  })
  const transaction = view.state.tr.replaceRangeWith(coordinates.pos, coordinates.pos, anchor)
  transaction
    .setSelection(new NodeSelection(transaction.doc.resolve(coordinates.pos)))
    .setMeta(ELCE_ANCHOR_TRANSACTION_META, { kind: 'file-drop', file, target } satisfies ElceAnchorTransaction)
    .setMeta('uiEvent', 'drop')
  view.dispatch(transaction)
  view.focus()
  return true
}

/** Moves the dragged anchor through one ProseMirror transaction and records its bdc id. */
function moveDroppedAnchor(
  view: EditorView,
  event: DragEvent,
  slice: Slice,
  sourcePosition: number,
  sourceNode: ProseMirrorNode,
): boolean {
  const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (coordinates === null) return false
  const sourceEnd = sourcePosition + sourceNode.nodeSize
  if (coordinates.pos >= sourcePosition && coordinates.pos <= sourceEnd) return true
  const insertPosition = dropPoint(view.state.doc, coordinates.pos, slice) ?? coordinates.pos
  const transaction = view.state.tr.delete(sourcePosition, sourceEnd)
  const mappedPosition = transaction.mapping.map(insertPosition)
  transaction
    .replaceRangeWith(mappedPosition, mappedPosition, sourceNode)
    .setSelection(new NodeSelection(transaction.doc.resolve(mappedPosition)))
    .setMeta(ELCE_ANCHOR_TRANSACTION_META, {
      kind: 'move',
      bdcId: String(sourceNode.attrs.bdcId ?? ''),
    } satisfies ElceAnchorTransaction)
    .setMeta('uiEvent', 'drop')
  view.dispatch(transaction)
  view.focus()
  return true
}

/** Finds the document position represented by a dragged anchor DOM node. */
function readDraggedAnchorPosition(view: EditorView, event: Event): number | null {
  const target = event.target
  if (!(target instanceof HTMLElement)) return null
  const anchor = target.closest(`.${ELCE_ANCHOR.CLASS_NAME}`)
  if (!(anchor instanceof HTMLElement)) return null
  return view.posAtDOM(anchor, 0)
}

/** Uses the current node selection as a fallback for synthetic and keyboard-driven drops. */
function readSelectedAnchorPosition(view: EditorView): number | null {
  const selection = view.state.selection
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== ELCE_ANCHOR.NODE_NAME) return null
  return selection.from
}

/** Checks the dropped slice without accepting arbitrary rich-text content as an anchor move. */
function sliceContainsAnchor(slice: Slice): boolean {
  let found = false
  slice.content.descendants((node) => {
    if (node.type.name === ELCE_ANCHOR.NODE_NAME) found = true
  })
  return found
}
