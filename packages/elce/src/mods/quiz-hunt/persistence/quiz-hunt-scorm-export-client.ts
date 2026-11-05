import { elceApiOrigin } from '../../../config/api-config'
import type { ScormVersion } from '@codplay/sighty-scorm'

const QUIZ_HUNT_SCORM_EXPORT_ENDPOINT = '/api/quiz-hunt/exports/scorm'

export interface QuizHuntScormPackageDownload {
  readonly archive: Blob
  readonly filename: string
}

/** Requests Quiz Hunt's single-SCO SCORM package around its Sighty archive. */
export async function requestQuizHuntScormPackage(
  sightyPackage: Blob,
  documentName: string,
  version: ScormVersion,
  request: typeof fetch = fetch,
): Promise<QuizHuntScormPackageDownload> {
  const formData = new FormData()
  formData.set('sightyPackage', sightyPackage, 'quiz-hunt.sighty.zip')
  formData.set('documentName', documentName)
  formData.set('version', version)

  const response = await request(new URL(QUIZ_HUNT_SCORM_EXPORT_ENDPOINT, elceApiOrigin()).toString(), {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) throw new Error(await scormExportErrorMessage(response))
  if (!response.headers.get('Content-Type')?.startsWith('application/zip')) {
    throw new Error('Le serveur n’a pas renvoyé le package SCORM Quiz Hunt.')
  }
  const filename = response.headers.get('X-Elce-Scorm-Filename')
  if (filename === null || filename.length === 0) {
    throw new Error('Le serveur n’a pas renvoyé le nom du package SCORM Quiz Hunt.')
  }
  return { archive: await response.blob(), filename }
}

/** Reads the structured server error or returns one stable export failure. */
async function scormExportErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as Readonly<{ message?: unknown }> | null
  return typeof body?.message === 'string'
    ? `L’export SCORM Quiz Hunt a échoué : ${body.message}`
    : 'L’export SCORM Quiz Hunt a échoué.'
}
