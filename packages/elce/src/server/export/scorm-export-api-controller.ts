import type { ScormVersion } from '@codplay/sighty-scorm'
import { runElceScormPackage } from './scorm-package-runner'
import type { ElceScormPackageOptions, ElceScormPackageResult } from './scorm-package-runner'
import { createScormArchiveFilename } from './scorm-archive-filename'

const SIGHTY_PACKAGE_FIELD = 'sightyPackage'
const SCORM_VERSIONS = new Set<ScormVersion>(['1.2', '2004v3', '2004v4'])
const DOCUMENT_NAME_FIELD = 'documentName'

export type ElceScormPackageExporter = (
  sightyPackage: Uint8Array,
  options: ElceScormPackageOptions,
) => Promise<ElceScormPackageResult>

/** Converts an existing Sighty package and selected options into a SCORM download. */
export class ScormExportApiController {
  private readonly exportPackage: ElceScormPackageExporter
  private readonly now: () => Date

  /** Creates the endpoint over the existing SCORM CLI adapter. */
  public constructor(
    exportPackage: ElceScormPackageExporter = runElceScormPackage,
    now: () => Date = () => new Date(),
  ) {
    this.exportPackage = exportPackage
    this.now = now
  }

  /** Validates a Sighty ZIP and the selected options, then returns the SCORM archive. */
  public async export(request: Request): Promise<Response> {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return exportError('invalid_scorm_export_body', 'Le formulaire d’export SCORM est illisible.', 400)
    }

    const packageValue = formData.get(SIGHTY_PACKAGE_FIELD)
    const versionValue = formData.get('version')
    const monoScoValue = formData.get('monoSco')
    const documentNameValue = formData.get(DOCUMENT_NAME_FIELD)
    if (!isFile(packageValue)) {
      return exportError('invalid_scorm_export_package', 'Le paquet Sighty à assembler est absent.', 400)
    }
    if (typeof versionValue !== 'string' || !SCORM_VERSIONS.has(versionValue as ScormVersion)) {
      return exportError('invalid_scorm_export_version', 'La version SCORM choisie n’est pas prise en charge.', 400)
    }
    if (monoScoValue !== 'true' && monoScoValue !== 'false') {
      return exportError('invalid_scorm_export_mono_sco', 'Le choix monoSCO doit être vrai ou faux.', 400)
    }
    if (typeof documentNameValue !== 'string' || documentNameValue.trim().length === 0) {
      return exportError('invalid_scorm_export_document_name', 'Le nom du projet est absent.', 400)
    }

    try {
      const result = await this.exportPackage(new Uint8Array(await packageValue.arrayBuffer()), {
        version: versionValue as ScormVersion,
        monoSco: monoScoValue === 'true',
      })
      const filename = createScormArchiveFilename(
        documentNameValue,
        versionValue as ScormVersion,
        monoScoValue === 'true',
        this.now(),
      )
      const body = new ArrayBuffer(result.archive.byteLength)
      new Uint8Array(body).set(result.archive)
      return new Response(body, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${safeFilename(filename)}"`,
          'X-Elce-Scorm-Filename': safeFilename(filename),
          'X-Elce-Scorm-Package-Count': String(result.packageCount),
          'Cache-Control': 'no-store',
        },
      })
    } catch (error) {
      return exportError('scorm_export_failed', errorMessage(error), 422)
    }
  }
}

/** Restricts a generated attachment name to a safe basename. */
function safeFilename(filename: string): string {
  const basename = filename.split(/[\\/]/u).at(-1) ?? 'elce-scorm.zip'
  return basename.replaceAll('"', '').replaceAll('\r', '').replaceAll('\n', '')
}

/** Confirms one browser or Node FormData value is a File. */
function isFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File
}

/** Creates a structured API error for malformed input or failed package generation. */
function exportError(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status })
}

/** Converts unknown failures into a readable response message. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
