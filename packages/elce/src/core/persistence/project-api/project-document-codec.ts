export interface ProjectDocumentCodec<TDocument, TSerialized> {
  readDocument(value: TSerialized): TDocument
  writeDocument(document: TDocument): TSerialized
  documentId(document: TDocument): string
}
