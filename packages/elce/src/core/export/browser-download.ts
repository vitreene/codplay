/** Produces a filesystem-safe base name for a generated project archive. */
export function createExportFilename(documentName: string, suffix: string): string {
  const safeName = documentName.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'elce'
  return `${safeName}${suffix}`
}

/** Starts a browser download and releases its temporary object URL afterwards. */
export function downloadExportBlob(blob: Blob, filename: string, anchorId: string): string {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.id = anchorId
  link.href = objectUrl
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
  return filename
}
