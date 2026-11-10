import { elceApiOrigin } from '../../../config/api-config'
import { requestExportZip } from '../../../core/export/export-transport'
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

  const result = await requestExportZip(
    new URL(QUIZ_HUNT_SCORM_EXPORT_ENDPOINT, elceApiOrigin()).toString(),
    formData,
    request,
    {
      serverErrorPrefix: 'L’export SCORM Quiz Hunt a échoué : ',
      serverErrorFallback: 'L’export SCORM Quiz Hunt a échoué.',
      invalidZipMessage: 'Le serveur n’a pas renvoyé le package SCORM Quiz Hunt.',
      filenameHeader: 'X-Elce-Scorm-Filename',
      missingFilenameMessage: 'Le serveur n’a pas renvoyé le nom du package SCORM Quiz Hunt.',
    },
  )
  return { archive: result.archive, filename: result.filename }
}
