import { elceApiOrigin } from '../config/api-config'
import type { ScormVersion } from '../scorm/scorm-types'

const SCORM_EXPORT_ENDPOINT = '/api/exports/scorm'

export interface ElceScormPackageDownload {
  readonly archive: Blob
  readonly filename: string
}

/** Requests a SCORM archive around the already-generated Sighty ZIP. */
export async function requestElceScormPackage(
  sightyPackage: Blob,
  documentName: string,
  version: ScormVersion,
  monoSco: boolean,
  request: typeof fetch = fetch,
): Promise<ElceScormPackageDownload> {
  const formData = new FormData()
  formData.set('sightyPackage', sightyPackage, 'scenario.sighty.zip')
  formData.set('documentName', documentName)
  formData.set('version', version)
  formData.set('monoSco', String(monoSco))

  const response = await request(new URL(SCORM_EXPORT_ENDPOINT, elceApiOrigin()).toString(), {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) throw new Error(await scormExportErrorMessage(response))
  if (!response.headers.get('Content-Type')?.startsWith('application/zip')) {
    throw new Error('Le serveur n’a pas renvoyé un package SCORM ZIP.')
  }
  const filename = response.headers.get('X-Elce-Scorm-Filename')
  if (filename === null || filename.length === 0) {
    throw new Error('Le serveur n’a pas renvoyé le nom de fichier SCORM normalisé.')
  }
  return { archive: await response.blob(), filename }
}

/** Starts the browser download for the generated SCORM package or mono-SCO collection. */
export function downloadElceScormPackage(
  packageBlob: Blob,
  filename: string,
): string {
  const objectUrl = URL.createObjectURL(packageBlob)
  const link = document.createElement('a')
  link.id = 'elce-scorm-export-download'
  link.href = objectUrl
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
  return filename
}

/** Reads the structured server message or returns one stable SCORM failure. */
async function scormExportErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as Readonly<{ message?: unknown }> | null
  return typeof body?.message === 'string'
    ? `L’export SCORM a échoué : ${body.message}`
    : 'L’export SCORM du scénario Elcé a échoué.'
}
