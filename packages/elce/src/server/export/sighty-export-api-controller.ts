import { LearningDocument } from '../../mods/learning/document/learning-document'
import type { LearningDocumentData } from '../../mods/learning/document/learning-document-types'
import type { MediaId } from '../../core/document/content-document-types'
import { exportElceSightyPackage } from '../../export/elce-scenario-exporter'

const DOCUMENT_FIELD = 'document'
const MEDIA_FIELD_PREFIX = 'media:'

export type ElceSightyPackageExporter = (
  document: LearningDocumentData,
  mediaBytesById: ReadonlyMap<MediaId, Uint8Array>,
) => Promise<Uint8Array>

/** Converts one browser document snapshot and its media into a downloadable package response. */
export class SightyExportApiController {
  private readonly exportPackage: ElceSightyPackageExporter

  /** Creates the endpoint over the existing Elcé-to-Sighty package adapter. */
  public constructor(exportPackage: ElceSightyPackageExporter = exportElceSightyPackage) {
    this.exportPackage = exportPackage
  }

  /** Validates an export form, invokes Sighty and returns the completed ZIP. */
  public async export(request: Request): Promise<Response> {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return exportError('invalid_export_body', 'Le formulaire d’export est illisible.', 400)
    }

    const documentText = formData.get(DOCUMENT_FIELD)
    if (typeof documentText !== 'string') {
      return exportError('invalid_export_document', 'Le document Elcé est absent du formulaire.', 400)
    }

    let document: LearningDocument
    try {
      document = LearningDocument.fromJSON(JSON.parse(documentText) as LearningDocumentData)
      if (!Array.isArray(document.medias)) throw new Error('La liste des médias est invalide.')
    } catch (error) {
      return exportError('invalid_export_document', errorMessage(error), 400)
    }

    const mediaBytesById = new Map<MediaId, Uint8Array>()
    const mediaById = new Map(document.medias.map((media) => [media.id, media]))
    for (const [fieldName, value] of formData.entries()) {
      if (!fieldName.startsWith(MEDIA_FIELD_PREFIX)) continue
      const mediaId = fieldName.slice(MEDIA_FIELD_PREFIX.length)
      const media = mediaById.get(mediaId)
      if (media === undefined) {
        return exportError('unknown_export_media', 'Le formulaire contient un média absent du document.', 400)
      }
      if (!isFile(value)) return exportError('invalid_export_media', 'Un fichier média est invalide.', 400)
      const file = value
      if (file.size !== media.size) {
        return exportError('invalid_export_media_size', `La taille du média « ${media.name} » ne correspond pas au document.`, 400)
      }
      mediaBytesById.set(mediaId, new Uint8Array(await file.arrayBuffer()))
    }

    try {
      const zip = await this.exportPackage(document.toJSON(), mediaBytesById)
      const filename = `${downloadName(document.data.name)}.sighty.zip`
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
  return documentName.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'elce'
}

/** Confirms one multipart form value is a browser or Node File. */
function isFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File
}

/** Creates one structured API error for invalid submissions or failed packaging. */
function exportError(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status })
}

/** Converts unknown failures into a readable response message. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
