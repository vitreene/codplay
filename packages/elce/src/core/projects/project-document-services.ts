import type { MediaMetadata } from '../document/content-document-types'

export interface ProjectDocumentServices<TDocument> {
  id(document: TDocument): string
  name(document: TDocument): string
  media(document: TDocument): readonly MediaMetadata[]
  serialize(document: TDocument): unknown
}

export interface ProjectSessionDocumentServices<TDocument> extends ProjectDocumentServices<TDocument> {
  createProjectDocument(projects: readonly Readonly<{ name: string }>[]): TDocument
  withProjectIdentity(document: TDocument, id: string, name: string): TDocument
  isUnsupportedFormatError(error: unknown): boolean
}
