import { elceApiOrigin } from '../config/api-config'
import type { LearningDocument } from '../mods/learning/document/learning-document'
import type { MediaId } from '../core/document/content-document-types'
import { scenarioExportMediaIds } from './scenario-export-media'

const EXPORT_ENDPOINT = '/api/exports/sighty'

/** Requests a Sighty ZIP from the Elcé API using the current document and media sources. */
export async function requestElceSightyPackage(
  documentModel: LearningDocument,
  mediaSources: Readonly<Record<MediaId, string>>,
  request: typeof fetch = fetch,
): Promise<Blob> {
  const formData = new FormData()
  formData.set('document', JSON.stringify(documentModel.toJSON()))
  const requiredMediaIds = scenarioExportMediaIds(documentModel, mediaSources)
  for (const media of documentModel.medias) {
    if (!requiredMediaIds.has(media.id)) continue
    const source = mediaSources[media.id]
    if (source === undefined) throw new Error(`Le média « ${media.name} » n’est pas disponible.`)
    const response = await request(source, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Le média « ${media.name} » n’a pas pu être lu.`)
    const blob = await response.blob()
    if (blob.size !== media.size) throw new Error(`La taille du média « ${media.name} » ne correspond pas au document.`)
    formData.append(`media:${media.id}`, blob, media.name)
  }

  const response = await request(new URL(EXPORT_ENDPOINT, elceApiOrigin()).toString(), {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) throw new Error(await exportErrorMessage(response))
  if (!response.headers.get('Content-Type')?.startsWith('application/zip')) {
    throw new Error('Le serveur n’a pas renvoyé un paquet Sighty ZIP.')
  }
  return response.blob()
}

/** Starts the browser download for one completed Sighty ZIP. */
export function downloadElceSightyPackage(packageBlob: Blob, documentName: string): string {
  const filename = `${downloadName(documentName)}.sighty.zip`
  const objectUrl = URL.createObjectURL(packageBlob)
  const link = document.createElement('a')
  link.id = 'elce-sighty-export-download'
  link.href = objectUrl
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
  return filename
}

/** Produces the same safe archive name as the API response. */
function downloadName(documentName: string): string {
  return documentName.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'elce'
}

/** Reads the structured server message or returns one stable export failure. */
async function exportErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as Readonly<{ message?: unknown }> | null
  return typeof body?.message === 'string'
    ? `L’export a échoué : ${body.message}`
    : 'L’export du scénario Elcé a échoué.'
}
