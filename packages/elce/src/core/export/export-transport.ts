import type { MediaId, MediaMetadata } from '../document/content-document-types'

export interface ExportZipMessages {
  readonly serverErrorPrefix: string
  readonly serverErrorFallback: string
  readonly invalidZipMessage: string
  readonly filenameHeader?: string
  readonly missingFilenameMessage?: string
}

export interface ExportZipResult {
  readonly archive: Blob
  readonly filename: string | null
}

export interface ExportZipResultWithFilename {
  readonly archive: Blob
  readonly filename: string
}

/** Adds the referenced media bytes to an export form using the declared sizes. */
export async function appendReferencedExportMedia(
  formData: FormData,
  medias: readonly MediaMetadata[],
  referencedMediaIds: ReadonlySet<MediaId>,
  mediaSources: Readonly<Record<MediaId, string>>,
  request: typeof fetch,
): Promise<void> {
  for (const media of medias) {
    if (!referencedMediaIds.has(media.id)) continue
    const source = mediaSources[media.id]
    if (source === undefined) throw new Error(`Le média « ${media.name} » n’est pas disponible.`)
    const response = await request(source, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Le média « ${media.name} » n’a pas pu être lu.`)
    const blob = await response.blob()
    if (blob.size !== media.size) throw new Error(`La taille du média « ${media.name} » ne correspond pas au document.`)
    formData.append(`media:${media.id}`, blob, media.name)
  }
}

/** Posts an export form and validates a ZIP response that includes its filename. */
export function requestExportZip(
  endpoint: string,
  formData: FormData,
  request: typeof fetch,
  messages: ExportZipMessages & { readonly filenameHeader: string; readonly missingFilenameMessage: string },
): Promise<ExportZipResultWithFilename>
/** Posts an export form and validates its ZIP response. */
export function requestExportZip(
  endpoint: string,
  formData: FormData,
  request: typeof fetch,
  messages: ExportZipMessages,
): Promise<ExportZipResult>
export async function requestExportZip(
  endpoint: string,
  formData: FormData,
  request: typeof fetch,
  messages: ExportZipMessages,
): Promise<ExportZipResult> {
  const response = await request(endpoint, { method: 'POST', body: formData })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as Readonly<{ message?: unknown }> | null
    throw new Error(typeof body?.message === 'string'
      ? `${messages.serverErrorPrefix}${body.message}`
      : messages.serverErrorFallback)
  }
  if (!response.headers.get('Content-Type')?.startsWith('application/zip')) {
    throw new Error(messages.invalidZipMessage)
  }
  const filename = messages.filenameHeader === undefined ? null : response.headers.get(messages.filenameHeader)
  if (messages.filenameHeader !== undefined && (filename === null || filename.length === 0)) {
    throw new Error(messages.missingFilenameMessage ?? 'Le serveur n’a pas renvoyé le nom du fichier exporté.')
  }
  return { archive: await response.blob(), filename }
}
