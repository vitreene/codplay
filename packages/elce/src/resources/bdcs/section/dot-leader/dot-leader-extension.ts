import { findParentNode, mergeAttributes, Node } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { createStableId } from '../../../../core/document/stable-id'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dotLeader: {
      /** Splits a paragraph at the caret, or reunites an existing leader row. */
      toggleDotLeader: () => ReturnType
    }
  }
}

/** Owns one editable side of a dot-leader paragraph, including its text marks. */
const DotLeaderText = Node.create({
  name: 'dotLeaderText',
  content: 'inline*',
  defining: true,

  /** Keeps text containers identifiable in the persisted and exported markup. */
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.id || createStableId('elce-dot-leader-text'),
      },
    }
  },

  /** Restores either editable text side from the exported HTML. */
  parseHTML() {
    return [{ tag: 'span[data-elce-dot-leader-text]' }]
  },

  /** Exports a text side without introducing another paragraph. */
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-elce-dot-leader-text': '',
      class: 'elce-dot-leader-text',
    }), 0]
  },
})

/** Formats a complete paragraph as two editable text sides and a dotted leader. */
export const DotLeaderParagraph = Node.create({
  name: 'dotLeaderParagraph',
  priority: 1100,
  group: 'block',
  content: 'dotLeaderText dotLeaderText',
  defining: true,
  isolating: true,

  /** Registers the two text containers in the existing Section schema. */
  addExtensions() {
    return [DotLeaderText]
  },

  /** Preserves the paragraph identity through JSON and HTML round trips. */
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.id || createStableId('elce-dot-leader'),
      },
    }
  },

  /** Parses only the authored text containers, excluding the decorative rule. */
  parseHTML() {
    return [{ tag: 'p[data-elce-dot-leader]', contentElement: '.elce-dot-leader-content' }]
  },

  /** Uses the same empty border span in the editor and the reading markup. */
  renderHTML({ node, HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, {
      'data-elce-dot-leader': '',
      class: 'elce-dot-leader-paragraph',
    }),
    ['span', { id: `${node.attrs.id}-content`, class: 'elce-dot-leader-content' }, 0],
    ['span', { class: 'elce-dot-leader-rule', 'aria-hidden': 'true', contenteditable: 'false' }],
    ]
  },

  /** Converts the current paragraph through one ordinary Tiptap transaction. */
  addCommands() {
    return {
      toggleDotLeader: () => ({ state, tr, dispatch }) => {
        const { $from, $to } = state.selection
        const row = findParentNode((node) => node.type === this.type)(state.selection)
        if (row !== undefined) {
          if ($to.depth < row.depth || $to.node(row.depth) !== row.node) return false
          const left = row.node.child(0)
          const right = row.node.child(1)
          const paragraph = state.schema.nodes.paragraph!.create(null, left.content.append(right.content))
          const offset = $from.parentOffset
            + ($from.index(row.depth) === 1 ? left.content.size : 0)
          if (dispatch) {
            tr.replaceWith(row.pos, row.pos + row.node.nodeSize, paragraph)
            tr.setSelection(TextSelection.create(tr.doc, row.pos + 1 + offset))
          }
          return true
        }

        if ($from.parent.type.name !== 'paragraph' || !$from.sameParent($to)) return false
        const id = createStableId('elce-dot-leader')
        const sideType = state.schema.nodes.dotLeaderText!
        const paragraph = this.type.create({ id }, [
          sideType.create({ id: `${id}-left` }, $from.parent.content.cut(0, $from.parentOffset)),
          sideType.create({ id: `${id}-right` }, $from.parent.content.cut($from.parentOffset)),
        ])
        if (dispatch) {
          const pos = $from.before()
          tr.replaceWith(pos, $from.after(), paragraph)
          tr.setSelection(TextSelection.create(tr.doc, pos + paragraph.child(0).nodeSize + 2))
        }
        return true
      },
    }
  },

  /** Leaves the row with Enter and removes its separator with boundary deletion. */
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const row = findParentNode((node) => node.type === this.type)(this.editor.state.selection)
        if (row === undefined) return false
        return this.editor.chain()
          .insertContentAt(row.pos + row.node.nodeSize, { type: 'paragraph' })
          .run()
      },
      Backspace: () => {
        const { empty, $from } = this.editor.state.selection
        if (!empty || $from.parent.type.name !== 'dotLeaderText' || $from.parentOffset !== 0) return false
        return this.editor.commands.toggleDotLeader()
      },
      Delete: () => {
        const { empty, $from } = this.editor.state.selection
        if (!empty || $from.parent.type.name !== 'dotLeaderText' || $from.parentOffset !== $from.parent.content.size) return false
        return this.editor.commands.toggleDotLeader()
      },
    }
  },
})
