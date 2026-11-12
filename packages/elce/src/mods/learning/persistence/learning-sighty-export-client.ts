import { elceApiOrigin } from '../../../config/api-config'
import type { MediaId } from '../../../core/document/content-document-types'
import { createExportFilename, downloadExportBlob } from '../../../core/export/browser-download'
import { appendReferencedExportMedia, requestExportZip } from '../../../core/export/export-transport'
import type { LearningDocument } from '../document/learning-document'
import { learningScenarioExportMediaIds } from './learning-scenario-export-media'

const EXPORT_ENDPOINT = '/api/exports/sighty'

/** Requests a Sighty ZIP from the Learning document and its scenario media. */
export async function requestLearningSightyPackage(
  documentModel: LearningDocument,
  mediaSources: Readonly<Record<MediaId, string>>,
  request: typeof fetch = fetch,
): Promise<Blob> {
  const formData = new FormData()
  formData.set('document', JSON.stringify(documentModel.toJSON()))
  const requiredMediaIds = learningScenarioExportMediaIds(documentModel, mediaSources)
  await appendReferencedExportMedia(formData, documentModel.medias, requiredMediaIds, mediaSources, request)
  const result = await requestExportZip(
    new URL(EXPORT_ENDPOINT, elceApiOrigin()).toString(),
    formData,
    request,
    {
      serverErrorPrefix: 'L’export a échoué : ',
      serverErrorFallback: 'L’export du scénario Elcé a échoué.',
      invalidZipMessage: 'Le serveur n’a pas renvoyé un paquet Sighty ZIP.',
    },
  )
  return result.archive
}

/** Starts the browser download for one Learning Sighty ZIP. */
export function downloadLearningSightyPackage(packageBlob: Blob, documentName: string): string {
  return downloadExportBlob(
    packageBlob,
    createExportFilename(documentName, '.sighty.zip'),
    'elce-sighty-export-download',
  )
}
