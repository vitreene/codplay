import type { LearningDocument } from '../document/learning-document'
import type { LearningPage } from '../document/learning-document-types'

/** Resolves the page setting, using inline links as its default value. */
export function pageAllowsEarlyExit(document: LearningDocument, page: LearningPage): boolean {
  return page.allowEarlyExit ?? pageContainsInlinePageLink(document, page)
}

/** Checks page BDCs and their nested BDC children for an internal page link. */
export function pageContainsInlinePageLink(document: LearningDocument, page: LearningPage): boolean {
  const childrenByParent = new Map<string, string[]>()
  for (const bdc of document.bdcs) {
    if (bdc.parentBdcId === null) continue
    const children = childrenByParent.get(bdc.parentBdcId) ?? []
    children.push(bdc.id)
    childrenByParent.set(bdc.parentBdcId, children)
  }

  const visited = new Set<string>()
  const visitBdc = (bdcId: string): boolean => {
    if (visited.has(bdcId)) return false
    visited.add(bdcId)
    const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
    if (bdc === undefined) return false
    if (containsPageLinkLabel(bdc)) return true
    return (childrenByParent.get(bdcId) ?? []).some(visitBdc)
  }

  return page.bdcIds.some(visitBdc)
}

/** Searches a serialized BDC value for a Tiptap page-link label. */
function containsPageLinkLabel(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsPageLinkLabel)
  if (!isRecord(value)) return false
  if (value.type === 'pageLinkLabel') return true
  return Object.values(value).some(containsPageLinkLabel)
}

/** Narrows JSON-compatible model values to plain records. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
