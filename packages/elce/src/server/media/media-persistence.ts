/** Describes one media row and its optional server-side file reference. */
export interface StoredMediaResource {
  readonly id: string
  readonly name: string
  readonly mimeType: string
  readonly size: number
  readonly storageKey: string | null
  readonly contentSha256: string | null
}

/** Describes the result of linking a finished file to its media row. */
export type StoreMediaFileResult =
  | Readonly<{ kind: 'stored' }>
  | Readonly<{ kind: 'already-stored' }>
  | Readonly<{ kind: 'media-not-found' }>
  | Readonly<{ kind: 'media-changed' }>
  | Readonly<{ kind: 'media-already-has-file' }>
  | Readonly<{ kind: 'duplicate-content'; existingMediaId: string }>

/** Defines the SQLite operations needed by the media HTTP controller. */
export interface MediaPersistence {
  /** Loads media metadata and its optional server file key. */
  findMediaFile(projectId: string, mediaId: string): Promise<StoredMediaResource | null>

  /** Lists all non-null media file keys still referenced by SQLite. */
  listMediaStorageKeys(): Promise<readonly string[]>

  /** Publishes a stored file key after checking the project media identity. */
  storeMediaFile(
    projectId: string,
    mediaId: string,
    expectedSize: number,
    storageKey: string,
    contentSha256: string,
  ): Promise<StoreMediaFileResult>
}
