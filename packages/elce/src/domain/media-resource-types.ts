import type { MediaMetadata } from './document-types'

export interface ElceMediaImport {
  readonly file: File
  readonly media: MediaMetadata
}
