import { rawSql } from 'remix/data-table'
import type { Database, DataManipulationResult } from 'remix/data-table'
import type { SqliteDatabase } from 'remix/data-table/sqlite'
import { PROJECT_EDIT_LEASE_MS } from '../../../../../config/api-config'
import { CARD_BDC_TYPE } from '../../../../../resources/bdcs/card/card-config'
import { CAROUSEL_BDC_TYPE } from '../../../../../resources/bdcs/carousel/carousel-config'
import { QUESTION_BDC_TYPE } from '../../../../../resources/bdcs/question/question-config'
import { SECTION_BDC_TYPE } from '../../../../../resources/bdcs/section/section-config'
import { STATISTICAL_GRAPH_BDC_TYPE } from '../../../../../resources/bdcs/statistical-graph/statistical-graph-config'
import { decodeSqliteText, encodeNullableSqliteText } from '../../../../../resources/document/persistence/sqlite/sqlite-text-values'
import {
  CONTENT_BLOCKS_SQLITE_SELECT,
  CONTENT_BLOCK_PLACEMENTS_SQLITE_SELECT,
  contentBlockFromSqliteRows,
  prepareContentBlockInsert,
  prepareContentBlockPlacementInsert,
} from '../../../../../resources/document/persistence/sqlite/content-block-queries'
import type { SqliteQuery, SqliteRow } from '../../../../../core/persistence/sqlite/sqlite-query-types'
import {
  sqliteNullableText,
  sqliteNumberValue,
  sqliteStringValue,
} from '../../../../../core/persistence/sqlite/sqlite-query-types'
import { CARD_SQLITE_SELECT, cardContentFromSqliteRow, prepareCardInsert } from '../../../../../resources/bdcs/card/persistence/sqlite/card-queries'
import { CAROUSEL_SQLITE_SELECT, carouselContentFromSqliteRows, prepareCarouselInsert } from '../../../../../resources/bdcs/carousel/persistence/sqlite/carousel-queries'
import { QUESTION_ANSWERS_SQLITE_SELECT, QUESTION_SQLITE_SELECT, prepareQuestionInsert, questionContentFromSqliteRows } from '../../../../../resources/bdcs/question/persistence/sqlite/question-queries'
import { SECTION_SQLITE_SELECT, prepareSectionInsert, sectionContentFromSqliteRow } from '../../../../../resources/bdcs/section/persistence/sqlite/section-queries'
import { STATISTICAL_GRAPH_SQLITE_SELECT, prepareStatisticalGraphInsert, statisticalGraphContentFromSqliteRow } from '../../../../../resources/bdcs/statistical-graph/persistence/sqlite/statistical-graph-queries'
import type { ResourceBdc } from '../../../../../resources/document/resource-document-types'
import type { MediaMetadata } from '../../../../../core/document/content-document-types'
import type {
  AcquireProjectEditResult,
  CreateProjectResult,
  DeleteProjectResult,
  EditProjectResult,
  ProjectEditGrant,
  ProjectPersistence,
  ProjectSummary,
  SaveProjectDocumentResult,
  StoredProject,
} from '../../../../../core/server/projects/project-persistence'
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
import { QuizHuntProjectDocument, readQuizHuntDocument } from '../../quiz-hunt-document-codec'
import type { QuizHuntDocument } from '../../../document/quiz-hunt-document-types'
import type { QuizHuntGameStatePersistence, QuizHuntSavedGameState } from '../../quiz-hunt-game-state-persistence'

type ProjectDatabase = Pick<Database<'sqlite'>, 'exec'>
type SqlRow = SqliteRow
type QuizHuntProject = QuizHuntProjectDocument
type QuizHuntBdc = QuizHuntDocument['bdcs'][number]

/** Persists Quiz Hunt organization and settings around the shared BDC tables. */
export class QuizHuntSqliteProjectPersistence implements ProjectPersistence<QuizHuntProject>, MediaPersistence, QuizHuntGameStatePersistence {
  private readonly database: SqliteDatabase

  /** Uses the product's migrated SQLite connection without owning its lifetime. */
  public constructor(database: SqliteDatabase) {
    this.database = database
  }

  /** Reserves one Quiz Hunt project atomically for an authoring page. */
  public async acquireEditAccess(projectId: string, pageId: string, force = false): Promise<AcquireProjectEditResult> {
    return this.database.transaction((transaction) =>
      acquireSqliteProjectEditAccess(transaction, 'quiz-hunt', projectId, pageId, force))
  }

  /** Checks whether the exact edit grant still belongs to this Quiz Hunt project. */
  public async hasEditAccess(projectId: string, grant: ProjectEditGrant): Promise<boolean> {
    return this.database.transaction((transaction) =>
      hasSqliteProjectEditAccess(transaction, 'quiz-hunt', projectId, grant))
  }

  /** Renews the exact active grant while keeping the project in the Quiz Hunt catalog. */
  public async renewEditAccess(projectId: string, grant: ProjectEditGrant): Promise<boolean> {
    return this.database.transaction((transaction) =>
      renewSqliteProjectEditAccess(transaction, 'quiz-hunt', projectId, grant))
  }

  /** Releases only the matching grant for a Quiz Hunt project. */
  public async releaseEditAccess(projectId: string, grant: ProjectEditGrant): Promise<boolean> {
    return this.database.transaction((transaction) =>
      releaseSqliteProjectEditAccess(transaction, 'quiz-hunt', projectId, grant))
  }

  /** Lists only Quiz Hunt projects in the shared project table. */
  public async listProjects(): Promise<readonly ProjectSummary[]> {
    const rows = await queryRows(this.database, `
      SELECT project_id, name, revision FROM projects
      WHERE mod_key = 'quiz-hunt' ORDER BY created_at, project_id
    `)
    return rows.map(projectSummaryFromRow)
  }

  /** Reads one Quiz Hunt project and reconstructs its shared BDC content. */
  public async findProject(projectId: string): Promise<StoredProject<QuizHuntProject> | null> {
    return this.database.transaction((transaction) => readStoredProject(transaction, projectId))
  }

  /** Reads the latest saved game only for a project in the Quiz Hunt catalog. */
  public async readGameState(projectId: string): Promise<QuizHuntSavedGameState | null> {
    const rows = await queryRows(this.database, `
      SELECT game_state.seed, game_state.state_json, game_state.saved_at
      FROM quiz_hunt_game_state AS game_state
      JOIN projects USING (project_id)
      WHERE game_state.project_id = ? AND projects.mod_key = 'quiz-hunt'
    `, [projectId])
    const row = rows[0]
    return row === undefined ? null : {
      seed: sqliteNumberValue(row, 'seed'),
      state: JSON.parse(sqliteStringValue(row, 'state_json')) as unknown,
      savedAt: sqliteNumberValue(row, 'saved_at'),
    }
  }

  /** Replaces the saved game row without touching the project's BDC data. */
  public async saveGameState(projectId: string, value: QuizHuntSavedGameState): Promise<boolean> {
    const stateJson = JSON.stringify(value.state)
    if (stateJson === undefined) throw new Error('L’état de partie Quiz Hunt ne peut pas être sérialisé.')
    return this.database.transaction(async (transaction) => {
      const projects = await queryRows(transaction,
        "SELECT project_id FROM projects WHERE project_id = ? AND mod_key = 'quiz-hunt'", [projectId])
      if (projects.length === 0) return false
      await queryRows(transaction, `
        INSERT INTO quiz_hunt_game_state (project_id, seed, state_json, saved_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          seed = excluded.seed,
          state_json = excluded.state_json,
          saved_at = excluded.saved_at
      `, [projectId, value.seed, stateJson, value.savedAt])
      return true
    })
  }

  /** Clears the saved game row when the released game starts a new run. */
  public async clearGameState(projectId: string): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const projects = await queryRows(transaction,
        "SELECT project_id FROM projects WHERE project_id = ? AND mod_key = 'quiz-hunt'", [projectId])
      if (projects.length === 0) return false
      await queryRows(transaction, 'DELETE FROM quiz_hunt_game_state WHERE project_id = ?', [projectId])
      return true
    })
  }

  /** Creates one Quiz Hunt project and writes its content to the shared BDC tables. */
  public async createProject(document: QuizHuntProject): Promise<CreateProjectResult> {
    return this.database.transaction(async (transaction) => {
      const now = new Date().toISOString()
      const inserted = await queryRows(transaction, `
        INSERT INTO projects (
          project_id, name, format_version, mod_key, revision, created_at, updated_at,
          default_intro_transition_ref, default_outro_transition_ref, appearance_json
        ) VALUES (?, ?, 1, 'quiz-hunt', 0, ?, ?, '', '', ?)
        ON CONFLICT(project_id) DO NOTHING RETURNING project_id
      `, [document.id, document.data.name, now, now, serializeOptionalJson(document.data.appearance)])
      if (inserted.length === 0) return { kind: 'already-exists' }
      await writeDocumentRows(transaction, document.data)
      return { kind: 'created', project: { id: document.id, name: document.data.name, revision: 0 } }
    })
  }

  /** Renames one Quiz Hunt project and advances its shared project revision. */
  public async renameProject(projectId: string, name: string, grant: ProjectEditGrant): Promise<EditProjectResult> {
    return this.database.transaction(async (transaction) => {
      const access = await getSqliteProjectEditGrantState(transaction, 'quiz-hunt', projectId, grant)
      if (access === 'not-found') return { kind: 'not-found' }
      if (access === 'lost') return { kind: 'edit-access-lost' }
      const now = Date.now()
      const rows = await queryRows(transaction, `
        UPDATE projects SET name = ?, revision = revision + 1, updated_at = ?, edit_lease_expires_at = ?
        WHERE project_id = ? AND mod_key = 'quiz-hunt'
        RETURNING project_id, name, revision
      `, [name.trim(), new Date(now).toISOString(), now + PROJECT_EDIT_LEASE_MS, projectId])
      return { kind: 'updated', project: projectSummaryFromRow(requireRow(rows[0], 'Quiz Hunt rename returned no project.')) }
    })
  }

  /** Deletes one Quiz Hunt project; shared and mod-owned rows follow its foreign keys. */
  public async deleteProject(projectId: string, grant: ProjectEditGrant): Promise<DeleteProjectResult> {
    return this.database.transaction(async (transaction) => {
      const access = await getSqliteProjectEditGrantState(transaction, 'quiz-hunt', projectId, grant)
      if (access === 'not-found') return 'not-found'
      if (access === 'lost') return 'edit-access-lost'
      await queryRows(transaction, "DELETE FROM projects WHERE project_id = ? AND mod_key = 'quiz-hunt'", [projectId])
      return 'deleted'
    })
  }

  /** Replaces Quiz Hunt organization and settings without changing the shared project identity. */
  public async saveDocument(
    projectId: string,
    expectedRevision: number,
    document: QuizHuntProject,
    grant: ProjectEditGrant,
  ): Promise<SaveProjectDocumentResult> {
    return this.database.transaction(async (transaction) => {
      const access = await getSqliteProjectEditGrantState(transaction, 'quiz-hunt', projectId, grant)
      if (access === 'not-found') return { kind: 'not-found' }
      if (access === 'lost') return { kind: 'edit-access-lost' }
      const now = Date.now()
      const rows = await queryRows(transaction, `
        UPDATE projects SET name = ?, revision = revision + 1, updated_at = ?,
          edit_lease_expires_at = ?, appearance_json = ?
        WHERE project_id = ? AND revision = ? AND mod_key = 'quiz-hunt'
        RETURNING project_id, name, revision
      `, [document.data.name, new Date(now).toISOString(), now + PROJECT_EDIT_LEASE_MS,
        serializeOptionalJson(document.data.appearance), projectId, expectedRevision])
      if (rows.length === 0) {
        const existing = await queryRows(transaction, "SELECT project_id FROM projects WHERE project_id = ? AND mod_key = 'quiz-hunt'", [projectId])
        return existing.length === 0 ? { kind: 'not-found' } : { kind: 'revision-mismatch' }
      }
      await clearDocumentRows(transaction, projectId)
      await writeDocumentRows(transaction, document.data)
      return { kind: 'saved', project: projectSummaryFromRow(rows[0]!) }
    })
  }

  /** Loads an uploaded media resource only when its project belongs to Quiz Hunt. */
  public async findMediaFile(projectId: string, mediaId: string): Promise<StoredMediaResource | null> {
    return findSqliteMediaFile(this.database, 'quiz-hunt', projectId, mediaId)
  }

  /** Returns media files referenced by either mod so shared cleanup retains them. */
  public async listMediaStorageKeys(): Promise<readonly string[]> {
    return listSqliteMediaStorageKeys(this.database)
  }

  /** Publishes an uploaded file key after validating its project grant and media metadata. */
  public async storeMediaFile(
    projectId: string,
    mediaId: string,
    expectedSize: number,
    storageKey: string,
    contentSha256: string,
    grant: ProjectEditGrant,
  ): Promise<StoreMediaFileResult> {
    return this.database.transaction((transaction) => publishSqliteMediaFile(
      transaction, 'quiz-hunt', projectId, mediaId, expectedSize, storageKey, contentSha256, grant,
    ))
  }
}

/** Reconstructs the project and its Quiz Hunt document from shared relational rows. */
async function readStoredProject(database: ProjectDatabase, projectId: string): Promise<StoredProject<QuizHuntProject> | null> {
  const rows = await queryRows(database, `
    SELECT project_id, name, revision, appearance_json FROM projects
    WHERE project_id = ? AND mod_key = 'quiz-hunt'
  `, [projectId])
  const projectRow = rows[0]
  if (projectRow === undefined) return null
  const document = await readDocument(database, projectRow)
  return { project: projectSummaryFromRow(projectRow), document: new QuizHuntProjectDocument(readQuizHuntDocument({ version: 1, document })) }
}

/** Reads common BDC tables and Quiz Hunt's organization and settings tables. */
async function readDocument(database: ProjectDatabase, projectRow: SqlRow): Promise<QuizHuntDocument> {
  const projectId = sqliteStringValue(projectRow, 'project_id')
  const [chapterRows, pageRows, scenarioRows, catalogPageRows, mediaRows, blockRows, placementRows,
    sectionRows, questionRows, answerRows, carouselRows, cardRows, graphRows, settingRows, groupRows, pageOptionRows] = await Promise.all([
    queryRows(database, 'SELECT * FROM chapters WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM pages WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM scenario_entries WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM catalog_pages WHERE project_id = ? ORDER BY position', [projectId]),
    queryRows(database, 'SELECT * FROM media_resources WHERE project_id = ? ORDER BY position', [projectId]),
    queryRows(database, CONTENT_BLOCKS_SQLITE_SELECT, [projectId]),
    queryRows(database, CONTENT_BLOCK_PLACEMENTS_SQLITE_SELECT, [projectId]),
    queryRows(database, SECTION_SQLITE_SELECT, [projectId]),
    queryRows(database, QUESTION_SQLITE_SELECT, [projectId]),
    queryRows(database, QUESTION_ANSWERS_SQLITE_SELECT, [projectId]),
    queryRows(database, CAROUSEL_SQLITE_SELECT, [projectId]),
    queryRows(database, CARD_SQLITE_SELECT, [projectId]),
    queryRows(database, STATISTICAL_GRAPH_SQLITE_SELECT, [projectId]),
    queryRows(database, 'SELECT * FROM quiz_hunt_settings WHERE project_id = ?', [projectId]),
    queryRows(database, 'SELECT * FROM quiz_hunt_groups WHERE project_id = ? ORDER BY position', [projectId]),
    queryRows(database, 'SELECT * FROM quiz_hunt_page_options WHERE project_id = ?', [projectId]),
  ])
  const settingRow = settingRows[0]
  if (settingRow === undefined) throw new Error(`Réglages Quiz Hunt absents du projet ${projectId}.`)
  const placementByBlock = new Map(placementRows.map((row) => [sqliteStringValue(row, 'content_block_id'), row]))
  const sectionByBlock = new Map(sectionRows.map((row) => [sqliteStringValue(row, 'content_block_id'), row]))
  const questionByBlock = new Map(questionRows.map((row) => [sqliteStringValue(row, 'content_block_id'), row]))
  const carouselByBlock = new Map(carouselRows.map((row) => [sqliteStringValue(row, 'content_block_id'), row]))
  const cardByBlock = new Map(cardRows.map((row) => [sqliteStringValue(row, 'content_block_id'), row]))
  const graphByBlock = new Map(graphRows.map((row) => [sqliteStringValue(row, 'content_block_id'), row]))
  const pageOptionsByPage = new Map(pageOptionRows.map((row) => [sqliteStringValue(row, 'page_id'), row]))
  const chapters = chapterRows.map((row) => ({
    id: sqliteStringValue(row, 'chapter_id'),
    name: decodeSqliteText(sqliteStringValue(row, 'name')) as string,
    type: sqliteStringValue(row, 'chapter_type') as QuizHuntDocument['chapters'][number]['type'],
    pageIds: scenarioRows
      .filter((entry) => entry.parent_chapter_id === sqliteStringValue(row, 'chapter_id'))
      .sort(byPosition)
      .map((entry) => sqliteStringValue(entry, 'page_id')),
  }))
  const pages = pageRows.map((row) => {
    const pageId = sqliteStringValue(row, 'page_id')
    const scenario = scenarioRows.find((entry) => entry.page_id === pageId)
    const options = pageOptionsByPage.get(pageId)
    const appearanceJson = sqliteNullableText(row, 'appearance_json')
    return {
      id: pageId,
      name: decodeSqliteText(sqliteStringValue(row, 'name')) as string,
      type: sqliteStringValue(row, 'page_type') as QuizHuntDocument['pages'][number]['type'],
      chapterId: sqliteNullableText(scenario ?? {}, 'parent_chapter_id'),
      bdcIds: placementRows
        .filter((placement) => placement.page_id === pageId)
        .sort(byPosition)
        .map((placement) => sqliteStringValue(placement, 'content_block_id')),
      colorId: options === undefined ? null : sqliteNullableText(options, 'color_id'),
      mandatory: options === undefined ? false : sqliteNumberValue(options, 'mandatory') !== 0,
      ...(appearanceJson === null ? {} : { appearance: JSON.parse(appearanceJson) }),
    }
  })
  const bdcs = blockRows.map((row) => resourceBdcFromRows(
    row, placementByBlock.get(sqliteStringValue(row, 'content_block_id')),
    sectionByBlock.get(sqliteStringValue(row, 'content_block_id')),
    questionByBlock.get(sqliteStringValue(row, 'content_block_id')),
    answerRows,
    carouselByBlock.get(sqliteStringValue(row, 'content_block_id')),
    cardByBlock.get(sqliteStringValue(row, 'content_block_id')),
    graphByBlock.get(sqliteStringValue(row, 'content_block_id')),
    placementRows,
  ))
  const appearanceJson = sqliteNullableText(projectRow, 'appearance_json')
  return readQuizHuntDocument({
    version: 1,
    document: {
      id: projectId,
      name: sqliteStringValue(projectRow, 'name'),
      chapters,
      pages,
      scenarioEntries: scenarioRows.filter((row) => row.parent_chapter_id === null).sort(byPosition).map(scenarioEntryFromRow),
      catalogPageIds: catalogPageRows.map((row) => sqliteStringValue(row, 'page_id')),
      bdcs,
      catalogBdcIds: placementRows
        .filter((row) => row.page_id === null && row.parent_content_block_id === null)
        .sort(byPosition)
        .map((row) => sqliteStringValue(row, 'content_block_id')),
      medias: mediaRows.map(mediaFromRow),
      ...(appearanceJson === null ? {} : { appearance: JSON.parse(appearanceJson) }),
      settings: {
        groups: groupRows.map((row) => ({
          id: sqliteStringValue(row, 'group_id'),
          name: sqliteStringValue(row, 'name'),
          color: sqliteStringValue(row, 'color'),
        })),
        successCardBdcId: sqliteStringValue(settingRow, 'success_card_bdc_id'),
        failureCardBdcId: sqliteStringValue(settingRow, 'failure_card_bdc_id'),
        seed: sqliteNumberValue(settingRow, 'seed'),
        random: sqliteNumberValue(settingRow, 'random') !== 0,
        timeBudgetMs: sqliteNumberValue(settingRow, 'time_budget_ms'),
        clueDelayMs: sqliteNumberValue(settingRow, 'clue_delay_ms'),
        feedbackDelayMs: sqliteNumberValue(settingRow, 'feedback_delay_ms'),
        extraEnabled: sqliteNumberValue(settingRow, 'extra_enabled') !== 0,
        extraTriggerPageId: sqliteNullableText(settingRow, 'extra_trigger_page_id'),
        authoringGridDebug: sqliteNumberValue(settingRow, 'authoring_grid_debug') !== 0,
      },
    },
  })
}

/** Reconstructs a shared resource BDC from its common identity and detail tables. */
function resourceBdcFromRows(
  row: SqlRow,
  placement: SqlRow | undefined,
  section: SqlRow | undefined,
  question: SqlRow | undefined,
  answerRows: readonly SqlRow[],
  carousel: SqlRow | undefined,
  card: SqlRow | undefined,
  graph: SqlRow | undefined,
  allPlacementRows: readonly SqlRow[],
): ResourceBdc {
  return {
    ...contentBlockFromSqliteRows(row, placement),
    type: sqliteStringValue(row, 'content_block_type'),
    section: section === undefined ? null : sectionContentFromSqliteRow(section),
    question: question === undefined ? null : questionContentFromSqliteRows(question, answerRows),
    carousel: carousel === undefined ? null : carouselContentFromSqliteRows(carousel, allPlacementRows),
    card: card === undefined ? null : cardContentFromSqliteRow(card),
    ...(graph === undefined ? {} : { statisticalGraph: statisticalGraphContentFromSqliteRow(graph) }),
  }
}

/** Writes Quiz Hunt data while delegating every BDC payload to its shared resource. */
async function writeDocumentRows(database: ProjectDatabase, document: QuizHuntDocument): Promise<void> {
  await synchronizeMediaRows(database, document.id, document.medias)
  for (const chapter of document.chapters) {
    await queryRows(database, `
      INSERT INTO chapters (project_id, chapter_id, name, chapter_type)
      VALUES (?, ?, ?, ?)
    `, [document.id, chapter.id, encodeNullableSqliteText(chapter.name), chapter.type])
  }
  for (const page of document.pages) {
    await queryRows(database, `
      INSERT INTO pages (project_id, page_id, name, page_type, appearance_json, allow_early_exit)
      VALUES (?, ?, ?, ?, ?, NULL)
    `, [document.id, page.id, encodeNullableSqliteText(page.name), page.type, serializeOptionalJson(page.appearance)])
  }
  for (const [position, entry] of document.scenarioEntries.entries()) {
    await insertScenarioEntry(database, document.id, null,
      entry.kind === 'page' ? entry.pageId : null,
      entry.kind === 'chapter' ? entry.chapterId : null,
      position)
  }
  for (const chapter of document.chapters) {
    for (const [position, pageId] of chapter.pageIds.entries()) {
      await insertScenarioEntry(database, document.id, chapter.id, pageId, null, position)
    }
  }
  for (const [position, pageId] of document.catalogPageIds.entries()) {
    await queryRows(database, 'INSERT INTO catalog_pages (project_id, page_id, position) VALUES (?, ?, ?)', [document.id, pageId, position])
  }
  await synchronizeQuizHuntSettings(database, document)
  for (const page of document.pages) {
    await queryRows(database, `
      INSERT INTO quiz_hunt_page_options (project_id, page_id, color_id, mandatory)
      VALUES (?, ?, ?, ?)
    `, [document.id, page.id, page.colorId, Number(page.mandatory)])
  }
  for (const bdc of document.bdcs) await executePreparedQuery(database, prepareContentBlockInsert(document.id, bdc))
  for (const bdc of document.bdcs) await insertBdcPlacement(database, document, bdc)
  for (const bdc of document.bdcs) await insertBdcDetail(database, document.id, bdc)
}

/** Persists the Quiz Hunt game settings and its ordered group/color choices. */
async function synchronizeQuizHuntSettings(database: ProjectDatabase, document: QuizHuntDocument): Promise<void> {
  const settings = document.settings
  await queryRows(database, `
    INSERT INTO quiz_hunt_settings (
      project_id, menu_presentation, success_card_bdc_id, failure_card_bdc_id,
      seed, random, time_budget_ms, clue_delay_ms, feedback_delay_ms, extra_enabled,
      extra_trigger_page_id, authoring_grid_debug
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      menu_presentation = excluded.menu_presentation,
      success_card_bdc_id = excluded.success_card_bdc_id,
      failure_card_bdc_id = excluded.failure_card_bdc_id,
      seed = excluded.seed, random = excluded.random, time_budget_ms = excluded.time_budget_ms,
      clue_delay_ms = excluded.clue_delay_ms, feedback_delay_ms = excluded.feedback_delay_ms,
      extra_enabled = excluded.extra_enabled,
      extra_trigger_page_id = excluded.extra_trigger_page_id,
      authoring_grid_debug = excluded.authoring_grid_debug
  `, [document.id, 'grid', settings.successCardBdcId, settings.failureCardBdcId,
    settings.seed, Number(settings.random), settings.timeBudgetMs,
    settings.clueDelayMs, settings.feedbackDelayMs, Number(settings.extraEnabled), settings.extraTriggerPageId,
    Number(settings.authoringGridDebug)])
  await queryRows(database, 'DELETE FROM quiz_hunt_groups WHERE project_id = ?', [document.id])
  for (const [position, group] of settings.groups.entries()) {
    await queryRows(database, `
      INSERT INTO quiz_hunt_groups (project_id, group_id, name, color, position)
      VALUES (?, ?, ?, ?, ?)
    `, [document.id, group.id, group.name, group.color, position])
  }
}

/** Inserts one root or chapter page reference in the shared scenario table. */
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

/** Persists one common BDC placement using its page, parent, or catalog order. */
async function insertBdcPlacement(database: ProjectDatabase, document: QuizHuntDocument, bdc: QuizHuntBdc): Promise<void> {
  let parentPlacement: Readonly<{ position: number | null; durationMs: number | null; intro: string | null; outro: string | null }> | null = null
  if (bdc.parentBdcId !== null) {
    const parent = document.bdcs.find((candidate) => candidate.id === bdc.parentBdcId)
    if (parent?.type === CAROUSEL_BDC_TYPE) {
      const entry = parent.carousel?.cards.find((candidate) => candidate.bdcId === bdc.id)
      if (entry === undefined) throw new Error(`Entrée Carousel absente pour le BDC ${bdc.id}.`)
      parentPlacement = { position: parent.carousel!.cards.indexOf(entry), durationMs: entry.durationMs,
        intro: entry.introTransitionRef, outro: entry.outroTransitionRef }
    }
  }
  const page = bdc.pageId === null ? undefined : document.pages.find((candidate) => candidate.id === bdc.pageId)
  const position = page === undefined ? null : page.bdcIds.indexOf(bdc.id)
  if (page !== undefined && (position === null || position < 0)) throw new Error(`BDC absent de l’ordre de page : ${bdc.id}`)
  const catalogPosition = bdc.pageId === null && bdc.parentBdcId === null
    ? document.catalogBdcIds.indexOf(bdc.id)
    : -1
  if (page === undefined && bdc.parentBdcId === null && catalogPosition < 0) throw new Error(`BDC sans emplacement : ${bdc.id}`)
  await executePreparedQuery(database, prepareContentBlockPlacementInsert(document.id, bdc.id, {
    pageId: page?.id ?? null,
    parentBdcId: bdc.parentBdcId,
    position: page === undefined ? parentPlacement?.position ?? (catalogPosition < 0 ? null : catalogPosition) : position,
    durationMs: parentPlacement?.durationMs ?? null,
    introTransitionRef: parentPlacement?.intro ?? null,
    outroTransitionRef: parentPlacement?.outro ?? null,
  }))
}

/** Writes the detail row with the shared query prepared by the BDC owner. */
async function insertBdcDetail(database: ProjectDatabase, projectId: string, bdc: QuizHuntBdc): Promise<void> {
  switch (bdc.type) {
    case SECTION_BDC_TYPE:
      if (bdc.section === null) throw new Error(`Section manquante : ${bdc.id}`)
      await executePreparedQuery(database, prepareSectionInsert(projectId, bdc.id, bdc.section))
      return
    case QUESTION_BDC_TYPE:
      if (bdc.question === null) throw new Error(`Question manquante : ${bdc.id}`)
      for (const query of prepareQuestionInsert(projectId, bdc.id, bdc.question)) await executePreparedQuery(database, query)
      return
    case CAROUSEL_BDC_TYPE:
      if (bdc.carousel == null) throw new Error(`Carousel manquant : ${bdc.id}`)
      await executePreparedQuery(database, prepareCarouselInsert(projectId, bdc.id, bdc.carousel))
      return
    case CARD_BDC_TYPE:
      if (bdc.card == null) throw new Error(`Carte manquante : ${bdc.id}`)
      await executePreparedQuery(database, prepareCardInsert(projectId, bdc.id, bdc.card))
      return
    case STATISTICAL_GRAPH_BDC_TYPE:
      if (bdc.statisticalGraph == null) throw new Error(`Graphe manquant : ${bdc.id}`)
      await executePreparedQuery(database, prepareStatisticalGraphInsert(projectId, bdc.id, bdc.statisticalGraph))
      return
    default:
      throw new Error(`Type de BDC Quiz Hunt non pris en charge : ${bdc.type}`)
  }
}

/** Synchronizes media metadata while retaining server-side upload identities. */
async function synchronizeMediaRows(database: ProjectDatabase, projectId: string, medias: readonly MediaMetadata[]): Promise<void> {
  const mediaIds = new Set(medias.map((media) => media.id))
  const existing = await queryRows(database, 'SELECT media_id FROM media_resources WHERE project_id = ?', [projectId])
  for (const row of existing) {
    const mediaId = sqliteStringValue(row, 'media_id')
    if (!mediaIds.has(mediaId)) await queryRows(database,
      'DELETE FROM media_resources WHERE project_id = ? AND media_id = ?', [projectId, mediaId])
  }
  for (const [position, media] of medias.entries()) {
    await queryRows(database, `
      INSERT INTO media_resources (project_id, media_id, name, mime_type, size_bytes, media_caption, position)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, media_id) DO UPDATE SET
        name = excluded.name, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
        media_caption = excluded.media_caption, position = excluded.position
    `, [projectId, media.id, media.name, media.mimeType, media.size, encodeNullableSqliteText(media.caption), position])
  }
}

/** Deletes old project organization and BDC rows before a document replacement. */
async function clearDocumentRows(database: ProjectDatabase, projectId: string): Promise<void> {
  await queryRows(database, 'DELETE FROM content_block_placements WHERE project_id = ?', [projectId])
  await queryRows(database, 'DELETE FROM content_blocks WHERE project_id = ?', [projectId])
  await queryRows(database, 'DELETE FROM scenario_entries WHERE project_id = ?', [projectId])
  await queryRows(database, 'DELETE FROM catalog_pages WHERE project_id = ?', [projectId])
  await queryRows(database, 'DELETE FROM pages WHERE project_id = ?', [projectId])
  await queryRows(database, 'DELETE FROM chapters WHERE project_id = ?', [projectId])
}

/** Converts a scenario database row to its authored page or chapter reference. */
function scenarioEntryFromRow(row: SqlRow): QuizHuntDocument['scenarioEntries'][number] {
  if (row.chapter_id === null) return { kind: 'page', pageId: sqliteStringValue(row, 'page_id') }
  return { kind: 'chapter', chapterId: sqliteStringValue(row, 'chapter_id') }
}

/** Converts a shared media row to its document metadata. */
function mediaFromRow(row: SqlRow): MediaMetadata {
  return {
    id: sqliteStringValue(row, 'media_id'),
    name: sqliteStringValue(row, 'name'),
    mimeType: sqliteStringValue(row, 'mime_type'),
    size: sqliteNumberValue(row, 'size_bytes'),
    caption: sqliteNullableText(row, 'media_caption') ?? '',
  }
}

/** Converts one SQLite project row to the public API summary. */
function projectSummaryFromRow(row: SqlRow): ProjectSummary {
  return {
    id: sqliteStringValue(row, 'project_id'),
    name: sqliteStringValue(row, 'name'),
    revision: sqliteNumberValue(row, 'revision'),
  }
}

/** Returns all rows from one parameterized SQLite statement. */
async function queryRows(database: ProjectDatabase, text: string, values: unknown[] = []): Promise<SqlRow[]> {
  const result = await database.exec(rawSql(text, values)) as DataManipulationResult
  return result.rows ?? []
}

/** Executes one query prepared by a shared BDC resource. */
async function executePreparedQuery(database: ProjectDatabase, query: SqliteQuery): Promise<void> {
  await queryRows(database, query.text, [...query.values])
}

/** Orders rows by their shared relational position column. */
function byPosition(left: SqlRow, right: SqlRow): number {
  return sqliteNumberValue(left, 'position') - sqliteNumberValue(right, 'position')
}

/** Serializes optional JSON metadata without adding document fields. */
function serializeOptionalJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value)
}

/** Requires one returned SQLite row after an update promised to match. */
function requireRow(row: SqlRow | undefined, message: string): SqlRow {
  if (row === undefined) throw new Error(message)
  return row
}
