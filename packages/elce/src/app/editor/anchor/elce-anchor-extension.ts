import { mergeAttributes, Node } from '@tiptap/core'
import { Settings2 } from 'lucide-static'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { dropPoint } from '@tiptap/pm/transform'
import { Fragment, Slice, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import { ANCHOR, ANCHOR_RETURN, CATALOG_REFERENCE, DEFAULT_PRESET_ID } from '../../../config/document-config'
import type { BdcId } from '../../../domain/document/document-types'
import type { ElceCatalogDropTarget, ElceCatalogReference } from '../../../domain/catalog/catalog-types'
import type {
  ElceAnchorAttributes,
  ElceAnchorDropTarget,
  ElceAnchorExtensionOptions,
  ElceAnchorTransaction,
} from './anchor-types'
import { anchorEditorBlockPositionFor, anchorEditorReservationFor, anchorNameFor } from '../../../anchor/anchor-position'
import { ElceAnchorRatioService } from '../../../domain/anchor/anchor-ratio-service'

export const ELCE_ANCHOR_TRANSACTION_META = 'elceAnchorAction'

const ELCE_ANCHOR_PLUGIN_KEY = new PluginKey('elceAnchorInteractions')
const anchorRatioService = new ElceAnchorRatioService()

/** Creates the attributes shared by the editable anchor and its static export. */
export function createElceAnchorAttributes(
  bdcId: BdcId,
  partId: string,
  paddingBottom: string = ANCHOR.DEFAULT_PADDING_BOTTOM,
): ElceAnchorAttributes {
  return { bdcId, partId, paddingBottom }
}

/** Builds the Elcé anchor node with the editor-specific drop and move hooks. */
const ElceAnchorNode = Node.create<ElceAnchorExtensionOptions>({
  name: ANCHOR.NODE_NAME,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { createFileDropTarget: undefined, createCatalogDropTarget: undefined, resolveCard: undefined, onEditCard: undefined }
  },

  addAttributes() {
    return {
      bdcId: { default: null },
      partId: { default: null },
      paddingBottom: { default: ANCHOR.DEFAULT_PADDING_BOTTOM },
    }
  },

  parseHTML() {
    return [{
      tag: `span[${ANCHOR.DATA_ATTRIBUTE}]`,
      getAttrs: (node) => {
        const element = node as HTMLElement
        return {
          bdcId: element.getAttribute('data-bdc-id'),
          partId: element.getAttribute('data-part'),
          paddingBottom: element.style.getPropertyValue(ANCHOR.PADDING_VARIABLE).trim() || element.style.paddingBottom || ANCHOR.DEFAULT_PADDING_BOTTOM,
        }
      },
    }]
  },

  renderHTML({ HTMLAttributes }) {
    const { bdcId, partId, paddingBottom, ...editableAttributes } = HTMLAttributes
    const resolvedPartId = String(partId ?? '')
    const anchorName = anchorNameFor(resolvedPartId)
    const configuredPadding = String(paddingBottom ?? ANCHOR.DEFAULT_PADDING_BOTTOM)
    return [
      'span',
      mergeAttributes(editableAttributes, {
        id: resolvedPartId,
        [ANCHOR.DATA_ATTRIBUTE]: 'true',
        'data-bdc-id': String(bdcId ?? ''),
        'data-part': resolvedPartId,
        class: ANCHOR.CLASS_NAME,
        style: `display:inline-block;width:0;position:static;vertical-align:top;${ANCHOR.PADDING_VARIABLE}:${configuredPadding};padding-bottom:${anchorEditorReservationFor(configuredPadding)};anchor-name:${anchorName};`,
      }),
    ]
  },

  addNodeView() {
    return ({ node, view, getPos }) => {
      let currentNode = node
      const dom = document.createElement('span')
      dom.className = `${ANCHOR.CLASS_NAME} elce-anchor-placeholder`
      dom.id = String(node.attrs.partId ?? '')
      dom.dataset.elceAnchor = 'true'
      dom.dataset.bdcId = String(node.attrs.bdcId ?? '')
      dom.dataset.part = String(node.attrs.partId ?? '')
      dom.draggable = true
      dom.contentEditable = 'false'
      dom.setAttribute('aria-label', 'Bloc de contenu ancré')
      dom.style.display = 'inline-block'
      dom.style.position = 'static'
      dom.style.width = '0px'
      dom.style.height = '0px'
      dom.style.verticalAlign = 'top'
      const bdcId = String(node.attrs.bdcId ?? '')

      const bdc = document.createElement('span')
      bdc.className = 'elce-anchor-bdc'
      bdc.id = `${bdcId}-editor-bdc`
      bdc.dataset.elceBdc = 'true'
      bdc.dataset.bdcId = bdcId
      bdc.style.paddingBottom = '0px'
      bdc.style.setProperty('position-anchor', anchorNameFor(String(node.attrs.partId ?? '')))
      bdc.style.setProperty('inset-inline-start', '0')
      bdc.style.setProperty('inset-inline-end', '0')
      bdc.style.setProperty('inset-block-start', anchorEditorBlockPositionFor())
      bdc.style.width = '100%'
      let renderedCard = ''
      /** Renders the current Card media while retaining the text-flow anchor DOM. */
      const renderCard = () => {
        const configuredPadding = String(currentNode.attrs.paddingBottom ?? ANCHOR.DEFAULT_PADDING_BOTTOM)
        const currentBdcId = String(currentNode.attrs.bdcId ?? '')
        const card = this.options.resolveCard?.(currentBdcId) ?? null
        const layoutId = card?.layoutId ?? DEFAULT_PRESET_ID.PHOTO
        const mediaType = card?.type ?? null
        const source = card?.source ?? null
        const signature = `${configuredPadding}|${layoutId}|${mediaType ?? ''}|${source ?? ''}`
        dom.id = String(currentNode.attrs.partId ?? '')
        dom.dataset.bdcId = currentBdcId
        dom.dataset.part = String(currentNode.attrs.partId ?? '')
        dom.style.setProperty(ANCHOR.PADDING_VARIABLE, configuredPadding)
        dom.style.paddingBottom = anchorEditorReservationFor(configuredPadding, layoutId)
        dom.style.setProperty('anchor-name', anchorNameFor(String(currentNode.attrs.partId ?? '')))
        bdc.id = `${currentBdcId}-editor-bdc`
        bdc.dataset.bdcId = currentBdcId
        bdc.dataset.cardLayout = layoutId
        if (mediaType === null) delete bdc.dataset.mediaType
        else bdc.dataset.mediaType = mediaType
        bdc.setAttribute('aria-label', mediaType === 'video' ? 'Bloc vidéo' : 'Bloc image')
        if (layoutId === DEFAULT_PRESET_ID.PHOTO) {
          bdc.style.height = 'auto'
          bdc.style.aspectRatio = mediaType === 'video'
            ? '16 / 9'
            : anchorRatioService.imageAspectRatio(configuredPadding)
        } else {
          bdc.style.height = ANCHOR.TEXT_CARD_BLOCK_SIZE
          bdc.style.removeProperty('aspect-ratio')
        }
        if (signature === renderedCard) return
        renderedCard = signature
        bdc.replaceChildren()
        if (source === null || mediaType === null) return
        switch (mediaType) {
          case 'image': {
            const image = document.createElement('img')
            image.className = 'elce-anchor-media-preview'
            image.draggable = false
            image.addEventListener('load', () => {
              const latestCard = this.options.resolveCard?.(String(currentNode.attrs.bdcId ?? ''))
              if (latestCard !== null && latestCard !== undefined) {
                updateAnchorImageRatio(image, dom, bdc, view, getPos, latestCard.layoutId)
              }
            }, { once: true })
            image.src = source
            bdc.append(image)
            if (image.complete && image.naturalWidth > 0) updateAnchorImageRatio(image, dom, bdc, view, getPos, layoutId)
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
      renderCard()
      const unregisterRefresh = this.options.registerNodeViewRefresh?.(bdcId, renderCard)

      const handle = document.createElement('span')
      handle.className = 'elce-anchor-handle'
      handle.dataset.elceAnchorHandle = 'true'
      handle.draggable = true
      handle.setAttribute('role', 'button')
      handle.setAttribute('aria-label', 'Déplacer le bloc de contenu')
      handle.style.setProperty('position-anchor', anchorNameFor(String(node.attrs.partId ?? '')))
      handle.textContent = '↕'
      const editPosition = document.createElement('span')
      editPosition.className = 'elce-anchor-edit-position'
      editPosition.id = `${bdcId}-anchor-edit-position`
      editPosition.contentEditable = 'false'
      editPosition.style.setProperty('position-anchor', anchorNameFor(String(node.attrs.partId ?? '')))
      const editButton = document.createElement('button')
      editButton.className = 'elce-anchor-edit'
      editButton.type = 'button'
      editButton.draggable = false
      editButton.contentEditable = 'false'
      editButton.id = `${bdcId}-anchor-edit`
      editButton.setAttribute('aria-label', 'Modifier la carte ancrée')
      editButton.title = 'Modifier la carte'
      editButton.append(createAnchorEditIcon(`${bdcId}-anchor-edit-icon`))
      editButton.addEventListener('mousedown', (event) => event.preventDefault())
      editButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        this.options.onEditCard?.(String(node.attrs.bdcId ?? ''))
      })
      editPosition.append(editButton)
      dom.append(bdc, handle, editPosition)
      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== ANCHOR.NODE_NAME) return false
          currentNode = updatedNode
          renderCard()
          return true
        },
        destroy: () => unregisterRefresh?.(),
        ignoreMutation: () => true,
      }
    }
  },

  addProseMirrorPlugins() {
    const createFileDropTarget = this.options.createFileDropTarget
    const createCatalogDropTarget = this.options.createCatalogDropTarget
    let draggedAnchorPosition: number | null = null
    let draggedAnchorBdcId: BdcId | null = null

    return [new Plugin({
      key: ELCE_ANCHOR_PLUGIN_KEY,
      props: {
        transformPasted: (slice) => {
          const isInternalAnchorDrag = draggedAnchorPosition !== null && sliceContainsAnchor(slice)
          switch (isInternalAnchorDrag) {
            case true:
              return slice
            case false:
              return removeAnchorNodes(slice)
          }
        },
        handleDOMEvents: {
          dragstart: (view, event) => {
            draggedAnchorPosition = readDraggedAnchorPosition(view, event)
            draggedAnchorBdcId = readAnchorBdcId(view, draggedAnchorPosition)
            return false
          },
          dragend: (view, event) => {
            returnDraggedAnchorToCatalog(view, event, draggedAnchorPosition, draggedAnchorBdcId)
            draggedAnchorPosition = null
            draggedAnchorBdcId = null
            return false
          },
        },
        handleKeyDown: (view, event) => {
          if ((event.key !== 'Backspace' && event.key !== 'Delete') || !(view.state.selection instanceof NodeSelection)) return false
          const selection = view.state.selection
          if (selection.node.type.name !== ANCHOR.NODE_NAME) return false
          const bdcId = String(selection.node.attrs.bdcId ?? '')
          if (bdcId === '') return false
          const transaction = view.state.tr
            .deleteSelection()
            .setMeta(ELCE_ANCHOR_TRANSACTION_META, { kind: 'remove', bdcId } satisfies ElceAnchorTransaction)
          view.dispatch(transaction)
          return true
        },
        handleDrop: (view, event, slice, moved) => {
          switch (hasCatalogReference(event.dataTransfer)) {
            case true: {
              const reference = readCatalogReference(event.dataTransfer)
              switch (reference) {
                case null:
                  return true
                default: {
                  const target = createCatalogDropTarget?.(reference) ?? null
                  switch (target) {
                    case null:
                      return true
                    default:
                      return insertDroppedCatalogAnchor(view, event, target)
                  }
                }
              }
            }
            case false:
              break
          }
          const files = event.dataTransfer?.files
          if (files && files.length > 0) {
            const file = files[0]
            const target = createFileDropTarget?.(file) ?? null
            if (target === null) return true
            return insertDroppedFileAnchor(view, event, target, file)
          }
          if (!sliceContainsAnchor(slice)) return false
          if (!moved) return true
          const sourcePosition = draggedAnchorPosition ?? readSelectedAnchorPosition(view)
          if (sourcePosition === null) return true
          const sourceNode = view.state.doc.nodeAt(sourcePosition)
          if (sourceNode === null || sourceNode.type.name !== ANCHOR.NODE_NAME) return true
          moveDroppedAnchor(view, event, slice, sourcePosition, sourceNode)
          draggedAnchorPosition = null
          draggedAnchorBdcId = null
          return true
        },
      },
      view: (view) => {
        const addReturnReference = (event: Event) => writeAnchorReturnReference(event, draggedAnchorBdcId)
        view.dom.addEventListener('dragstart', addReturnReference)
        return { destroy: () => view.dom.removeEventListener('dragstart', addReturnReference) }
      },
    })]
  },
})

/** Builds the anchor edit icon from its static Lucide asset as native SVG markup. */
function createAnchorEditIcon(id: string): SVGSVGElement {
  const root = new DOMParser().parseFromString(Settings2, 'image/svg+xml').documentElement
  if (root.localName !== 'svg') throw new Error('Lucide asset is not an SVG element.')
  const icon = document.importNode(root, true) as unknown as SVGSVGElement
  icon.id = id
  icon.setAttribute('width', '14')
  icon.setAttribute('height', '14')
  icon.setAttribute('aria-hidden', 'true')
  return icon
}

/** Creates an anchor extension configured with the current editor's file-drop policy. */
export function createElceAnchorExtension(options: ElceAnchorExtensionOptions = {}) {
  return ElceAnchorNode.configure(options)
}

/** Default anchor extension used by tests and contexts without file insertion. */
export const ElceAnchorExtension = createElceAnchorExtension()

/** Stores a loaded image's natural ratio on its anchor through a Tiptap transaction. */
function updateAnchorImageRatio(
  image: HTMLImageElement,
  anchor: HTMLSpanElement,
  bdc: HTMLSpanElement,
  view: EditorView,
  getPos: () => number | undefined,
  layoutId: string,
): void {
  let position: number | undefined
  try {
    position = getPos()
  } catch {
    return
  }
  if (typeof position !== 'number') return

  const currentNode = view.state.doc.nodeAt(position)
  if (currentNode === null || currentNode.type.name !== ANCHOR.NODE_NAME) return
  if (layoutId !== DEFAULT_PRESET_ID.PHOTO) return
  const paddingBottom = anchorRatioService.imagePaddingBottom(image.naturalWidth, image.naturalHeight)
  anchor.style.setProperty(ANCHOR.PADDING_VARIABLE, paddingBottom)
  anchor.style.paddingBottom = anchorEditorReservationFor(paddingBottom, layoutId)
  bdc.style.aspectRatio = anchorRatioService.imageAspectRatio(paddingBottom)
  if (currentNode.attrs.paddingBottom === paddingBottom) return

  view.dispatch(view.state.tr.setNodeMarkup(position, undefined, { ...currentNode.attrs, paddingBottom }))
}

/** Inserts a file-created anchor and records the transaction for the command boundary. */
function insertDroppedFileAnchor(
  view: EditorView,
  event: DragEvent,
  target: ElceAnchorDropTarget,
  file: File,
): boolean {
  const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (coordinates === null) return true
  const anchorType = view.state.schema.nodes[ANCHOR.NODE_NAME]
  if (anchorType === undefined) return true
  const anchor = anchorType.create({
    bdcId: target.bdcId,
    partId: target.partId,
    paddingBottom: target.paddingBottom,
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

/** Inserts a catalogue reference at the drop point and records its command intent. */
function insertDroppedCatalogAnchor(
  view: EditorView,
  event: DragEvent,
  target: ElceCatalogDropTarget,
): boolean {
  const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (coordinates === null) return true
  const anchorType = view.state.schema.nodes[ANCHOR.NODE_NAME]
  if (anchorType === undefined) return true
  const anchor = anchorType.create({
    bdcId: target.bdcId,
    partId: target.partId,
    paddingBottom: target.paddingBottom,
  })
  const transaction = view.state.tr.replaceRangeWith(coordinates.pos, coordinates.pos, anchor)
  transaction
    .setSelection(new NodeSelection(transaction.doc.resolve(coordinates.pos)))
    .setMeta(ELCE_ANCHOR_TRANSACTION_META, { kind: 'catalog-drop', target } satisfies ElceAnchorTransaction)
    .setMeta('uiEvent', 'drop')
  view.dispatch(transaction)
  view.focus()
  return true
}

/** Checks whether the transfer advertises Elcé's private catalogue payload. */
function hasCatalogReference(dataTransfer: DataTransfer | null): boolean {
  return Array.from(dataTransfer?.types ?? []).includes(CATALOG_REFERENCE.MIME_TYPE)
}

/** Reads and validates a catalogue reference without accepting text fallbacks. */
function readCatalogReference(dataTransfer: DataTransfer | null): ElceCatalogReference | null {
  switch (dataTransfer) {
    case null:
      return null
    default:
      try {
        const parsed = JSON.parse(dataTransfer.getData(CATALOG_REFERENCE.MIME_TYPE)) as {
          readonly kind?: unknown
          readonly bdcId?: unknown
          readonly mediaId?: unknown
        }
        switch (parsed.kind) {
          case CATALOG_REFERENCE.BDC:
            return typeof parsed.bdcId === 'string' && parsed.bdcId.length > 0
              ? { kind: CATALOG_REFERENCE.BDC, bdcId: parsed.bdcId }
              : null
          case CATALOG_REFERENCE.MEDIA:
            return typeof parsed.mediaId === 'string' && parsed.mediaId.length > 0
              ? { kind: CATALOG_REFERENCE.MEDIA, mediaId: parsed.mediaId }
              : null
          default:
            return null
        }
      } catch {
        return null
      }
  }
}

/** Moves the dragged anchor through one ProseMirror transaction and records its bdc id. */
function moveDroppedAnchor(
  view: EditorView,
  event: DragEvent,
  slice: Slice,
  sourcePosition: number,
  sourceNode: ProseMirrorNode,
): void {
  const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (coordinates === null) return
  const sourceEnd = sourcePosition + sourceNode.nodeSize
  if (coordinates.pos >= sourcePosition && coordinates.pos <= sourceEnd) return
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
}

/** Finds the document position represented by a dragged anchor DOM node. */
function readDraggedAnchorPosition(view: EditorView, event: Event): number | null {
  const target = event.target
  if (!(target instanceof HTMLElement)) return null
  const anchor = target.closest(`.${ANCHOR.CLASS_NAME}`)
  if (!(anchor instanceof HTMLElement)) return null
  return view.posAtDOM(anchor, 0)
}

/** Marks a dragged anchored bdc so the available-bdc catalogue can accept it. */
function readAnchorBdcId(view: EditorView, position: number | null): BdcId | null {
  switch (position) {
    case null:
      return null
    default: {
      const node = view.state.doc.nodeAt(position)
      switch (node?.type.name) {
        case ANCHOR.NODE_NAME:
          return String(node.attrs.bdcId ?? '') || null
        default:
          return null
      }
    }
  }
}

/** Marks a dragged anchored bdc so the available-bdc catalogue can accept it. */
function writeAnchorReturnReference(event: Event, bdcId: BdcId | null): void {
  const dataTransfer = (event as DragEvent).dataTransfer
  if (dataTransfer === null || dataTransfer === undefined || bdcId === null) return
  dataTransfer.effectAllowed = 'copyMove'
  dataTransfer.setData(ANCHOR_RETURN.MIME_TYPE, bdcId)
}

/** Removes the source anchor only after the available-bdc catalogue accepts the drop. */
function returnDraggedAnchorToCatalog(
  view: EditorView,
  event: Event,
  position: number | null,
  draggedBdcId: BdcId | null,
): void {
  const dataTransfer = (event as DragEvent).dataTransfer
  if (dataTransfer === null || dataTransfer === undefined || position === null || draggedBdcId === null) return
  if (dataTransfer.dropEffect !== 'move') return
  const node = view.state.doc.nodeAt(position)
  if (node === null || node.type.name !== ANCHOR.NODE_NAME || node.attrs.bdcId !== draggedBdcId) return
  const transaction = view.state.tr
    .delete(position, position + node.nodeSize)
    .setMeta(ELCE_ANCHOR_TRANSACTION_META, { kind: 'return', bdcId: draggedBdcId } satisfies ElceAnchorTransaction)
    .setMeta('uiEvent', 'drop')
  view.dispatch(transaction)
}

/** Uses the current node selection as a fallback for synthetic and keyboard-driven drops. */
function readSelectedAnchorPosition(view: EditorView): number | null {
  const selection = view.state.selection
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== ANCHOR.NODE_NAME) return null
  return selection.from
}

/** Checks the dropped slice without accepting arbitrary rich-text content as an anchor move. */
function sliceContainsAnchor(slice: Slice): boolean {
  let found = false
  slice.content.descendants((node) => {
    if (node.type.name === ANCHOR.NODE_NAME) found = true
  })
  return found
}

/** Keeps copied text while omitting unique bdc anchors from pasted content. */
function removeAnchorNodes(slice: Slice): Slice {
  return new Slice(removeAnchorsFromFragment(slice.content), slice.openStart, slice.openEnd)
}

/** Recursively removes anchor atoms from a copied ProseMirror fragment. */
function removeAnchorsFromFragment(fragment: Fragment): Fragment {
  const nodes: ProseMirrorNode[] = []
  fragment.forEach((node) => {
    switch (node.type.name) {
      case ANCHOR.NODE_NAME:
        break
      default:
        nodes.push(node.isLeaf ? node : node.copy(removeAnchorsFromFragment(node.content)))
    }
  })
  return Fragment.fromArray(nodes)
}
