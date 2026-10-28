import type { MediaMetadata } from '../document/content-document-types'

export interface ElceMediaImport {
  readonly file: File
  readonly media: MediaMetadata
}
