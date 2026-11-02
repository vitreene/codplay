export const PROFILE_TOKEN_INSERT_EVENT = 'elce:profile-token-insert'
export const INLINE_TEXT_LABEL_SELECTION_EVENT = 'elce:inline-text-label-selection'
export const INLINE_TEXT_LABEL_UPDATE_EVENT = 'elce:inline-text-label-update'
export const INLINE_TEXT_DRAG_TYPE = 'application/x-elce-inline-text'

export type InlineTextInsertDetail =
  | Readonly<{ kind: 'profile'; propertyId: string }>
  | Readonly<{ kind: 'page-link'; pageId: string; label: string | null; fallbackLabel: string; presentation: 'text' | 'button' }>
  | Readonly<{ kind: 'local-date'; dateKind: 'today' | 'time' | 'relative'; offsetDays: number }>

export interface InlineTextLabelSelection {
  readonly targetId: string
  readonly position: number
  readonly label: InlineTextInsertDetail
}

export type InlineTextLabelSelectionEventDetail = Readonly<{
  targetId: string
  selection: Readonly<{ position: number; label: InlineTextInsertDetail }> | null
}>

export interface InlineTextLabelUpdateDetail {
  readonly position: number
  readonly expected: InlineTextInsertDetail
  readonly label: InlineTextInsertDetail
}

/** Converts editable label details into the attributes stored by its atom. */
export function inlineTextLabelNodeAttributes(label: InlineTextInsertDetail): Readonly<Record<string, unknown>> {
  switch (label.kind) {
    case 'profile':
      return { profilePropertyId: label.propertyId }
    case 'page-link':
      return {
        pageId: label.pageId,
        label: label.label,
        fallbackLabel: label.fallbackLabel,
        presentation: label.presentation,
      }
    case 'local-date':
      return { kind: label.dateKind, offsetDays: label.offsetDays }
  }
}

/** Reads supported label attributes from an editor atom for its Variables form. */
export function inlineTextLabelFromNode(node: Readonly<{
  type: Readonly<{ name: string }>
  attrs: Readonly<Record<string, unknown>>
}>): InlineTextInsertDetail | null {
  if (node.type.name === 'profileLabel') {
    const propertyId = node.attrs.profilePropertyId
    return typeof propertyId === 'string' ? { kind: 'profile', propertyId } : null
  }
  if (node.type.name === 'pageLinkLabel') {
    const pageId = node.attrs.pageId
    if (typeof pageId !== 'string') return null
    return {
      kind: 'page-link',
      pageId,
      label: typeof node.attrs.label === 'string' ? node.attrs.label : null,
      fallbackLabel: typeof node.attrs.fallbackLabel === 'string' ? node.attrs.fallbackLabel : pageId,
      presentation: node.attrs.presentation === 'button' ? 'button' : 'text',
    }
  }
  if (node.type.name === 'localDateLabel') {
    const dateKind = node.attrs.kind === 'time' || node.attrs.kind === 'relative' ? node.attrs.kind : 'today'
    const offsetDays = node.attrs.offsetDays
    return {
      kind: 'local-date',
      dateKind,
      offsetDays: typeof offsetDays === 'number' && Number.isSafeInteger(offsetDays) ? offsetDays : 0,
    }
  }
  return null
}

/** Checks that an atom still has the attributes shown by the selected-label form. */
export function sameInlineTextLabel(left: InlineTextInsertDetail, right: InlineTextInsertDetail): boolean {
  switch (left.kind) {
    case 'profile':
      return right.kind === 'profile' && left.propertyId === right.propertyId
    case 'page-link': {
      return right.kind === 'page-link'
        && left.pageId === right.pageId
        && left.label === right.label
        && left.fallbackLabel === right.fallbackLabel
        && left.presentation === right.presentation
    }
    case 'local-date': {
      return right.kind === 'local-date'
        && left.dateKind === right.dateKind
        && left.offsetDays === right.offsetDays
    }
  }
}

/** Publishes the active atom selection to the shared Variables panel. */
export function dispatchInlineTextLabelSelectionEvent(
  target: HTMLElement,
  selection: Readonly<{ position: number; label: InlineTextInsertDetail }> | null,
): void {
  if (target.id.length === 0) return
  target.dispatchEvent(new CustomEvent<InlineTextLabelSelectionEventDetail>(INLINE_TEXT_LABEL_SELECTION_EVENT, {
    bubbles: true,
    detail: { targetId: target.id, selection },
  }))
}
