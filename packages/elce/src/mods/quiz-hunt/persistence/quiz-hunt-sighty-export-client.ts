import { elceApiOrigin } from '../../../config/api-config'
import type { MediaId } from '../../../core/document/content-document-types'
import { createExportFilename, downloadExportBlob } from '../../../core/export/browser-download'
import { appendReferencedExportMedia, requestExportZip } from '../../../core/export/export-transport'
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
  await appendReferencedExportMedia(formData, document.medias, referencedMediaIds, mediaSources, request)
  const result = await requestExportZip(
    new URL(QUIZ_HUNT_EXPORT_ENDPOINT, elceApiOrigin()).toString(),
    formData,
    request,
    {
      serverErrorPrefix: 'L’export Quiz Hunt a échoué : ',
      serverErrorFallback: 'L’export Quiz Hunt a échoué.',
      invalidZipMessage: 'Le serveur n’a pas renvoyé un paquet Sighty ZIP Quiz Hunt.',
    },
  )
  return result.archive
}

/** Downloads a generated Quiz Hunt Sighty archive with the shared naming and browser behavior. */
export function downloadQuizHuntSightyPackage(packageBlob: Blob, documentName: string): string {
  return downloadExportBlob(
    packageBlob,
    createExportFilename(documentName, '.sighty.zip'),
    'elce-sighty-export-download',
  )
}
