import type { PageId } from '../document/content-document-types'

export const POPUP_PREVIEW_SESSION_PARAM = 'elce-preview-session'
export const POPUP_PREVIEW_PROJECT_PARAM = 'elce-preview-project'
export const POPUP_PREVIEW_PAGE_PARAM = 'elce-preview-page'

export type PopupPreviewRequest = Readonly<{
  type: 'ready' | 'synchronize' | 'show-edited-page'
  sessionId: string
  requestId: number
}>

export type PopupPreviewResponse<DocumentPayload = unknown> =
  | Readonly<{
      type: 'snapshot'
      sessionId: string
      requestId: number
      document: DocumentPayload
      selectedPageId: PageId | null
    }>
  | Readonly<{
      type: 'edited-page'
      sessionId: string
      requestId: number
      selectedPageId: PageId | null
    }>

/** Encodes snapshots at the owner boundary and decodes them in the receiving mod. */
export interface PopupPreviewDocumentCodec<Document, DocumentPayload = unknown> {
  encode(document: Document): DocumentPayload
  decode(payload: unknown): Document
}

/** Recognizes a request sent by a preview reader in the current browser origin. */
export function isPopupPreviewRequest(value: unknown): value is PopupPreviewRequest {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PopupPreviewRequest>
  return (candidate.type === 'ready' || candidate.type === 'synchronize' || candidate.type === 'show-edited-page')
    && typeof candidate.sessionId === 'string'
    && Number.isSafeInteger(candidate.requestId)
}

/** Recognizes a response sent by the editor to its preview reader. */
export function isPopupPreviewResponse(value: unknown): value is PopupPreviewResponse<unknown> {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PopupPreviewResponse<unknown>>
  return (candidate.type === 'snapshot' || candidate.type === 'edited-page')
    && typeof candidate.sessionId === 'string'
    && Number.isSafeInteger(candidate.requestId)
    && (candidate.type !== 'snapshot' || 'document' in candidate)
}
