import type { MediaMetadata } from '../document/document-types'

export interface ElceMediaImport {
  readonly file: File
  readonly media: MediaMetadata
}
