import type { Editor } from '@tiptap/core'
import type { ProfileProperty } from '../domain/learning-profile-types'
import type { SectionTextFeature } from '../../../../resources/bdcs/section/authoring/section-editor-tiptap-adapter'
import { createProfileLabelExtension } from './profile-label-extension'
import { PROFILE_TOKEN_INSERT_EVENT } from './profile-token-events'
import { LEARNING_PROFILE_TEXT_FIELD_ATTRIBUTES } from './learning-profile-text-field-attributes'

/** Adds Learning profile tokens to a Section editor without coupling the resource to Learning. */
export function createLearningSectionTextFeature(properties: readonly ProfileProperty[]): SectionTextFeature {
  return {
    extensions: [createProfileLabelExtension(properties)],
    attributes: LEARNING_PROFILE_TEXT_FIELD_ATTRIBUTES,
    attach: (editor) => attachProfileTokenListener(editor),
  }
}

/** Connects the profile insertion event to the selected Section text position. */
function attachProfileTokenListener(editor: Editor): () => void {
  const insertLabel = (event: Event): void => {
    const propertyId = (event as CustomEvent<{ propertyId?: unknown }>).detail?.propertyId
    if (typeof propertyId !== 'string') return
    editor.chain().focus().insertContent({
      type: 'profileLabel',
      attrs: { profilePropertyId: propertyId },
    }).run()
  }
  editor.view.dom.addEventListener(PROFILE_TOKEN_INSERT_EVENT, insertLabel)
  return () => editor.view.dom.removeEventListener(PROFILE_TOKEN_INSERT_EVENT, insertLabel)
}
