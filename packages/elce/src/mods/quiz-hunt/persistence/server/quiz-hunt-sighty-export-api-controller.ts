import type { MediaId } from '../../../../core/document/content-document-types'
import type { QuizHuntDocument } from '../../document/quiz-hunt-document-types'
import { readQuizHuntDocument, writeQuizHuntDocument } from '../quiz-hunt-document-codec'
import { exportQuizHuntSightyPackage } from './quiz-hunt-sighty-exporter'

const DOCUMENT_FIELD = 'document'
const MEDIA_FIELD_PREFIX = 'media:'

export type QuizHuntSightyPackageExporter = (
  document: Readonly<{ version: 1; document: QuizHuntDocument }>,
  mediaBytesById: ReadonlyMap<MediaId, Uint8Array>,
) => Promise<Uint8Array>

/** Adapts one Quiz Hunt upload into the standalone Sighty ZIP response. */
export class QuizHuntSightyExportApiController {
  private readonly exportPackage: QuizHuntSightyPackageExporter

  /** Creates the endpoint over the mod-owned Quiz Hunt package exporter. */
  public constructor(exportPackage: QuizHuntSightyPackageExporter = exportQuizHuntSightyPackage) {
    this.exportPackage = exportPackage
  }

  /** Validates the uploaded document and referenced media before packaging. */
  public async export(request: Request): Promise<Response> {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return exportError('invalid_export_body', 'Le formulaire d’export Quiz Hunt est illisible.', 400)
    }

    const documentText = formData.get(DOCUMENT_FIELD)
    if (typeof documentText !== 'string') {
      return exportError('invalid_export_document', 'Le document Quiz Hunt est absent du formulaire.', 400)
    }

    let document: QuizHuntDocument
    try {
      document = readQuizHuntDocument(JSON.parse(documentText) as unknown)
    } catch (error) {
      return exportError('invalid_export_document', errorMessage(error), 400)
    }

    const mediaBytesById = new Map<MediaId, Uint8Array>()
    const mediaById = new Map(document.medias.map((media) => [media.id, media]))
    for (const [fieldName, value] of formData.entries()) {
      if (!fieldName.startsWith(MEDIA_FIELD_PREFIX)) continue
      const mediaId = fieldName.slice(MEDIA_FIELD_PREFIX.length)
      const media = mediaById.get(mediaId)
      if (media === undefined) return exportError('unknown_export_media', 'Le formulaire contient un média absent du document Quiz Hunt.', 400)
      if (!isFile(value)) return exportError('invalid_export_media', 'Un fichier média Quiz Hunt est invalide.', 400)
      if (value.size !== media.size) {
        return exportError('invalid_export_media_size', `La taille du média « ${media.name} » ne correspond pas au document.`, 400)
      }
      mediaBytesById.set(mediaId, new Uint8Array(await value.arrayBuffer()))
    }

    try {
      const zip = await this.exportPackage(writeQuizHuntDocument(document), mediaBytesById)
      const filename = `${downloadName(document.name)}.sighty.zip`
      const body = new ArrayBuffer(zip.byteLength)
      new Uint8Array(body).set(zip)
      return new Response(body, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (error) {
      return exportError('sighty_export_failed', errorMessage(error), 422)
    }
  }
}

/** Restricts download filenames to simple ASCII without changing the document name. */
function downloadName(documentName: string): string {
  return documentName.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'quiz-hunt'
}

/** Confirms one form value is a browser or Node File. */
function isFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File
}

/** Creates one structured API error for invalid submissions or package failures. */
function exportError(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status })
}

/** Converts unknown failures into a readable response message. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
