import { Node as TiptapNode, mergeAttributes } from '@tiptap/core'
import { createRoot } from 'remix/component'
import type { ListContent } from '../domain/list-types'
import { renderListEditor, renderListView } from './list-editor'

export interface ListBdcReferenceNodeOptions {
  readonly getListContent: (bdcId: string) => ListContent | null
  readonly onUpdateList: (bdcId: string, list: ListContent) => void
  readonly createRowId: () => string
  readonly registerNodeViewRefresh?: (refresh: () => void) => () => void
}

/** Creates the atomic block reference and mounts its shared editor in the text flow. */
export function createListBdcReferenceNode(options: ListBdcReferenceNodeOptions) {
  return TiptapNode.create({
    name: 'listBdc',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: false,

    addNodeView() {
      return ({ node }) => {
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
            if (updatedNode.type.name !== 'listBdc') return false
            currentNode = updatedNode
            render()
            return true
          },
          stopEvent: (event) => event.target instanceof Element && dom.contains(event.target),
          ignoreMutation: () => true,
          destroy: () => {
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
  })
}
