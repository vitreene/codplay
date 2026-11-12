import { rawSql } from 'remix/data-table'
import type { Database, DataManipulationResult } from 'remix/data-table'
import type { SqliteDatabase } from 'remix/data-table/sqlite'
import { PROJECT_EDIT_LEASE_MS } from '../../../../../config/api-config'
import { BDC_TYPE } from '../../../learning-definition'
import { CHAPTER_TYPE, SCENARIO_ENTRY_KIND } from '../../../organization/learning-organization-config'
import {
  DEFAULT_EVALUATION_SETTINGS,
  EVALUATION_RESULT_BRANCH,
} from '../../../evaluation/learning-evaluation-config'
import type { LearningBdc, LearningChapter, LearningDocumentData, LearningPage } from '../../../document/learning-document-types'
import type { MediaMetadata } from '../../../../../core/document/content-document-types'
import { CONTENT_BLOCKS_SQLITE_SELECT, CONTENT_BLOCK_PLACEMENTS_SQLITE_SELECT, contentBlockFromSqliteRows, prepareContentBlockInsert, prepareContentBlockPlacementInsert } from '../../../../../resources/document/persistence/sqlite/content-block-queries'
import { decodeSqliteText as decodeSqlText, encodeNullableSqliteText as nullableSerializedText } from '../../../../../resources/document/persistence/sqlite/sqlite-text-values'
import type { SqliteQuery, SqliteRow } from '../../../../../core/persistence/sqlite/sqlite-query-types'
import {
  sqliteNullableNumber as nullableNumber,
  sqliteNullableText as nullableText,
  sqliteNumberValue as numberValue,
  sqliteStringValue as stringValue,
} from '../../../../../core/persistence/sqlite/sqlite-query-types'
import { CARD_SQLITE_SELECT, cardContentFromSqliteRow, prepareCardInsert } from '../../../../../resources/bdcs/card/persistence/sqlite/card-queries'
import { CAROUSEL_SQLITE_SELECT, carouselContentFromSqliteRows, prepareCarouselInsert } from '../../../../../resources/bdcs/carousel/persistence/sqlite/carousel-queries'
import { QUESTION_ANSWERS_SQLITE_SELECT, QUESTION_SQLITE_SELECT, prepareQuestionInsert, questionContentFromSqliteRows } from '../../../../../resources/bdcs/question/persistence/sqlite/question-queries'
import { SECTION_SQLITE_SELECT, prepareSectionInsert, sectionContentFromSqliteRow } from '../../../../../resources/bdcs/section/persistence/sqlite/section-queries'
import { STATISTICAL_GRAPH_SQLITE_SELECT, prepareStatisticalGraphInsert, statisticalGraphContentFromSqliteRow } from '../../../../../resources/bdcs/statistical-graph/persistence/sqlite/statistical-graph-queries'
import { INITIAL_PROJECT_TEST_STATE, type ProjectTestState, type VersionedProjectTestState } from '../../../reading/learning-test-state-types'
import type { AppearanceSettings } from '../../../../../config/appearance/appearance-types'
import type { ScenarioEntry } from '../../../organization/learning-scenario-entry-types'
import { learningDocumentCommandService } from '../../../commands/learning-command-composition'
import { LearningDocument } from '../../../document/learning-document'
import type { AcquireProjectEditResult, DeleteProjectResult, EditProjectResult, ProjectEditGrant, ProjectPersistence, ProjectSummary, StoredProject } from '../../../../../core/server/projects/project-persistence'
import type {
  CreateProjectResult,
  SaveProjectDocumentResult,
} from '../../../../../core/server/projects/project-persistence'
import type { SaveLearningTestStateResult, LearningTestStatePersistence } from '../learning-test-state-persistence'
import type { MediaPersistence, StoreMediaFileResult, StoredMediaResource } from '../../../../../core/server/media/media-persistence'
import { findSqliteMediaFile, listSqliteMediaStorageKeys } from '../../../../../core/server/media/sqlite-media-queries'
import { publishSqliteMediaFile } from '../../../../../core/server/media/sqlite-media-publication'
import {
  acquireSqliteProjectEditAccess,
  getSqliteProjectEditGrantState,
  hasSqliteProjectEditAccess,
  releaseSqliteProjectEditAccess,
  renewSqliteProjectEditAccess,
} from '../../../../../core/server/projects/sqlite-project-edit-access'

type ProjectDatabase = Pick<Database<'sqlite'>, 'exec'>
type SqlRow = SqliteRow

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
export class LearningSqliteProjectPersistence implements ProjectPersistence<LearningDocument>, LearningTestStatePersistence, MediaPersistence {
  private readonly database: SqliteDatabase

  /** Creates the repository around an already migrated Remix SQLite database. */
  public constructor(database: SqliteDatabase) {
    this.database = database
  }

  /** Reserves one project atomically and reuses a live grant for the same page. */
  public async acquireEditAccess(projectId: string, pageId: string, force = false): Promise<AcquireProjectEditResult> {
    return this.database.transaction((transaction) =>
      acquireSqliteProjectEditAccess(transaction, 'learning', projectId, pageId, force))
  }

  /** Reports whether the exact page grant still owns a project. */
  public async hasEditAccess(projectId: string, grant: ProjectEditGrant): Promise<boolean> {
    return this.database.transaction((transaction) =>
      hasSqliteProjectEditAccess(transaction, 'learning', projectId, grant))
  }

  /** Renews the exact current grant, including an expired grant not yet replaced. */
  public async renewEditAccess(projectId: string, grant: ProjectEditGrant): Promise<boolean> {
    return this.database.transaction((transaction) =>
      renewSqliteProjectEditAccess(transaction, 'learning', projectId, grant))
  }

  /** Releases only the exact current grant, preserving a later owner's right. */
  public async releaseEditAccess(projectId: string, grant: ProjectEditGrant): Promise<boolean> {
    return this.database.transaction((transaction) =>
      releaseSqliteProjectEditAccess(transaction, 'learning', projectId, grant))
  }

  /** Lists project summaries without loading their content tables. */
  public async listProjects(): Promise<readonly ProjectSummary[]> {
    const result = await this.database.exec(rawSql(
      "SELECT project_id, name, revision FROM projects WHERE mod_key = 'learning' ORDER BY created_at, project_id",
    ))
    return (result.rows ?? []).map(projectSummaryFromRow)
  }

  /** Loads and reconstructs one project and its complete document in a read transaction. */
  public async findProject(projectId: string): Promise<StoredProject<LearningDocument> | null> {
    return this.database.transaction(async (transaction) => readStoredProject(transaction, projectId))
  }

  /** Loads one media row for its upload or file-read route. */
  public async findMediaFile(projectId: string, mediaId: string): Promise<StoredMediaResource | null> {
    return findSqliteMediaFile(this.database, 'learning', projectId, mediaId)
  }

  /** Lists media file keys that remain referenced by the relational document. */
  public async listMediaStorageKeys(): Promise<readonly string[]> {
    return listSqliteMediaStorageKeys(this.database)
  }

  /** Stores the file reference only after checking the target row and content identity. */
  public async storeMediaFile(
    projectId: string,
    mediaId: string,
    expectedSize: number,
    storageKey: string,
    contentSha256: string,
    grant: ProjectEditGrant,
  ): Promise<StoreMediaFileResult> {
    return this.database.transaction((transaction) => publishSqliteMediaFile(
      transaction, 'learning', projectId, mediaId, expectedSize, storageKey, contentSha256, grant,
    ))
  }

  /** Creates a project from its browser-owned Learning document unless its id already exists. */
  public async createProject(document: LearningDocument): Promise<CreateProjectResult> {
    return this.database.transaction(async (transaction) => {
      const now = new Date().toISOString()
      const inserted = await queryRows(transaction, `
        INSERT INTO projects (
          project_id, name, format_version, mod_key, revision, created_at, updated_at,
          default_intro_transition_ref, default_outro_transition_ref,
          summary_json, profile_json, appearance_json, custom_appearance_colors_json
        ) VALUES (?, ?, ?, 'learning', 0, ?, ?, ?, ?, ?, ?, ?, ?)
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
        JSON.stringify(document.data.summary),
        JSON.stringify(document.data.profile),
        serializeOptionalJson(document.data.appearance),
        JSON.stringify(document.data.customAppearanceColors),
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
  public async renameProject(projectId: string, name: string, grant: ProjectEditGrant): Promise<EditProjectResult> {
    return this.database.transaction(async (transaction) => {
      const access = await getSqliteProjectEditGrantState(transaction, 'learning', projectId, grant)
      if (access === 'not-found') return { kind: 'not-found' }
      if (access === 'lost') return { kind: 'edit-access-lost' }
      const stored = await readStoredProject(transaction, projectId)
      if (stored === null) return { kind: 'not-found' }

      const document = learningDocumentCommandService.applyCommand(stored.document, { type: 'document.rename', name })
      const now = Date.now()
      const updated = await queryRows(transaction, `
        UPDATE projects
        SET name = ?, revision = revision + 1, updated_at = ?, edit_lease_expires_at = ?
        WHERE project_id = ? AND mod_key = 'learning'
        RETURNING project_id, name, revision
      `, [document.data.name, new Date(now).toISOString(), now + PROJECT_EDIT_LEASE_MS, projectId])

      return { kind: 'updated', project: projectSummaryFromRow(requireRow(updated[0], 'Project update did not return a row')) }
    })
  }

  /** Deletes one project and its relational document rows. */
  public async deleteProject(projectId: string, grant: ProjectEditGrant): Promise<DeleteProjectResult> {
    return this.database.transaction(async (transaction) => {
      const access = await getSqliteProjectEditGrantState(transaction, 'learning', projectId, grant)
      if (access === 'not-found') return 'not-found'
      if (access === 'lost') return 'edit-access-lost'

      await clearDocumentRows(transaction, projectId)
      await queryRows(transaction, 'DELETE FROM media_resources WHERE project_id = ?', [projectId])
      await queryRows(transaction, "DELETE FROM projects WHERE project_id = ? AND mod_key = 'learning'", [projectId])
      return 'deleted'
    })
  }

  /** Replaces the current relational document only when the expected revision is current. */
  public async saveDocument(
    projectId: string,
    expectedRevision: number,
    document: LearningDocument,
    grant: ProjectEditGrant,
  ): Promise<SaveProjectDocumentResult> {
    return this.database.transaction(async (transaction) => {
      const access = await getSqliteProjectEditGrantState(transaction, 'learning', projectId, grant)
      if (access === 'not-found') return { kind: 'not-found' }
      if (access === 'lost') return { kind: 'edit-access-lost' }
      const now = Date.now()
      const updated = await queryRows(transaction, `
        UPDATE projects
        SET name = ?, format_version = ?, revision = revision + 1, updated_at = ?,
            edit_lease_expires_at = ?,
            default_intro_transition_ref = ?, default_outro_transition_ref = ?,
            summary_json = ?, profile_json = ?, appearance_json = ?, custom_appearance_colors_json = ?
        WHERE project_id = ? AND revision = ? AND mod_key = 'learning'
        RETURNING project_id, name, revision
      `, [
        document.data.name,
        document.data.version,
        new Date(now).toISOString(),
        now + PROJECT_EDIT_LEASE_MS,
        document.data.revelationDefaults.intro,
        document.data.revelationDefaults.outro,
        JSON.stringify(document.data.summary),
        JSON.stringify(document.data.profile),
        serializeOptionalJson(document.data.appearance),
        JSON.stringify(document.data.customAppearanceColors),
        projectId,
        expectedRevision,
      ])

      switch (updated.length) {
        case 0: {
          const exists = await queryRows(transaction,
            "SELECT project_id FROM projects WHERE project_id = ? AND mod_key = 'learning'", [projectId])
          return exists.length === 0 ? { kind: 'not-found' } : { kind: 'revision-mismatch' }
        }
        default:
          await clearDocumentRows(transaction, projectId)
          await writeDocumentRows(transaction, document)
          return { kind: 'saved', project: projectSummaryFromRow(updated[0]!) }
      }
    })
  }

  /** Reads the separate author-preview state with its own revision. */
  public async readTestState(projectId: string): Promise<VersionedProjectTestState | null> {
    const projects = await queryRows(this.database, "SELECT project_id FROM projects WHERE project_id = ? AND mod_key = 'learning'", [projectId])
    if (projects.length === 0) return null
    const rows = await queryRows(this.database,
      'SELECT revision, state_json FROM project_test_states WHERE project_id = ?', [projectId])
    const row = rows[0]
    if (row === undefined) return { state: INITIAL_PROJECT_TEST_STATE, revision: 0 }
    return {
      state: parseJsonColumn<ProjectTestState>(row, 'state_json'),
      revision: numberValue(row, 'revision'),
    }
  }

  /** Saves author-preview state with an atomic compare-and-swap revision check. */
  public async saveTestState(
    projectId: string,
    expectedRevision: number,
    state: ProjectTestState,
  ): Promise<SaveLearningTestStateResult> {
    return this.database.transaction(async (transaction) => {
      const projects = await queryRows(transaction, "SELECT project_id FROM projects WHERE project_id = ? AND mod_key = 'learning'", [projectId])
      if (projects.length === 0) return { kind: 'not-found' }
      const rows = await queryRows(transaction,
        'SELECT revision FROM project_test_states WHERE project_id = ?', [projectId])
      const currentRevision = rows[0] === undefined ? 0 : numberValue(rows[0], 'revision')
      if (currentRevision !== expectedRevision) return { kind: 'revision-mismatch' }

      const revision = currentRevision + 1
      const updatedAt = new Date().toISOString()
      if (rows[0] === undefined) {
        await queryRows(transaction, `
          INSERT INTO project_test_states (project_id, revision, state_json, updated_at)
          VALUES (?, ?, ?, ?)
        `, [projectId, revision, JSON.stringify(state), updatedAt])
      } else {
        await queryRows(transaction, `
          UPDATE project_test_states SET revision = ?, state_json = ?, updated_at = ?
          WHERE project_id = ? AND revision = ?
        `, [revision, JSON.stringify(state), updatedAt, projectId, expectedRevision])
      }
      return { kind: 'saved', value: { state, revision } }
    })
  }
}

/** Reconstructs the project summary and the current document from normalized rows. */
async function readStoredProject(database: ProjectDatabase, projectId: string): Promise<StoredProject<LearningDocument> | null> {
  const projectRows = await queryRows(database, `
    SELECT project_id, name, format_version, revision,
           default_intro_transition_ref, default_outro_transition_ref, summary_json, profile_json,
           appearance_json, custom_appearance_colors_json
    FROM projects WHERE project_id = ?
      AND mod_key = 'learning'
  `, [projectId])
  if (projectRows.length === 0) return null

  const projectRow = projectRows[0]!
  const version = numberValue(projectRow, 'format_version')
  if (version !== 7 && version !== 8 && version !== 9 && version !== 10 && version !== 11 && version !== 12 && version !== 13 && version !== 14 && version !== 15) {
    throw new Error(`Version documentaire SQLite non prise en charge : ${String(projectRow.format_version)}`)
  }
  const document = await readDocument(database, projectRow)
  return {
    project: projectSummaryFromRow(projectRow),
    document,
  }
}

/** Reads relational records and assembles the persisted document value. */
async function readDocument(database: ProjectDatabase, projectRow: SqlRow): Promise<LearningDocument> {
  const projectId = stringValue(projectRow, 'project_id')
  const [chapterRows, pageRows, scenarioRows, catalogPageRows, mediaRows, blockRows, placementRows,
    avatarRows, sectionRows, questionRows, answerRows, resultRows, carouselRows, cardRows,
    statisticalGraphRows] = await Promise.all([
    queryRows(database, 'SELECT * FROM chapters WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM pages WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM scenario_entries WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM catalog_pages WHERE project_id = ? ORDER BY position', [projectId]),
    queryRows(database, 'SELECT * FROM media_resources WHERE project_id = ? ORDER BY position', [projectId]),
    queryRows(database, CONTENT_BLOCKS_SQLITE_SELECT, [projectId]),
    queryRows(database, CONTENT_BLOCK_PLACEMENTS_SQLITE_SELECT, [projectId]),
    queryRows(database, 'SELECT content_block_id, content_json FROM avatars WHERE project_id = ?', [projectId]),
    queryRows(database, SECTION_SQLITE_SELECT, [projectId]),
    queryRows(database, QUESTION_SQLITE_SELECT, [projectId]),
    queryRows(database, QUESTION_ANSWERS_SQLITE_SELECT, [projectId]),
    queryRows(database, 'SELECT * FROM evaluation_result_branches WHERE project_id = ?', [projectId]),
    queryRows(database, CAROUSEL_SQLITE_SELECT, [projectId]),
    queryRows(database, CARD_SQLITE_SELECT, [projectId]),
    queryRows(database, STATISTICAL_GRAPH_SQLITE_SELECT, [projectId]),
  ])

  const placementsByBlock = new Map(placementRows.map((row) => [stringValue(row, 'content_block_id'), row]))
  const avatarsByBlock = new Map(avatarRows.map((row) => [stringValue(row, 'content_block_id'), row]))
  const sectionsByBlock = new Map(sectionRows.map((row) => [stringValue(row, 'content_block_id'), row]))
  const questionsByBlock = new Map(questionRows.map((row) => [stringValue(row, 'content_block_id'), row]))
  const carouselsByBlock = new Map(carouselRows.map((row) => [stringValue(row, 'content_block_id'), row]))
  const cardsByBlock = new Map(cardRows.map((row) => [stringValue(row, 'content_block_id'), row]))
  const statisticalGraphsByBlock = new Map(statisticalGraphRows.map((row) => [stringValue(row, 'content_block_id'), row]))

  const chapters = chapterRows.map((row) => chapterFromRow(row, scenarioRows))
  const pages = pageRows.map((row) => pageFromRow(row, scenarioRows, placementRows))
  const bdcs = blockRows.map((row) => bdcFromRows(
    row,
    placementsByBlock,
    avatarsByBlock,
    sectionsByBlock,
    questionsByBlock,
    answerRows,
    resultRows,
    carouselsByBlock,
    cardsByBlock,
    statisticalGraphsByBlock,
    placementRows,
  ))
  const data = {
    id: projectId,
    version: numberValue(projectRow, 'format_version'),
    name: stringValue(projectRow, 'name'),
    customAppearanceColors: parseJsonColumn<readonly string[]>(projectRow, 'custom_appearance_colors_json'),
    ...optionalAppearance(projectRow),
    revelationDefaults: {
      intro: stringValue(projectRow, 'default_intro_transition_ref') as LearningDocumentData['revelationDefaults']['intro'],
      outro: stringValue(projectRow, 'default_outro_transition_ref') as LearningDocumentData['revelationDefaults']['outro'],
    },
    summary: parseJsonColumn(projectRow, 'summary_json'),
    profile: parseJsonColumn(projectRow, 'profile_json'),
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

  const document = LearningDocument.fromJSON(data)
  learningDocumentCommandService.assertDocumentInvariants(document)
  return document
}

/** Recreates one chapter and its ordered page references from scenario rows. */
function chapterFromRow(row: SqlRow, scenarioRows: readonly SqlRow[]): LearningChapter {
  const type = stringValue(row, 'chapter_type') as LearningChapter['type']
  const base: LearningChapter = {
    id: stringValue(row, 'chapter_id'),
    name: decodeSqlText(stringValue(row, 'name')),
    type,
    pageIds: scenarioRows
      .filter((entry) => entry.parent_chapter_id === stringValue(row, 'chapter_id'))
      .filter((entry) => entry.chapter_id === null)
      .sort(byPosition)
      .map((entry) => stringValue(entry, 'page_id')),
    entries: scenarioRows
      .filter((entry) => entry.parent_chapter_id === stringValue(row, 'chapter_id'))
      .sort(byPosition)
      .map(scenarioEntryFromRow),
  }

  switch (type) {
    case CHAPTER_TYPE.EVALUATION:
      return {
        ...base,
        evaluationThreshold: nullableNumber(row, 'evaluation_threshold') ?? DEFAULT_EVALUATION_SETTINGS.threshold,
        evaluationAttemptLimit: nullableNumber(row, 'evaluation_attempt_limit'),
        evaluationRetryScope: nullableText(row, 'evaluation_retry_scope') as LearningChapter['evaluationRetryScope']
          ?? DEFAULT_EVALUATION_SETTINGS.retryScope,
      }
    case CHAPTER_TYPE.STANDARD:
      return base
    default:
      return base
  }
}

/** Recreates a page, its scenario parent and its ordered direct BDCs. */
function pageFromRow(row: SqlRow, scenarioRows: readonly SqlRow[], placementRows: readonly SqlRow[]): LearningPage {
  const pageId = stringValue(row, 'page_id')
  const scenarioEntry = scenarioRows.find((entry) => entry.page_id === pageId)
  return {
    id: pageId,
    name: decodeSqlText(stringValue(row, 'name')),
    type: stringValue(row, 'page_type') as LearningPage['type'],
    chapterId: nullableText(scenarioEntry ?? {}, 'parent_chapter_id'),
    bdcIds: placementRows
      .filter((placement) => placement.page_id === pageId)
      .sort(byPosition)
      .map((placement) => stringValue(placement, 'content_block_id')),
    ...optionalAppearance(row),
    ...optionalPageEarlyExit(row),
  }
}

/** Recreates a BDC common record and its type-specific detail rows. */
function bdcFromRows(
  row: SqlRow,
  placementsByBlock: ReadonlyMap<string, SqlRow>,
  avatarsByBlock: ReadonlyMap<string, SqlRow>,
  sectionsByBlock: ReadonlyMap<string, SqlRow>,
  questionsByBlock: ReadonlyMap<string, SqlRow>,
  answerRows: readonly SqlRow[],
  resultRows: readonly SqlRow[],
  carouselsByBlock: ReadonlyMap<string, SqlRow>,
  cardsByBlock: ReadonlyMap<string, SqlRow>,
  statisticalGraphsByBlock: ReadonlyMap<string, SqlRow>,
  allPlacementRows: readonly SqlRow[],
): LearningBdc {
  const id = stringValue(row, 'content_block_id')
  const placement = placementsByBlock.get(id) ?? {}
  const avatar = avatarsByBlock.get(id)
  const section = sectionsByBlock.get(id)
  const question = questionsByBlock.get(id)
  const carousel = carouselsByBlock.get(id)
  const card = cardsByBlock.get(id)
  const statisticalGraph = statisticalGraphsByBlock.get(id)

  return {
    ...contentBlockFromSqliteRows(row, placement),
    type: stringValue(row, 'content_block_type') as LearningBdc['type'],
    ...(avatar === undefined ? {} : { avatar: JSON.parse(stringValue(avatar, 'content_json')) as NonNullable<LearningBdc['avatar']> }),
    section: section === undefined ? null : sectionContentFromSqliteRow(section),
    question: question === undefined ? null : questionContentFromSqliteRows(question, answerRows),
    evaluationResult: resultContentFromRows(id, resultRows),
    carousel: carousel === undefined ? null : carouselContentFromSqliteRows(carousel, allPlacementRows),
    card: card === undefined ? null : cardContentFromSqliteRow(card),
    ...(statisticalGraph === undefined ? {} : { statisticalGraph: statisticalGraphContentFromSqliteRow(statisticalGraph) }),
  }
}

/** Reconstructs both result branches when a result BDC has persisted rows. */
function resultContentFromRows(id: string, rows: readonly SqlRow[]): LearningBdc['evaluationResult'] {
  const branches = rows.filter((row) => row.result_content_block_id === id)
  const success = branches.find((row) => row.branch === 'success')
  const failure = branches.find((row) => row.branch === 'failure')
  if (success === undefined || failure === undefined) return null

  return {
    success: {
      message: decodeSqlText(nullableText(success, 'message') ?? ''),
      action: nullableText(success, 'action') as NonNullable<LearningBdc['evaluationResult']>['success']['action'],
    },
    failure: {
      message: decodeSqlText(nullableText(failure, 'message') ?? ''),
      action: nullableText(failure, 'action') as NonNullable<LearningBdc['evaluationResult']>['failure']['action'],
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
async function writeDocumentRows(database: ProjectDatabase, document: LearningDocument): Promise<void> {
  await synchronizeMediaRows(database, document.id, document.medias)

  for (const chapter of document.chapters) await insertChapter(database, document.id, chapter)
  for (const page of document.pages) await insertPage(database, document.id, page)
  await insertScenarioRows(database, document)
  await insertCatalogPages(database, document)
  for (const bdc of document.bdcs) await executePreparedQuery(database, prepareContentBlockInsert(document.id, bdc))
  for (const bdc of document.bdcs) await insertBdcPlacement(database, document, bdc)
  for (const bdc of document.bdcs) await insertBdcDetail(database, document.id, bdc)
}

/** Inserts chapter fields and maps evaluation defaults to the chapter row. */
async function insertChapter(database: ProjectDatabase, projectId: string, chapter: LearningChapter): Promise<void> {
  const isEvaluation = chapter.type === CHAPTER_TYPE.EVALUATION
  await queryRows(database, `
    INSERT INTO chapters (
      project_id, chapter_id, name, chapter_type,
      evaluation_threshold, evaluation_attempt_limit, evaluation_retry_scope
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    projectId,
    chapter.id,
    nullableSerializedText(chapter.name),
    chapter.type,
    isEvaluation ? chapter.evaluationThreshold ?? DEFAULT_EVALUATION_SETTINGS.threshold : null,
    isEvaluation ? chapter.evaluationAttemptLimit ?? null : null,
    isEvaluation ? chapter.evaluationRetryScope ?? DEFAULT_EVALUATION_SETTINGS.retryScope : null,
  ])
}

/** Inserts a page identity; its scenario and BDC order are stored separately. */
async function insertPage(database: ProjectDatabase, projectId: string, page: LearningPage): Promise<void> {
  await queryRows(database,
    'INSERT INTO pages (project_id, page_id, name, page_type, appearance_json, allow_early_exit) VALUES (?, ?, ?, ?, ?, ?)',
    [projectId, page.id, nullableSerializedText(page.name), page.type, serializeOptionalJson(page.appearance), page.allowEarlyExit === undefined ? null : Number(page.allowEarlyExit)])
}

/** Persists the mixed root and nested scenario order in one relation. */
async function insertScenarioRows(database: ProjectDatabase, document: LearningDocument): Promise<void> {
  const persistEntries = async (parentChapterId: string | null, entries: readonly ScenarioEntry[]): Promise<void> => {
    for (const [position, entry] of entries.entries()) {
      switch (entry.kind) {
        case SCENARIO_ENTRY_KIND.PAGE:
          await insertScenarioEntry(database, document.id, parentChapterId, entry.pageId, null, position)
          break
        case SCENARIO_ENTRY_KIND.CHAPTER:
          await insertScenarioEntry(database, document.id, parentChapterId, null, entry.chapterId, position)
          const chapter = document.chapters.find((candidate) => candidate.id === entry.chapterId)
          if (chapter !== undefined) await persistEntries(chapter.id, chapter.entries)
          break
      }
    }
  }
  await persistEntries(null, document.data.scenarioEntries)
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
async function insertCatalogPages(database: ProjectDatabase, document: LearningDocument): Promise<void> {
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
  document: LearningDocument,
  bdc: LearningBdc,
): Promise<void> {
  const placement = normalizePlacement(document, bdc)
  await executePreparedQuery(database, prepareContentBlockPlacementInsert(document.id, bdc.id, {
    pageId: placement.kind === 'page' ? placement.pageId : null,
    parentBdcId: placement.kind === 'parent' ? placement.parentBdcId : null,
    position: placement.position,
    durationMs: placement.kind === 'parent' ? placement.durationMs : null,
    introTransitionRef: placement.kind === 'parent' ? placement.introTransitionRef : null,
    outroTransitionRef: placement.kind === 'parent' ? placement.outroTransitionRef : null,
  }))
  if (placement.kind !== 'parent') return
  const cue = document.bdcs.find((parent) => parent.id === placement.parentBdcId)?.carousel?.cards.find((entry) => entry.bdcId === bdc.id)?.cue
  if (cue === undefined) return
  await queryRows(database,
    'UPDATE content_block_placements SET cue_json = ? WHERE project_id = ? AND content_block_id = ?',
    [JSON.stringify(cue), document.id, bdc.id])
}

/** Converts the document’s parallel arrays into one discriminated placement. */
function normalizePlacement(document: LearningDocument, bdc: LearningBdc): NormalizedPlacement {
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
        if (entryIndex < 0 || entry === undefined) throw new Error(`Vue absente de son Carousel : ${bdc.id}`)
        return {
          kind: 'parent',
          parentBdcId: parent.id,
          position: entryIndex,
          durationMs: entry.durationMs,
          introTransitionRef: entry.introTransitionRef,
          outroTransitionRef: entry.outroTransitionRef,
        }
      }
      case BDC_TYPE.AVATAR:
      case BDC_TYPE.SECTION:
      case BDC_TYPE.QUESTION:
      case BDC_TYPE.EVALUATION_RESULT:
      case BDC_TYPE.CARD:
      case BDC_TYPE.STATISTICAL_GRAPH:
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

/** Inserts the detail row matching one BDC type. */
async function insertBdcDetail(database: ProjectDatabase, projectId: string, bdc: LearningBdc): Promise<void> {
  switch (bdc.type) {
    case BDC_TYPE.AVATAR:
      await queryRows(database, 'INSERT INTO avatars (project_id, content_block_id, content_json) VALUES (?, ?, ?)', [projectId, bdc.id, JSON.stringify(requireValue(bdc.avatar, `Avatar manquant : ${bdc.id}`))])
      return
    case BDC_TYPE.SECTION: {
      const section = requireValue(bdc.section, `Section manquante : ${bdc.id}`)
      await executePreparedQuery(database, prepareSectionInsert(projectId, bdc.id, section))
      return
    }
    case BDC_TYPE.QUESTION: {
      const question = requireValue(bdc.question, `Question manquante : ${bdc.id}`)
      await executePreparedQueries(database, prepareQuestionInsert(projectId, bdc.id, question))
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
        `, [projectId, bdc.id, branch, nullableSerializedText(content.message), content.action])
      }
      return
    }
    case BDC_TYPE.CAROUSEL: {
      const carousel = requireValue(bdc.carousel, `Carousel manquant : ${bdc.id}`)
      await executePreparedQuery(database, prepareCarouselInsert(projectId, bdc.id, carousel))
      return
    }
    case BDC_TYPE.CARD: {
      const card = requireValue(bdc.card, `Carte manquante : ${bdc.id}`)
      await executePreparedQuery(database, prepareCardInsert(projectId, bdc.id, card))
      return
    }
    case BDC_TYPE.STATISTICAL_GRAPH: {
      const graph = requireValue(bdc.statisticalGraph, `Graphe manquant : ${bdc.id}`)
      await executePreparedQuery(database, prepareStatisticalGraphInsert(projectId, bdc.id, graph))
      return
    }
    case BDC_TYPE.SUMMARY:
      return
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

/** Executes one resource-prepared query within the mod-owned transaction. */
async function executePreparedQuery(database: ProjectDatabase, query: SqliteQuery): Promise<SqlRow[]> {
  return queryRows(database, query.text, [...query.values])
}

/** Executes resource-prepared detail queries in order within the same transaction. */
async function executePreparedQueries(database: ProjectDatabase, queries: readonly SqliteQuery[]): Promise<void> {
  for (const query of queries) await executePreparedQuery(database, query)
}

/** Restores one root scenario entry as a page or chapter reference. */
function scenarioEntryFromRow(row: SqlRow): LearningDocumentData['scenarioEntries'][number] {
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

/** Parses one JSON document column from SQLite. */
function parseJsonColumn<Value>(row: SqlRow, key: string): Value {
  const value = stringValue(row, key)
  try {
    return JSON.parse(value) as Value
  } catch {
    throw new Error(`Valeur JSON invalide en base : ${key}`)
  }
}

/** Reads a nullable SQLite boolean and rejects values outside its stored domain. */
function nullableBoolean(row: SqlRow, key: string): boolean | undefined {
  const value = row[key]
  if (value === null || value === undefined) return undefined
  if (value === 0 || value === 0n) return false
  if (value === 1 || value === 1n) return true
  throw new Error(`Valeur booléenne invalide en base : ${key}`)
}

/** Restores an optional page exit override from its nullable SQLite column. */
function optionalPageEarlyExit(row: SqlRow): Readonly<{ allowEarlyExit?: boolean }> {
  const value = nullableBoolean(row, 'allow_early_exit')
  return value === undefined ? {} : { allowEarlyExit: value }
}

/** Serializes optional appearance settings as SQL NULL when a scope inherits all values. */
function serializeOptionalJson(value: AppearanceSettings | undefined): string | null {
  if (value === undefined) return null
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('Réglages d’apparence non sérialisables.')
  return serialized
}

/** Restores sparse appearance settings from one nullable relational column. */
function optionalAppearance(row: SqlRow): Readonly<{ appearance?: AppearanceSettings }> {
  const value = nullableText(row, 'appearance_json')
  if (value === null) return {}
  try {
    return { appearance: JSON.parse(value) as AppearanceSettings }
  } catch {
    throw new Error('Réglages d’apparence JSON invalides en base.')
  }
}

/** Converts an empty model string to SQL NULL for optional text columns. */
function nullableTextValue(value: string): string | null {
  return value.length === 0 ? null : value
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
