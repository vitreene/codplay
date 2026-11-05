import { elceApiOrigin } from '../../../config/api-config'
import type { MediaId } from '../../../core/document/content-document-types'
import { downloadElceSightyPackage } from '../../../export/elce-sighty-export-client'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { quizHuntScenarioExportMediaIds } from './quiz-hunt-scenario-export-media'
import { writeQuizHuntDocument } from './quiz-hunt-document-codec'

const QUIZ_HUNT_EXPORT_ENDPOINT = '/api/quiz-hunt/exports/sighty'

/** Requests a Sighty package from the Quiz Hunt document and its referenced media. */
export async function requestQuizHuntSightyPackage(
  document: QuizHuntDocument,
  mediaSources: Readonly<Record<MediaId, string>>,
  request: typeof fetch = fetch,
): Promise<Blob> {
  const formData = new FormData()
  formData.set('document', JSON.stringify(writeQuizHuntDocument(document)))
  const referencedMediaIds = quizHuntScenarioExportMediaIds(document, mediaSources)
  for (const media of document.medias) {
    if (!referencedMediaIds.has(media.id)) continue
    const source = mediaSources[media.id]
    if (source === undefined) throw new Error(`Le média « ${media.name} » n’est pas disponible.`)
    const response = await request(source, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Le média « ${media.name} » n’a pas pu être lu.`)
    const blob = await response.blob()
    if (blob.size !== media.size) throw new Error(`La taille du média « ${media.name} » ne correspond pas au document.`)
    formData.append(`media:${media.id}`, blob, media.name)
  }

  const response = await request(new URL(QUIZ_HUNT_EXPORT_ENDPOINT, elceApiOrigin()).toString(), {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) throw new Error(await exportErrorMessage(response))
  if (!response.headers.get('Content-Type')?.startsWith('application/zip')) {
    throw new Error('Le serveur n’a pas renvoyé un paquet Sighty ZIP Quiz Hunt.')
  }
  return response.blob()
}

/** Uses the shared Elcé filename and browser download behavior. */
export function downloadQuizHuntSightyPackage(packageBlob: Blob, documentName: string): string {
  return downloadElceSightyPackage(packageBlob, documentName)
}

/** Reads the structured server message or returns one stable export failure. */
async function exportErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as Readonly<{ message?: unknown }> | null
  return typeof body?.message === 'string'
    ? `L’export Quiz Hunt a échoué : ${body.message}`
    : 'L’export Quiz Hunt a échoué.'
}
