export type PreviewMediaReference = Readonly<{ id: string }>

export interface PreviewMediaStore<DocumentId extends string = string> {
  loadSyncState(documentId: DocumentId): Promise<Readonly<{ uploadedMediaIds: readonly string[] }>>
  loadMedia(mediaId: string): Promise<Blob | null>
}

export interface PreviewMediaUrlProvider<DocumentId extends string = string> {
  mediaUrl(documentId: DocumentId, mediaId: string): string
}

/** Resolves confirmed uploads to API URLs and pending uploads to retained Blob URLs. */
export async function loadPreviewMediaSources<DocumentId extends string>(options: Readonly<{
  documentId: DocumentId
  media: readonly PreviewMediaReference[]
  store: PreviewMediaStore<DocumentId>
  urlProvider: PreviewMediaUrlProvider<DocumentId>
  sourceUrls: Map<string, string>
}>): Promise<Readonly<Record<string, string>>> {
  const syncState = await options.store.loadSyncState(options.documentId)
  const uploadedMediaIds = new Set(syncState.uploadedMediaIds)
  const sources: Record<string, string> = {}

  for (const media of options.media) {
    let source = options.sourceUrls.get(media.id)
    if (uploadedMediaIds.has(media.id)) {
      const serverSource = options.urlProvider.mediaUrl(options.documentId, media.id)
      if (source !== serverSource && source?.startsWith('blob:') === true) URL.revokeObjectURL(source)
      source = serverSource
      options.sourceUrls.set(media.id, source)
    } else if (source === undefined || !source.startsWith('blob:')) {
      const blob = await options.store.loadMedia(media.id)
      if (blob === null) throw new Error(`Le média ${media.id} est absent du stockage Elcé.`)
      source = URL.createObjectURL(blob)
      options.sourceUrls.set(media.id, source)
    }
    sources[media.id] = source
  }
  return sources
}

/** Resolves every media reference from the synchronized project's stable API URLs. */
export function loadServerPreviewMediaSources<DocumentId extends string>(options: Readonly<{
  documentId: DocumentId
  media: readonly PreviewMediaReference[]
  urlProvider: PreviewMediaUrlProvider<DocumentId>
}>): Readonly<Record<string, string>> {
  return Object.fromEntries(options.media.map((media) => [
    media.id,
    options.urlProvider.mediaUrl(options.documentId, media.id),
  ]))
}
