// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProfileProperty } from '../domain/learning-profile-types'
import { createProfileLabelExtension } from './profile-label-extension'

const property: ProfileProperty = {
  id: 'profile-region',
  name: 'region',
  label: 'Région',
  type: 'text',
  required: false,
  choices: [],
}

describe('profile label extension', () => {
  let editor: Editor | undefined

  afterEach(() => {
    editor?.destroy()
    editor = undefined
  })

  it('serializes and restores a stable inline label node', () => {
    editor = new Editor({
      extensions: [StarterKit, createProfileLabelExtension([property])],
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: 'Bonjour ' },
          { type: 'profileLabel', attrs: { profilePropertyId: property.id } },
        ] }],
      },
    })

    const markup = editor.getHTML()
    expect(markup).toContain('<span data-elce-profile-property="profile-region" class="elce-profile-label">Région</span>')
    const restored = new Editor({
      extensions: [StarterKit, createProfileLabelExtension([property])],
      content: markup,
    })
    expect(restored.getJSON().content?.[0]?.content?.[1]).toMatchObject({
      type: 'profileLabel',
      attrs: { profilePropertyId: property.id },
    })
    restored.destroy()
  })
})
