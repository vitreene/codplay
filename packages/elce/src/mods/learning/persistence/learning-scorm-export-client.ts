import { elceApiOrigin } from '../../../config/api-config'
import { downloadExportBlob } from '../../../core/export/browser-download'
import { requestExportZip } from '../../../core/export/export-transport'
import type { ScormVersion } from '@codplay/sighty-scorm'

const SCORM_EXPORT_ENDPOINT = '/api/exports/scorm'

export interface LearningScormPackageDownload {
  readonly archive: Blob
  readonly filename: string
}

/** Requests a Learning SCORM archive around the already-generated Sighty ZIP. */
export async function requestLearningScormPackage(
  sightyPackage: Blob,
  documentName: string,
  version: ScormVersion,
  monoSco: boolean,
  request: typeof fetch = fetch,
): Promise<LearningScormPackageDownload> {
  const formData = new FormData()
  formData.set('sightyPackage', sightyPackage, 'scenario.sighty.zip')
  formData.set('documentName', documentName)
  formData.set('version', version)
  formData.set('monoSco', String(monoSco))

  const result = await requestExportZip(
    new URL(SCORM_EXPORT_ENDPOINT, elceApiOrigin()).toString(),
    formData,
    request,
    {
      serverErrorPrefix: 'L’export SCORM a échoué : ',
      serverErrorFallback: 'L’export SCORM du scénario Elcé a échoué.',
      invalidZipMessage: 'Le serveur n’a pas renvoyé un package SCORM ZIP.',
      filenameHeader: 'X-Elce-Scorm-Filename',
      missingFilenameMessage: 'Le serveur n’a pas renvoyé le nom de fichier SCORM normalisé.',
    },
  )
  return { archive: result.archive, filename: result.filename }
}

/** Starts the browser download for a Learning SCORM package or mono-SCO collection. */
export function downloadLearningScormPackage(packageBlob: Blob, filename: string): string {
  return downloadExportBlob(packageBlob, filename, 'elce-scorm-export-download')
}
