import { mergeAttributes, Node } from '@tiptap/core'
import type { Page, RichTextAttributeValue } from '../../../domain/document/document-types'
import type { PageLinkPresentation } from '../../../domain/inline-text/inline-text-value'
import { plainTextFromValue } from '../../../domain/inline-text/inline-text-value'

/** Creates the inline atom that stores a stable page link and its presentation. */
export function createPageLinkLabelExtension(pages: readonly Page[]) {
  return Node.create({
    name: 'pageLinkLabel',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,

    addAttributes() {
      return {
        pageId: { default: null, parseHTML: readAttribute('data-elce-page-id'), renderHTML: renderAttribute('data-elce-page-id', 'pageId') },
        label: { default: null, parseHTML: readNullableAttribute('data-elce-page-label'), renderHTML: renderNullableAttribute('data-elce-page-label', 'label') },
        fallbackLabel: { default: '', parseHTML: readAttribute('data-elce-page-fallback'), renderHTML: renderAttribute('data-elce-page-fallback', 'fallbackLabel') },
        presentation: { default: 'text', parseHTML: readAttribute('data-elce-page-presentation'), renderHTML: renderAttribute('data-elce-page-presentation', 'presentation') },
      }
    },

    parseHTML() {
      return [{ tag: 'span[data-elce-page-id]' }]
    },

    renderHTML({ node, HTMLAttributes }) {
      const pageId = String(node.attrs.pageId ?? '')
      const page = pages.find((candidate) => candidate.id === pageId)
      const fallbackLabel = String(node.attrs.fallbackLabel ?? '')
      const label = typeof node.attrs.label === 'string'
        ? node.attrs.label
        : page === undefined ? fallbackLabel || pageId : plainTextFromValue(page.name)
      const presentation = normalizePresentation(node.attrs.presentation)
      return ['span', mergeAttributes(HTMLAttributes, {
        class: `elce-inline-label elce-inline-label--page elce-inline-label--${presentation}`,
      }), label]
    },
  })
}

/** Creates the inline atom that stores a local date or time reference. */
export function createLocalDateLabelExtension() {
  return Node.create({
    name: 'localDateLabel',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,

    addAttributes() {
      return {
        kind: { default: 'today', parseHTML: readAttribute('data-elce-date-kind'), renderHTML: renderAttribute('data-elce-date-kind', 'kind') },
        offsetDays: {
          default: 0,
          parseHTML: (element: HTMLElement) => Number(element.getAttribute('data-elce-date-offset') ?? 0),
          renderHTML: (attributes: Record<string, unknown>) => ({ 'data-elce-date-offset': String(attributes.offsetDays ?? 0) }),
        },
      }
    },

    parseHTML() {
      return [{ tag: 'span[data-elce-date-kind]' }]
    },

    renderHTML({ node, HTMLAttributes }) {
      const kind = node.attrs.kind === 'time' || node.attrs.kind === 'relative' ? node.attrs.kind : 'today'
      const offsetDays = typeof node.attrs.offsetDays === 'number' ? node.attrs.offsetDays : 0
      const label = localDateEditorLabel(kind, offsetDays)
      return ['span', mergeAttributes(HTMLAttributes, {
        class: 'elce-inline-label elce-inline-label--date',
      }), label]
    },
  })
}

/** Builds an HTML attribute parser for one serialized string field. */
function readAttribute(name: string): (element: HTMLElement) => string | null {
  return (element) => element.getAttribute(name)
}

/** Builds an HTML attribute parser that retains nullable custom labels. */
function readNullableAttribute(name: string): (element: HTMLElement) => string | null {
  return (element) => element.hasAttribute(name) ? element.getAttribute(name) : null
}

/** Builds a Tiptap attribute serializer for one string-valued attribute. */
function renderAttribute(name: string, key: string): (attributes: Record<string, unknown>) => Record<string, RichTextAttributeValue> {
  return (attributes) => ({ [name]: attributes[key] as RichTextAttributeValue ?? null })
}

/** Builds a Tiptap attribute serializer that omits an unset custom label. */
function renderNullableAttribute(name: string, key: string): (attributes: Record<string, unknown>) => Record<string, RichTextAttributeValue> {
  return (attributes) => {
    const value = attributes[key]
    return typeof value === 'string' ? { [name]: value } : {}
  }
}

/** Narrows a stored presentation value to its supported link style. */
function normalizePresentation(value: unknown): PageLinkPresentation {
  return value === 'button' ? 'button' : 'text'
}

/** Returns the stable author label for a local-date atom. */
function localDateEditorLabel(kind: 'today' | 'time' | 'relative', offsetDays: number): string {
  if (kind === 'today') return 'Date du jour'
  if (kind === 'time') return 'Heure locale'
  if (offsetDays === 0) return 'Date relative'
  return offsetDays > 0 ? `Dans ${offsetDays} j` : `Il y a ${Math.abs(offsetDays)} j`
}
