import type { ElceDocumentData, PageId } from '../../domain/document-types'

export const POPUP_PREVIEW_SESSION_PARAM = 'elce-preview-session'
export const POPUP_PREVIEW_PAGE_PARAM = 'elce-preview-page'

export type PopupPreviewRequest = Readonly<{
  type: 'ready' | 'synchronize' | 'show-edited-page'
  sessionId: string
  requestId: number
}>

export type PopupPreviewResponse =
  | Readonly<{
      type: 'snapshot'
      sessionId: string
      requestId: number
      document: ElceDocumentData
      selectedPageId: PageId | null
    }>
  | Readonly<{
      type: 'edited-page'
      sessionId: string
      requestId: number
      selectedPageId: PageId | null
    }>

/** Recognizes a request sent by the Elcé popup in the current browser origin. */
export function isPopupPreviewRequest(value: unknown): value is PopupPreviewRequest {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PopupPreviewRequest>
  return (candidate.type === 'ready' || candidate.type === 'synchronize' || candidate.type === 'show-edited-page')
    && typeof candidate.sessionId === 'string'
    && Number.isSafeInteger(candidate.requestId)
}

/** Recognizes a response sent by the editor to its popup. */
export function isPopupPreviewResponse(value: unknown): value is PopupPreviewResponse {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PopupPreviewResponse>
  return (candidate.type === 'snapshot' || candidate.type === 'edited-page')
    && typeof candidate.sessionId === 'string'
    && Number.isSafeInteger(candidate.requestId)
}
