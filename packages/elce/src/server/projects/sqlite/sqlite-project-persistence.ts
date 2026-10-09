import { rawSql } from 'remix/data-table'
import type { Database, DataManipulationResult } from 'remix/data-table'
import type { SqliteDatabase } from 'remix/data-table/sqlite'
import {
  BDC_TYPE,
  CHAPTER_TYPE,
  DEFAULT_EVALUATION_SETTINGS,
  EVALUATION_RESULT_BRANCH,
  QUESTION_DEFAULTS,
  SCENARIO_ENTRY_KIND,
} from '../../../config/document-config'
import type {
  Bdc,
  Chapter,
  ElceDocumentData,
  MediaMetadata,
  Page,
  RichTextDocument,
} from '../../../domain/document/document-types'
import { applyDocumentCommand, assertDocumentInvariants } from '../../../domain/commands/document-commands'
import { ElceDocument } from '../../../domain/document/document-model'
import type { ProjectPersistence, ProjectSummary, StoredProject } from '../project-persistence'
import type {
  CreateProjectResult,
  SaveProjectDocumentResult,
} from '../project-persistence'
import type { MediaPersistence, StoreMediaFileResult, StoredMediaResource } from '../../media/media-persistence'

type ProjectDatabase = Pick<Database<'sqlite'>, 'exec'>
type SqlRow = Record<string, unknown>

type NormalizedPlacement =
  | Readonly<{ kind: 'page'; pageId: string; position: number }>
  | Readonly<{
      kind: 'parent'
      parentBdcId: string
      position: number | null
      durationMs: number | null
      introTransitionRef: string | null
      outroTransitionRef: string | null
    }>
  | Readonly<{ kind: 'catalog'; position: number }>

/** Persists structured Elcé documents in the relational SQLite schema. */
export class SqliteProjectPersistence implements ProjectPersistence, MediaPersistence {
  private readonly database: SqliteDatabase

  /** Creates the repository around an already migrated Remix SQLite database. */
  public constructor(database: SqliteDatabase) {
    this.database = database
  }

  /** Lists project summaries without loading their content tables. */
  public async listProjects(): Promise<readonly ProjectSummary[]> {
    const result = await this.database.exec(rawSql(
      'SELECT project_id, name, revision FROM projects ORDER BY created_at, project_id',
    ))
    return (result.rows ?? []).map(projectSummaryFromRow)
  }

  /** Loads and reconstructs one project and its complete document in a read transaction. */
  public async findProject(projectId: string): Promise<StoredProject | null> {
    return this.database.transaction(async (transaction) => readStoredProject(transaction, projectId))
  }

  /** Loads one media row for its upload or file-read route. */
  public async findMediaFile(projectId: string, mediaId: string): Promise<StoredMediaResource | null> {
    const rows = await queryRows(this.database, `
      SELECT media_id, name, mime_type, size_bytes, storage_key, content_sha256
      FROM media_resources
      WHERE project_id = ? AND media_id = ?
    `, [projectId, mediaId])
    const row = rows[0]
    if (row === undefined) return null
    return {
      id: stringValue(row, 'media_id'),
      name: stringValue(row, 'name'),
      mimeType: stringValue(row, 'mime_type'),
      size: numberValue(row, 'size_bytes'),
      storageKey: nullableText(row, 'storage_key'),
      contentSha256: nullableText(row, 'content_sha256'),
    }
  }

  /** Lists media file keys that remain referenced by the relational document. */
  public async listMediaStorageKeys(): Promise<readonly string[]> {
    const rows = await queryRows(this.database, `
      SELECT storage_key
      FROM media_resources
      WHERE storage_key IS NOT NULL
    `)
    return rows.map((row) => stringValue(row, 'storage_key'))
  }

  /** Stores the file reference only after checking the target row and content identity. */
  public async storeMediaFile(
    projectId: string,
    mediaId: string,
    expectedSize: number,
    storageKey: string,
    contentSha256: string,
  ): Promise<StoreMediaFileResult> {
    return this.database.transaction(async (transaction) => {
      const rows = await queryRows(transaction, `
        SELECT size_bytes, storage_key, content_sha256
        FROM media_resources
        WHERE project_id = ? AND media_id = ?
      `, [projectId, mediaId])
      const row = rows[0]
      if (row === undefined) return { kind: 'media-not-found' }
      if (numberValue(row, 'size_bytes') !== expectedSize) return { kind: 'media-changed' }

      const existingHash = nullableText(row, 'content_sha256')
      const existingKey = nullableText(row, 'storage_key')
      if (existingKey !== null) {
        return existingHash === contentSha256
          ? { kind: 'already-stored' }
          : { kind: 'media-already-has-file' }
      }

      const duplicateRows = await queryRows(transaction, `
        SELECT media_id
        FROM media_resources
        WHERE project_id = ? AND size_bytes = ? AND content_sha256 = ? AND media_id <> ?
      `, [projectId, expectedSize, contentSha256, mediaId])
      if (duplicateRows[0] !== undefined) {
        return { kind: 'duplicate-content', existingMediaId: stringValue(duplicateRows[0], 'media_id') }
      }

      const updated = await queryRows(transaction, `
        UPDATE media_resources
        SET storage_key = ?, content_sha256 = ?
        WHERE project_id = ? AND media_id = ? AND storage_key IS NULL
        RETURNING media_id
      `, [storageKey, contentSha256, projectId, mediaId])
      return updated.length === 0 ? { kind: 'media-changed' } : { kind: 'stored' }
    })
  }

  /** Creates a project from its browser-owned v4 document unless its id already exists. */
  public async createProject(document: ElceDocument): Promise<CreateProjectResult> {
    return this.database.transaction(async (transaction) => {
      const now = new Date().toISOString()
      const inserted = await queryRows(transaction, `
        INSERT INTO projects (
          project_id, name, format_version, revision, created_at, updated_at,
          default_intro_transition_ref, default_outro_transition_ref
        ) VALUES (?, ?, ?, 0, ?, ?, ?, ?)
        ON CONFLICT(project_id) DO NOTHING
        RETURNING project_id
      `, [
        document.id,
        document.data.name,
        document.data.version,
        now,
        now,
        document.data.revelationDefaults.intro,
        document.data.revelationDefaults.outro,
      ])

      switch (inserted.length) {
        case 0:
          return { kind: 'already-exists' }
        default:
          await writeDocumentRows(transaction, document)
          return {
            kind: 'created',
            project: { id: document.id, name: document.data.name, revision: 0 },
          }
      }
    })
  }

  /** Renames a document through its existing domain command and increments its revision. */
  public async renameProject(projectId: string, name: string): Promise<ProjectSummary | null> {
    return this.database.transaction(async (transaction) => {
      const stored = await readStoredProject(transaction, projectId)
      if (stored === null) return null

      const document = applyDocumentCommand(stored.document, { type: 'document.rename', name })
      const updated = await queryRows(transaction, `
        UPDATE projects
        SET name = ?, revision = revision + 1, updated_at = ?
        WHERE project_id = ?
        RETURNING project_id, name, revision
      `, [document.data.name, new Date().toISOString(), projectId])

      return projectSummaryFromRow(requireRow(updated[0], 'Project update did not return a row'))
    })
  }

  /** Deletes one project and its relational document rows. */
  public async deleteProject(projectId: string): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const existing = await queryRows(transaction,
        'SELECT project_id FROM projects WHERE project_id = ?', [projectId])
      if (existing.length === 0) return false

      await clearDocumentRows(transaction, projectId)
      await queryRows(transaction, 'DELETE FROM media_resources WHERE project_id = ?', [projectId])
      await queryRows(transaction, 'DELETE FROM projects WHERE project_id = ?', [projectId])
      return true
    })
  }

  /** Replaces the current relational document only when the expected revision is current. */
  public async saveDocument(
    projectId: string,
    expectedRevision: number,
    document: ElceDocument,
  ): Promise<SaveProjectDocumentResult> {
    return this.database.transaction(async (transaction) => {
      const now = new Date().toISOString()
      const updated = await queryRows(transaction, `
        UPDATE projects
        SET name = ?, format_version = ?, revision = revision + 1, updated_at = ?,
            default_intro_transition_ref = ?, default_outro_transition_ref = ?
        WHERE project_id = ? AND revision = ?
        RETURNING project_id, name, revision
      `, [
        document.data.name,
        document.data.version,
        now,
        document.data.revelationDefaults.intro,
        document.data.revelationDefaults.outro,
        projectId,
        expectedRevision,
      ])

      switch (updated.length) {
        case 0: {
          const exists = await queryRows(transaction,
            'SELECT project_id FROM projects WHERE project_id = ?', [projectId])
          return exists.length === 0 ? { kind: 'not-found' } : { kind: 'revision-mismatch' }
        }
        default:
          await clearDocumentRows(transaction, projectId)
          await writeDocumentRows(transaction, document)
          return { kind: 'saved', project: projectSummaryFromRow(updated[0]!) }
      }
    })
  }
}

/** Reconstructs the project summary and the v4 document from normalized rows. */
async function readStoredProject(database: ProjectDatabase, projectId: string): Promise<StoredProject | null> {
  const projectRows = await queryRows(database, `
    SELECT project_id, name, format_version, revision,
           default_intro_transition_ref, default_outro_transition_ref
    FROM projects WHERE project_id = ?
  `, [projectId])
  if (projectRows.length === 0) return null

  const projectRow = projectRows[0]!
  if (numberValue(projectRow, 'format_version') !== 4) {
    throw new Error(`Version documentaire SQLite non prise en charge : ${String(projectRow.format_version)}`)
  }
  const document = await readDocument(database, projectRow)
  return {
    project: projectSummaryFromRow(projectRow),
    document,
  }
}

/** Reads the relational records and assembles their ElceDocument v4 value. */
async function readDocument(database: ProjectDatabase, projectRow: SqlRow): Promise<ElceDocument> {
  const projectId = stringValue(projectRow, 'project_id')
  const [chapterRows, pageRows, scenarioRows, catalogPageRows, mediaRows, blockRows, placementRows,
    sectionRows, questionRows, answerRows, resultRows, carouselRows, cardRows] = await Promise.all([
    queryRows(database, 'SELECT * FROM chapters WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM pages WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM scenario_entries WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM catalog_pages WHERE project_id = ? ORDER BY position', [projectId]),
    queryRows(database, 'SELECT * FROM media_resources WHERE project_id = ? ORDER BY position', [projectId]),
    queryRows(database, 'SELECT * FROM content_blocks WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM content_block_placements WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM sections WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM questions WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM question_answers WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM evaluation_result_branches WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM carousels WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM cards WHERE project_id = ?', [projectId]),
  ])

  const placementsByBlock = new Map(placementRows.map((row) => [stringValue(row, 'content_block_id'), row]))
  const sectionsByBlock = new Map(sectionRows.map((row) => [stringValue(row, 'content_block_id'), row]))
  const questionsByBlock = new Map(questionRows.map((row) => [stringValue(row, 'content_block_id'), row]))
  const carouselsByBlock = new Map(carouselRows.map((row) => [stringValue(row, 'content_block_id'), row]))
  const cardsByBlock = new Map(cardRows.map((row) => [stringValue(row, 'content_block_id'), row]))

  const chapters = chapterRows.map((row) => chapterFromRow(row, scenarioRows))
  const pages = pageRows.map((row) => pageFromRow(row, scenarioRows, placementRows))
  const bdcs = blockRows.map((row) => bdcFromRows(
    row,
    placementsByBlock,
    sectionsByBlock,
    questionsByBlock,
    answerRows,
    resultRows,
    carouselsByBlock,
    cardsByBlock,
    placementRows,
  ))
  const data: ElceDocumentData = {
    id: projectId,
    version: 4,
    name: stringValue(projectRow, 'name'),
    revelationDefaults: {
      intro: stringValue(projectRow, 'default_intro_transition_ref') as ElceDocumentData['revelationDefaults']['intro'],
      outro: stringValue(projectRow, 'default_outro_transition_ref') as ElceDocumentData['revelationDefaults']['outro'],
    },
    chapters,
    pages,
    scenarioEntries: scenarioRows
      .filter((row) => row.parent_chapter_id === null)
      .sort(byPosition)
      .map(scenarioEntryFromRow),
    catalogPageIds: catalogPageRows.map((row) => stringValue(row, 'page_id')),
    bdcs,
    catalogBdcIds: placementRows
      .filter((row) => row.page_id === null && row.parent_content_block_id === null)
      .sort(byPosition)
      .map((row) => stringValue(row, 'content_block_id')),
    medias: mediaRows.map(mediaFromRow),
  }

  const document = ElceDocument.fromJSON(data)
  assertDocumentInvariants(document)
  return document
}

/** Recreates one chapter and its ordered page references from scenario rows. */
function chapterFromRow(row: SqlRow, scenarioRows: readonly SqlRow[]): Chapter {
  const type = stringValue(row, 'chapter_type') as Chapter['type']
  const base: Chapter = {
    id: stringValue(row, 'chapter_id'),
    name: stringValue(row, 'name'),
    type,
    pageIds: scenarioRows
      .filter((entry) => entry.parent_chapter_id === stringValue(row, 'chapter_id'))
      .sort(byPosition)
      .map((entry) => stringValue(entry, 'page_id')),
  }

  switch (type) {
    case CHAPTER_TYPE.EVALUATION:
      return {
        ...base,
        evaluationThreshold: nullableNumber(row, 'evaluation_threshold') ?? DEFAULT_EVALUATION_SETTINGS.threshold,
        evaluationAttemptLimit: nullableNumber(row, 'evaluation_attempt_limit'),
        evaluationRetryScope: nullableText(row, 'evaluation_retry_scope') as Chapter['evaluationRetryScope']
          ?? DEFAULT_EVALUATION_SETTINGS.retryScope,
      }
    case CHAPTER_TYPE.STANDARD:
      return base
    default:
      return base
  }
}

/** Recreates a page, its scenario parent and its ordered direct BDCs. */
function pageFromRow(row: SqlRow, scenarioRows: readonly SqlRow[], placementRows: readonly SqlRow[]): Page {
  const pageId = stringValue(row, 'page_id')
  const scenarioEntry = scenarioRows.find((entry) => entry.page_id === pageId)
  return {
    id: pageId,
    name: stringValue(row, 'name'),
    type: stringValue(row, 'page_type') as Page['type'],
    chapterId: nullableText(scenarioEntry ?? {}, 'parent_chapter_id'),
    bdcIds: placementRows
      .filter((placement) => placement.page_id === pageId)
      .sort(byPosition)
      .map((placement) => stringValue(placement, 'content_block_id')),
  }
}

/** Recreates a BDC common record and its type-specific detail rows. */
function bdcFromRows(
  row: SqlRow,
  placementsByBlock: ReadonlyMap<string, SqlRow>,
  sectionsByBlock: ReadonlyMap<string, SqlRow>,
  questionsByBlock: ReadonlyMap<string, SqlRow>,
  answerRows: readonly SqlRow[],
  resultRows: readonly SqlRow[],
  carouselsByBlock: ReadonlyMap<string, SqlRow>,
  cardsByBlock: ReadonlyMap<string, SqlRow>,
  allPlacementRows: readonly SqlRow[],
): Bdc {
  const id = stringValue(row, 'content_block_id')
  const placement = placementsByBlock.get(id) ?? {}
  const type = stringValue(row, 'content_block_type') as Bdc['type']
  const section = sectionsByBlock.get(id)
  const question = questionsByBlock.get(id)
  const carousel = carouselsByBlock.get(id)
  const card = cardsByBlock.get(id)

  return {
    id,
    type,
    presetId: stringValue(row, 'preset_id'),
    pageId: nullableText(placement, 'page_id'),
    parentBdcId: nullableText(placement, 'parent_content_block_id'),
    section: section === undefined ? null : {
      title: nullableText(section, 'title') ?? '',
      markup: stringValue(section, 'markup_html'),
      content: JSON.parse(stringValue(section, 'content_json')) as RichTextDocument,
      revelation: {
        intro: nullableText(section, 'default_intro_transition_ref') as NonNullable<Bdc['section']>['revelation']['intro'],
        outro: nullableText(section, 'default_outro_transition_ref') as NonNullable<Bdc['section']>['revelation']['outro'],
      },
    },
    question: question === undefined ? null : {
      mediaId: nullableText(question, 'media_id'),
      type: stringValue(question, 'question_type') as NonNullable<Bdc['question']>['type'],
      title: nullableText(question, 'title') ?? '',
      prompt: stringValue(question, 'prompt'),
      validationLabel: nullableText(question, 'validation_label') ?? QUESTION_DEFAULTS.VALIDATE_LABEL,
      answers: answerRows
        .filter((answer) => answer.question_content_block_id === id)
        .sort(byPosition)
        .map((answer) => ({
          id: stringValue(answer, 'answer_id'),
          label: stringValue(answer, 'label'),
          correct: numberValue(answer, 'is_correct') !== 0,
        })),
    },
    evaluationResult: resultContentFromRows(id, resultRows),
    carousel: carousel === undefined ? null : {
      defaultViewDurationMs: numberValue(carousel, 'default_view_duration_ms'),
      playbackMode: stringValue(carousel, 'playback_mode') as NonNullable<Bdc['carousel']>['playbackMode'],
      ...(nullableNumber(carousel, 'repeat_count') === null ? {} : { repeatCount: numberValue(carousel, 'repeat_count') }),
      aspectRatio: {
        width: numberValue(carousel, 'aspect_ratio_width'),
        height: numberValue(carousel, 'aspect_ratio_height'),
      },
      revelation: {
        intro: nullableText(carousel, 'default_intro_transition_ref') as NonNullable<Bdc['carousel']>['revelation']['intro'],
        outro: nullableText(carousel, 'default_outro_transition_ref') as NonNullable<Bdc['carousel']>['revelation']['outro'],
      },
      cards: allPlacementRows
        .filter((entry) => entry.parent_content_block_id === id)
        .sort(byPosition)
        .map((entry) => ({
          bdcId: stringValue(entry, 'content_block_id'),
          durationMs: nullableNumber(entry, 'duration_ms'),
          introTransitionRef: nullableText(entry, 'intro_transition_ref') as NonNullable<Bdc['carousel']>['cards'][number]['introTransitionRef'],
          outroTransitionRef: nullableText(entry, 'outro_transition_ref') as NonNullable<Bdc['carousel']>['cards'][number]['outroTransitionRef'],
        })),
    },
    card: card === undefined ? null : {
      mediaId: nullableText(card, 'media_id'),
      overline: nullableText(card, 'overline') ?? '',
      title: nullableText(card, 'title') ?? '',
      description: nullableText(card, 'description') ?? '',
      message: nullableText(card, 'message') ?? '',
      note: nullableText(card, 'note') ?? '',
      caption: nullableText(card, 'caption') ?? '',
      imagePosition: stringValue(card, 'image_position') as NonNullable<Bdc['card']>['imagePosition'],
      imageFit: stringValue(card, 'image_fit') as NonNullable<Bdc['card']>['imageFit'],
    },
  }
}

/** Reconstructs both result branches when a result BDC has persisted rows. */
function resultContentFromRows(id: string, rows: readonly SqlRow[]): Bdc['evaluationResult'] {
  const branches = rows.filter((row) => row.result_content_block_id === id)
  const success = branches.find((row) => row.branch === 'success')
  const failure = branches.find((row) => row.branch === 'failure')
  if (success === undefined || failure === undefined) return null

  return {
    success: {
      message: nullableText(success, 'message') ?? '',
      action: nullableText(success, 'action') as NonNullable<Bdc['evaluationResult']>['success']['action'],
    },
    failure: {
      message: nullableText(failure, 'message') ?? '',
      action: nullableText(failure, 'action') as NonNullable<Bdc['evaluationResult']>['failure']['action'],
    },
  }
}

/** Recreates the model media record without exposing server storage metadata. */
function mediaFromRow(row: SqlRow): MediaMetadata {
  return {
    id: stringValue(row, 'media_id'),
    name: stringValue(row, 'name'),
    mimeType: stringValue(row, 'mime_type'),
    size: numberValue(row, 'size_bytes'),
    caption: nullableText(row, 'media_caption') ?? '',
  }
}

/** Writes every document-owned table while preserving server-owned media keys. */
async function writeDocumentRows(database: ProjectDatabase, document: ElceDocument): Promise<void> {
  await synchronizeMediaRows(database, document.id, document.medias)

  for (const chapter of document.chapters) await insertChapter(database, document.id, chapter)
  for (const page of document.pages) await insertPage(database, document.id, page)
  await insertScenarioRows(database, document)
  await insertCatalogPages(database, document)
  for (const bdc of document.bdcs) {
    await queryRows(database,
      'INSERT INTO content_blocks (project_id, content_block_id, content_block_type, preset_id) VALUES (?, ?, ?, ?)',
      [document.id, bdc.id, bdc.type, bdc.presetId])
  }
  for (const bdc of document.bdcs) await insertBdcPlacement(database, document, bdc)
  for (const bdc of document.bdcs) await insertBdcDetail(database, document.id, bdc)
}

/** Inserts chapter fields and maps evaluation defaults to the chapter row. */
async function insertChapter(database: ProjectDatabase, projectId: string, chapter: Chapter): Promise<void> {
  const isEvaluation = chapter.type === CHAPTER_TYPE.EVALUATION
  await queryRows(database, `
    INSERT INTO chapters (
      project_id, chapter_id, name, chapter_type,
      evaluation_threshold, evaluation_attempt_limit, evaluation_retry_scope
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    projectId,
    chapter.id,
    chapter.name,
    chapter.type,
    isEvaluation ? chapter.evaluationThreshold ?? DEFAULT_EVALUATION_SETTINGS.threshold : null,
    isEvaluation ? chapter.evaluationAttemptLimit ?? null : null,
    isEvaluation ? chapter.evaluationRetryScope ?? DEFAULT_EVALUATION_SETTINGS.retryScope : null,
  ])
}

/** Inserts a page identity; its scenario and BDC order are stored separately. */
async function insertPage(database: ProjectDatabase, projectId: string, page: Page): Promise<void> {
  await queryRows(database,
    'INSERT INTO pages (project_id, page_id, name, page_type) VALUES (?, ?, ?, ?)',
    [projectId, page.id, page.name, page.type])
}

/** Persists root scenario order and each chapter’s page order in one relation. */
async function insertScenarioRows(database: ProjectDatabase, document: ElceDocument): Promise<void> {
  for (const [position, entry] of document.data.scenarioEntries.entries()) {
    switch (entry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE:
        await insertScenarioEntry(database, document.id, null, entry.pageId, null, position)
        break
      case SCENARIO_ENTRY_KIND.CHAPTER:
        await insertScenarioEntry(database, document.id, null, null, entry.chapterId, position)
        break
    }
  }

  for (const chapter of document.chapters) {
    for (const [position, pageId] of chapter.pageIds.entries()) {
      await insertScenarioEntry(database, document.id, chapter.id, pageId, null, position)
    }
  }
}

/** Inserts one ordered page or chapter membership in the scenario. */
async function insertScenarioEntry(
  database: ProjectDatabase,
  projectId: string,
  parentChapterId: string | null,
  pageId: string | null,
  chapterId: string | null,
  position: number,
): Promise<void> {
  await queryRows(database, `
    INSERT INTO scenario_entries (project_id, parent_chapter_id, page_id, chapter_id, position)
    VALUES (?, ?, ?, ?, ?)
  `, [projectId, parentChapterId, pageId, chapterId, position])
}

/** Persists pages that are stored outside the scenario in catalogue order. */
async function insertCatalogPages(database: ProjectDatabase, document: ElceDocument): Promise<void> {
  for (const [position, pageId] of document.catalogPageIds.entries()) {
    await queryRows(database,
      'INSERT INTO catalog_pages (project_id, page_id, position) VALUES (?, ?, ?)',
      [document.id, pageId, position])
  }
}

/** Upserts document media metadata while keeping upload-owned keys and hashes. */
async function synchronizeMediaRows(
  database: ProjectDatabase,
  projectId: string,
  medias: readonly MediaMetadata[],
): Promise<void> {
  const incomingIds = new Set(medias.map((media) => media.id))
  const existingRows = await queryRows(database,
    'SELECT media_id FROM media_resources WHERE project_id = ?', [projectId])

  for (const row of existingRows) {
    const mediaId = stringValue(row, 'media_id')
    if (!incomingIds.has(mediaId)) {
      await queryRows(database,
        'DELETE FROM media_resources WHERE project_id = ? AND media_id = ?',
        [projectId, mediaId])
    }
  }

  for (const [position, media] of medias.entries()) {
    await queryRows(database, `
      INSERT INTO media_resources (
        project_id, media_id, name, mime_type, size_bytes, media_caption, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, media_id) DO UPDATE SET
        name = excluded.name,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        media_caption = excluded.media_caption,
        position = excluded.position
    `, [projectId, media.id, media.name, media.mimeType, media.size, nullableTextValue(media.caption), position])
  }
}

/** Inserts one BDC placement row using its page, parent, or catalogue context. */
async function insertBdcPlacement(
  database: ProjectDatabase,
  document: ElceDocument,
  bdc: Bdc,
): Promise<void> {
  const placement = normalizePlacement(document, bdc)
  switch (placement.kind) {
    case 'page':
      await insertPlacementRow(database, document.id, bdc.id, placement.pageId, null,
        placement.position, null, null, null)
      return
    case 'parent':
      await insertPlacementRow(database, document.id, bdc.id, null, placement.parentBdcId,
        placement.position, placement.durationMs, placement.introTransitionRef, placement.outroTransitionRef)
      return
    case 'catalog':
      await insertPlacementRow(database, document.id, bdc.id, null, null,
        placement.position, null, null, null)
      return
  }
}

/** Converts the document’s parallel arrays into one discriminated placement. */
function normalizePlacement(document: ElceDocument, bdc: Bdc): NormalizedPlacement {
  if (bdc.pageId !== null) {
    const page = document.pages.find((candidate) => candidate.id === bdc.pageId)
    if (page === undefined) throw new Error(`Page de placement absente : ${bdc.pageId}`)
    const position = page.bdcIds.indexOf(bdc.id)
    if (position < 0) throw new Error(`BDC absent de l’ordre de page : ${bdc.id}`)
    return { kind: 'page', pageId: page.id, position }
  }

  if (bdc.parentBdcId !== null) {
    const parent = document.bdcs.find((candidate) => candidate.id === bdc.parentBdcId)
    if (parent === undefined) throw new Error(`BDC parent absent : ${bdc.parentBdcId}`)
    switch (parent.type) {
      case BDC_TYPE.CAROUSEL: {
        const entryIndex = parent.carousel?.cards.findIndex((entry) => entry.bdcId === bdc.id) ?? -1
        const entry = parent.carousel?.cards[entryIndex]
        if (entryIndex < 0 || entry === undefined) throw new Error(`Carte absente de son Carousel : ${bdc.id}`)
        return {
          kind: 'parent',
          parentBdcId: parent.id,
          position: entryIndex,
          durationMs: entry.durationMs,
          introTransitionRef: entry.introTransitionRef,
          outroTransitionRef: entry.outroTransitionRef,
        }
      }
      case BDC_TYPE.SECTION:
      case BDC_TYPE.QUESTION:
      case BDC_TYPE.EVALUATION_RESULT:
      case BDC_TYPE.CARD:
        return {
          kind: 'parent',
          parentBdcId: parent.id,
          position: null,
          durationMs: null,
          introTransitionRef: null,
          outroTransitionRef: null,
        }
    }
  }

  const position = document.data.catalogBdcIds.indexOf(bdc.id)
  if (position < 0) throw new Error(`BDC sans emplacement ni entrée catalogue : ${bdc.id}`)
  return { kind: 'catalog', position }
}

/** Inserts the common BDC placement columns. */
async function insertPlacementRow(
  database: ProjectDatabase,
  projectId: string,
  bdcId: string,
  pageId: string | null,
  parentBdcId: string | null,
  position: number | null,
  durationMs: number | null,
  introTransitionRef: string | null,
  outroTransitionRef: string | null,
): Promise<void> {
  await queryRows(database, `
    INSERT INTO content_block_placements (
      project_id, content_block_id, page_id, parent_content_block_id, position,
      duration_ms, intro_transition_ref, outro_transition_ref
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [projectId, bdcId, pageId, parentBdcId, position, durationMs, introTransitionRef, outroTransitionRef])
}

/** Inserts the detail row matching one BDC type. */
async function insertBdcDetail(database: ProjectDatabase, projectId: string, bdc: Bdc): Promise<void> {
  switch (bdc.type) {
    case BDC_TYPE.SECTION: {
      const section = requireValue(bdc.section, `Section manquante : ${bdc.id}`)
      await queryRows(database, `
        INSERT INTO sections (
          project_id, content_block_id, title, content_json, markup_html,
          default_intro_transition_ref, default_outro_transition_ref
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [projectId, bdc.id, nullableTextValue(section.title), JSON.stringify(section.content), section.markup,
        section.revelation.intro, section.revelation.outro])
      return
    }
    case BDC_TYPE.QUESTION: {
      const question = requireValue(bdc.question, `Question manquante : ${bdc.id}`)
      await queryRows(database, `
        INSERT INTO questions (
          project_id, content_block_id, media_id, question_type, title, prompt, validation_label
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [projectId, bdc.id, question.mediaId, question.type, nullableTextValue(question.title), question.prompt,
        question.validationLabel ?? QUESTION_DEFAULTS.VALIDATE_LABEL])
      for (const [position, answer] of question.answers.entries()) {
        await queryRows(database, `
          INSERT INTO question_answers (
            project_id, question_content_block_id, answer_id, position, label, is_correct
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [projectId, bdc.id, answer.id, position, answer.label, answer.correct ? 1 : 0])
      }
      return
    }
    case BDC_TYPE.EVALUATION_RESULT: {
      const result = requireValue(bdc.evaluationResult, `Résultat manquant : ${bdc.id}`)
      const branches = [
        { branch: EVALUATION_RESULT_BRANCH.SUCCESS, content: result.success },
        { branch: EVALUATION_RESULT_BRANCH.FAILURE, content: result.failure },
      ] as const
      for (const { branch, content } of branches) {
        await queryRows(database, `
          INSERT INTO evaluation_result_branches (
            project_id, result_content_block_id, branch, message, action
          ) VALUES (?, ?, ?, ?, ?)
        `, [projectId, bdc.id, branch, nullableTextValue(content.message), content.action])
      }
      return
    }
    case BDC_TYPE.CAROUSEL: {
      const carousel = requireValue(bdc.carousel, `Carousel manquant : ${bdc.id}`)
      await queryRows(database, `
        INSERT INTO carousels (
          project_id, content_block_id, default_view_duration_ms, playback_mode,
          repeat_count, aspect_ratio_width, aspect_ratio_height,
          default_intro_transition_ref, default_outro_transition_ref
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [projectId, bdc.id, carousel.defaultViewDurationMs, carousel.playbackMode,
        carousel.repeatCount ?? null, carousel.aspectRatio.width, carousel.aspectRatio.height,
        carousel.revelation.intro, carousel.revelation.outro])
      return
    }
    case BDC_TYPE.CARD: {
      const card = requireValue(bdc.card, `Carte manquante : ${bdc.id}`)
      await queryRows(database, `
        INSERT INTO cards (
          project_id, content_block_id, media_id, overline, title, description,
          message, note, caption, image_position, image_fit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [projectId, bdc.id, card.mediaId, nullableTextValue(card.overline), nullableTextValue(card.title),
        nullableTextValue(card.description), nullableTextValue(card.message), nullableTextValue(card.note),
        nullableTextValue(card.caption), card.imagePosition, card.imageFit])
      return
    }
  }
}

/** Removes document rows in foreign-key order while retaining project/media identities. */
async function clearDocumentRows(database: ProjectDatabase, projectId: string): Promise<void> {
  await queryRows(database, 'DELETE FROM content_block_placements WHERE project_id = ?', [projectId])
  await queryRows(database, 'DELETE FROM content_blocks WHERE project_id = ?', [projectId])
  await queryRows(database, 'DELETE FROM scenario_entries WHERE project_id = ?', [projectId])
  await queryRows(database, 'DELETE FROM catalog_pages WHERE project_id = ?', [projectId])
  await queryRows(database, 'DELETE FROM pages WHERE project_id = ?', [projectId])
  await queryRows(database, 'DELETE FROM chapters WHERE project_id = ?', [projectId])
}

/** Returns all rows from a parameterized Remix SQL statement. */
async function queryRows(
  database: ProjectDatabase,
  text: string,
  values: unknown[] = [],
): Promise<SqlRow[]> {
  const result = await database.exec(rawSql(text, values)) as DataManipulationResult
  return result.rows ?? []
}

/** Restores one root scenario entry as a page or chapter reference. */
function scenarioEntryFromRow(row: SqlRow): ElceDocumentData['scenarioEntries'][number] {
  switch (row.chapter_id) {
    case null:
      return { kind: SCENARIO_ENTRY_KIND.PAGE, pageId: stringValue(row, 'page_id') }
    default:
      return { kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId: stringValue(row, 'chapter_id') }
  }
}

/** Returns a project list item from its SQL columns. */
function projectSummaryFromRow(row: SqlRow): ProjectSummary {
  return {
    id: stringValue(row, 'project_id'),
    name: stringValue(row, 'name'),
    revision: numberValue(row, 'revision'),
  }
}

/** Reads a required string field from one SQLite result row. */
function stringValue(row: SqlRow, key: string): string {
  const value = row[key]
  if (typeof value !== 'string') throw new Error(`Valeur texte invalide en base : ${key}`)
  return value
}

/** Reads an optional string field and normalizes SQL NULL. */
function nullableText(row: SqlRow, key: string): string | null {
  const value = row[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error(`Valeur texte invalide en base : ${key}`)
  return value
}

/** Converts an empty model string to SQL NULL for optional text columns. */
function nullableTextValue(value: string): string | null {
  return value.length === 0 ? null : value
}

/** Reads an optional numeric SQLite field and normalizes SQL NULL. */
function nullableNumber(row: SqlRow, key: string): number | null {
  const value = row[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' && typeof value !== 'bigint') throw new Error(`Valeur numérique invalide en base : ${key}`)
  return Number(value)
}

/** Reads a required numeric SQLite field. */
function numberValue(row: SqlRow, key: string): number {
  const value = nullableNumber(row, key)
  if (value === null) throw new Error(`Valeur numérique absente en base : ${key}`)
  return value
}

/** Sorts rows by their stored sequence position. */
function byPosition(left: SqlRow, right: SqlRow): number {
  return numberValue(left, 'position') - numberValue(right, 'position')
}

/** Requires a matching BDC detail record during relational writing. */
function requireValue<Value>(value: Value | null | undefined, message: string): Value {
  if (value === null || value === undefined) throw new Error(message)
  return value
}

/** Requires a query result row when an UPDATE must return the changed project. */
function requireRow(row: SqlRow | undefined, message: string): SqlRow {
  if (row === undefined) throw new Error(message)
  return row
}
