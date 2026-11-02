import { mergeAttributes, Node } from '@tiptap/core'
import type { ProfileProperty } from '../domain/learning-profile-types'

/** Creates the inline node that stores a stable profile-property reference. */
export function createProfileLabelExtension(properties: readonly ProfileProperty[]) {
  return Node.create({
    name: 'profileLabel',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,

    addAttributes() {
      return {
        profilePropertyId: {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute('data-elce-profile-property'),
          renderHTML: (attributes: Record<string, unknown>) => ({
            'data-elce-profile-property': String(attributes.profilePropertyId ?? ''),
          }),
        },
      }
    },

    parseHTML() {
      return [{ tag: 'span[data-elce-profile-property]' }]
    },

    renderHTML({ node, HTMLAttributes }) {
      const propertyId = String(node.attrs.profilePropertyId ?? '')
      const label = properties.find((property) => property.id === propertyId)?.label ?? propertyId
      return ['span', mergeAttributes(HTMLAttributes, { class: 'elce-profile-label' }), label]
    },
  })
}
