import type { ScormVersion } from '@codplay/sighty-scorm'
import { createScormArchiveFilename } from '../../../../server/export/scorm-archive-filename'
import { runQuizHuntScormPackage } from './quiz-hunt-scorm-package-runner'

const SCORM_VERSIONS = new Set<ScormVersion>(['1.2', '2004v3', '2004v4'])

export type QuizHuntScormPackageExporter = (
  sightyPackage: Uint8Array,
  version: ScormVersion,
) => Promise<Uint8Array>

/** Adapts one Quiz Hunt Sighty upload into its dedicated single-SCO package. */
export class QuizHuntScormExportApiController {
  private readonly exportPackage: QuizHuntScormPackageExporter
  private readonly now: () => Date

  /** Creates the Quiz Hunt endpoint over its one-package SCORM exporter. */
  public constructor(
    exportPackage: QuizHuntScormPackageExporter = runQuizHuntScormPackage,
    now: () => Date = () => new Date(),
  ) {
    this.exportPackage = exportPackage
    this.now = now
  }

  /** Validates the Sighty package and edition, then returns one monoSCO archive. */
  public async export(request: Request): Promise<Response> {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return exportError('invalid_quiz_hunt_scorm_body', 'Le formulaire SCORM Quiz Hunt est illisible.', 400)
    }

    const packageValue = formData.get('sightyPackage')
    const versionValue = formData.get('version')
    const documentNameValue = formData.get('documentName')
    if (!isFile(packageValue)) {
      return exportError('invalid_quiz_hunt_scorm_package', 'Le paquet Sighty Quiz Hunt est absent.', 400)
    }
    if (typeof versionValue !== 'string' || !SCORM_VERSIONS.has(versionValue as ScormVersion)) {
      return exportError('invalid_quiz_hunt_scorm_version', 'La version SCORM choisie n’est pas prise en charge.', 400)
    }
    if (typeof documentNameValue !== 'string' || documentNameValue.trim().length === 0) {
      return exportError('invalid_quiz_hunt_scorm_name', 'Le nom du projet Quiz Hunt est absent.', 400)
    }

    try {
      const archive = await this.exportPackage(
        new Uint8Array(await packageValue.arrayBuffer()),
        versionValue as ScormVersion,
      )
      const filename = createScormArchiveFilename(documentNameValue, versionValue as ScormVersion, true, this.now())
      const body = new ArrayBuffer(archive.byteLength)
      new Uint8Array(body).set(archive)
      return new Response(body, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Elce-Scorm-Filename': filename,
          'X-Elce-Scorm-Package-Count': '1',
          'Cache-Control': 'no-store',
        },
      })
    } catch (error) {
      return exportError('quiz_hunt_scorm_export_failed', errorMessage(error), 422)
    }
  }
}

/** Confirms one browser or Node FormData value is a File. */
function isFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File
}

/** Creates a structured API error for malformed submissions or failed packaging. */
function exportError(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status })
}

/** Converts unknown failures into a readable response message. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
