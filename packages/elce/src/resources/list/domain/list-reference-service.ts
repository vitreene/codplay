import type { ResourceBdc } from '../../document/resource-document-types'
import type { RichTextDocument, RichTextNode } from '../../../core/document/rich-text-types'

export interface ListBdcReference {
  readonly bdcId: string
  readonly ownerBdcId: string
  readonly field: 'card-message' | 'section-content'
}

/** Finds List BDC references in supported rich text fields. */
export class ListReferenceService {
  /** Collects every stable List BDC ID referenced by a Card Message or Section. */
  public referencesIn(bdcs: readonly ResourceBdc[]): readonly ListBdcReference[] {
    return bdcs.flatMap((bdc) => {
      if (bdc.type === 'card' && bdc.card != null && isRichTextDocument(bdc.card.message)) {
        return collectReferences(bdc.card.message, bdc.id, 'card-message')
      }
      if (bdc.type === 'section' && bdc.section != null) {
        return collectReferences(bdc.section.content, bdc.id, 'section-content')
      }
      return []
    })
  }
}

/** Recursively reads List reference nodes without interpreting other rich nodes. */
function collectReferences(document: RichTextDocument, ownerBdcId: string, field: ListBdcReference['field']): readonly ListBdcReference[] {
  return collectNodes(document.content, ownerBdcId, field)
}

/** Finds List BDC references in one rich-text subtree. */
function collectNodes(nodes: readonly RichTextNode[], ownerBdcId: string, field: ListBdcReference['field']): readonly ListBdcReference[] {
  return nodes.flatMap((node) => [
    ...(node.type === 'listBdc' && typeof node.attrs?.bdcId === 'string'
      ? [{ bdcId: node.attrs.bdcId, ownerBdcId, field }]
      : []),
    ...(node.content === undefined ? [] : collectNodes(node.content, ownerBdcId, field)),
  ])
}

/** Narrows an authored value to the persisted Tiptap document shape. */
function isRichTextDocument(value: unknown): value is RichTextDocument {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && 'type' in value && value.type === 'doc' && 'content' in value && Array.isArray(value.content)
}
