import type { Editor } from '@tiptap/core'
import type { ProfileProperty } from '../domain/learning-profile-types'
import type { LearningPage } from '../../document/learning-document-types'
import type { SectionTextFeature } from '../../../../resources/bdcs/section/authoring/section-editor-tiptap-adapter'
import { createProfileLabelExtension } from './profile-label-extension'
import { createLocalDateLabelExtension, createPageLinkLabelExtension } from '../../inline-text/learning-inline-label-extensions'
import {
  INLINE_TEXT_LABEL_SELECTION_EVENT,
  INLINE_TEXT_LABEL_UPDATE_EVENT,
  PROFILE_TOKEN_INSERT_EVENT,
  dispatchInlineTextLabelSelectionEvent,
  inlineTextLabelFromNode,
  inlineTextLabelNodeAttributes,
  sameInlineTextLabel,
  type InlineTextInsertDetail,
  type InlineTextLabelUpdateDetail,
} from './profile-token-events'
import { NodeSelection } from '@tiptap/pm/state'
import { LEARNING_PROFILE_TEXT_FIELD_ATTRIBUTES } from './learning-profile-text-field-attributes'

/** Adds Learning profile tokens to a Section editor without coupling the resource to Learning. */
export function createLearningSectionTextFeature(properties: readonly ProfileProperty[], pages: readonly LearningPage[] = []): SectionTextFeature {
  return {
    extensions: [createProfileLabelExtension(properties), createPageLinkLabelExtension(pages), createLocalDateLabelExtension()],
    attributes: LEARNING_PROFILE_TEXT_FIELD_ATTRIBUTES,
    attach: (editor) => attachProfileTokenListener(editor),
  }
}

/** Connects Learning's inline label insertion, editing and selection events to a Section. */
function attachProfileTokenListener(editor: Editor): () => void {
  const insertLabel = (event: Event): void => {
    const label = (event as CustomEvent<InlineTextInsertDetail>).detail
    if (label === undefined || !isSupportedLabel(editor, label)) return
    const node = labelNode(label)
    if (node === null) return
    editor.chain().focus().insertContent(node).run()
  }
  const updateLabel = (event: Event): void => {
    const detail = (event as CustomEvent<InlineTextLabelUpdateDetail>).detail
    if (detail === undefined || !isSupportedLabel(editor, detail.label)) return
    const type = editor.schema.nodes[labelNodeType(detail.label)]
    if (type === undefined) return
    const position = Math.max(0, Math.min(detail.position, editor.state.doc.content.size - 1))
    const node = editor.state.doc.nodeAt(position)
    if (node === null || inlineTextLabelFromNode(node) === null
      || !sameInlineTextLabel(inlineTextLabelFromNode(node)!, detail.expected)) return
    editor.view.dispatch(editor.state.tr.setNodeMarkup(position, type, labelNodeAttributes(detail.label)))
  }
  const emitSelection = (): void => {
    const selection = editor.state.selection
    const label = selection instanceof NodeSelection ? inlineTextLabelFromNode(selection.node) : null
    dispatchInlineTextLabelSelectionEvent(editor.view.dom, label === null
      ? null
      : { position: selection.from, label })
  }
  editor.on('selectionUpdate', emitSelection)
  editor.view.dom.addEventListener(PROFILE_TOKEN_INSERT_EVENT, insertLabel)
  editor.view.dom.addEventListener(INLINE_TEXT_LABEL_UPDATE_EVENT, updateLabel)
  return () => {
    editor.off('selectionUpdate', emitSelection)
    editor.view.dom.removeEventListener(PROFILE_TOKEN_INSERT_EVENT, insertLabel)
    editor.view.dom.removeEventListener(INLINE_TEXT_LABEL_UPDATE_EVENT, updateLabel)
    editor.view.dom.dispatchEvent(new CustomEvent(INLINE_TEXT_LABEL_SELECTION_EVENT, { bubbles: true, detail: { targetId: editor.view.dom.id, selection: null } }))
  }
}

/** Returns whether one inline label type is available in this section schema. */
function isSupportedLabel(editor: Editor, label: InlineTextInsertDetail): boolean {
  return editor.schema.nodes[labelNodeType(label)] !== undefined
}

/** Maps a profile, page, or local-date label to its Tiptap node type. */
function labelNodeType(label: InlineTextInsertDetail): string {
  switch (label.kind) {
    case 'profile': return 'profileLabel'
    case 'page-link': return 'pageLinkLabel'
    case 'local-date': return 'localDateLabel'
  }
}

/** Builds a Tiptap node from the public Variables panel label shape. */
function labelNode(label: InlineTextInsertDetail): Readonly<{ type: string; attrs: Readonly<Record<string, unknown>> }> | null {
  return { type: labelNodeType(label), attrs: labelNodeAttributes(label) }
}

/** Encodes one label using the attribute names owned by its Tiptap extension. */
function labelNodeAttributes(label: InlineTextInsertDetail): Readonly<Record<string, unknown>> {
  return inlineTextLabelNodeAttributes(label)
}
