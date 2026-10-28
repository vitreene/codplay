import { rawSql } from 'remix/data-table'
import type { Database, DataManipulationResult } from 'remix/data-table'
import type { SqliteDatabase } from 'remix/data-table/sqlite'
import type {
  CapsuleDef,
  Content,
  Decor,
  EditorScene,
  Item,
  Keyframe,
  KeyframeChannel,
  Zone,
} from '../../../app/commands/types'
import { assertJsonCompatible, stringifyJson } from '../../../app/persistence/json-serialization'
import type {
  EditorSceneSummary,
  SaveEditorSceneResult,
  StoredEditorScene,
} from '../../../app/persistence/editor-scene-persistence-types'

type SceneDatabase = Pick<Database<'sqlite'>, 'exec'>
type SqlRow = Record<string, unknown>

/** Stores complete EditorScene documents in normalized SQLite tables. */
export class SqliteEditorScenePersistence {
  private readonly database: SqliteDatabase

  /** Creates the repository around an already migrated Remix SQLite database. */
  constructor(database: SqliteDatabase) {
    this.database = database
  }

  /** Lists scene labels and revisions without loading document details. */
  async listScenes(): Promise<EditorSceneSummary[]> {
    const rows = await queryRows(this.database, `
      SELECT scene_id, title, revision
      FROM editor_scenes
      ORDER BY title COLLATE NOCASE, scene_id
    `)
    return rows.map((row) => ({
      id: stringValue(row, 'scene_id'),
      title: stringValue(row, 'title'),
      revision: numberValue(row, 'revision'),
    }))
  }

  /** Loads the active scene identity selected in the editor workspace. */
  async findActiveSceneId(): Promise<string | null> {
    const rows = await queryRows(this.database,
      'SELECT active_scene_id FROM editor_state WHERE state_id = 1')
    return rows[0] === undefined ? null : nullableText(rows[0], 'active_scene_id')
  }

  /** Loads one complete author document and its optimistic concurrency revision. */
  async findScene(sceneId: string): Promise<StoredEditorScene | null> {
    return this.database.transaction(async (transaction) => readScene(transaction, sceneId))
  }

  /** Changes the active scene only after verifying that the target document exists. */
  async setActiveSceneId(sceneId: string | null): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      if (sceneId !== null && (await queryRows(transaction,
        'SELECT scene_id FROM editor_scenes WHERE scene_id = ?', [sceneId])).length === 0) return false
      await writeActiveSceneId(transaction, sceneId)
      return true
    })
  }

  /** Saves one stable document snapshot, refusing a stale revision instead of overwriting it. */
  async saveScene(scene: EditorScene, expectedRevision: number | null): Promise<SaveEditorSceneResult> {
    assertJsonCompatible(scene)
    assertSceneRelations(scene)
    return this.database.transaction(async (transaction) => {
      const currentRows = await queryRows(transaction,
        'SELECT revision FROM editor_scenes WHERE scene_id = ?', [scene.id])
      const current = currentRows[0]
      const now = new Date().toISOString()
      let revision: number

      if (current === undefined) {
        if (expectedRevision !== null) return { kind: 'conflict', currentRevision: null }
        revision = 0
        await insertSceneHeader(transaction, scene, revision, now)
      } else {
        const currentRevision = numberValue(current, 'revision')
        if (expectedRevision !== currentRevision) return { kind: 'conflict', currentRevision }
        revision = currentRevision + 1
        const updated = await queryRows(transaction, `
          UPDATE editor_scenes SET
            title = ?, duration_ms = ?, duration_source = ?, time_unit = ?, capsule_order = ?,
            scene_state_json = ?, hooks_json = ?, root_capsule_json = ?, root_decor_id = ?,
            master_item_id = ?, marker_tracks_json = ?, revision = ?, updated_at = ?
          WHERE scene_id = ? AND revision = ?
          RETURNING scene_id
        `, [
          scene.meta.title,
          scene.meta.durationMs,
          scene.meta.durationSource,
          scene.meta.timeUnit,
          scene.meta.capsuleOrder,
          optionalJson(scene.meta.sceneState),
          optionalJson(scene.meta.hooks),
          optionalJson(scene.rootCapsule),
          scene.rootDecorId ?? null,
          scene.masterItemId ?? null,
          stringifyJson(scene.markerTracks),
          revision,
          now,
          scene.id,
          currentRevision,
        ])
        if (updated.length === 0) return { kind: 'conflict', currentRevision }
        await deleteSceneRows(transaction, scene.id)
      }

      await insertSceneRows(transaction, scene)
      await writeActiveSceneId(transaction, scene.id)
      return { kind: 'saved', revision }
    })
  }
}

/** Inserts the stable scene header for a new document. */
async function insertSceneHeader(database: SceneDatabase, scene: EditorScene, revision: number, now: string): Promise<void> {
  await queryRows(database, `
    INSERT INTO editor_scenes (
      scene_id, title, duration_ms, duration_source, time_unit, capsule_order,
      scene_state_json, hooks_json, root_capsule_json, root_decor_id,
      master_item_id, marker_tracks_json, revision, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    scene.id,
    scene.meta.title,
    scene.meta.durationMs,
    scene.meta.durationSource,
    scene.meta.timeUnit,
    scene.meta.capsuleOrder,
    optionalJson(scene.meta.sceneState),
    optionalJson(scene.meta.hooks),
    optionalJson(scene.rootCapsule),
    scene.rootDecorId ?? null,
    scene.masterItemId ?? null,
    stringifyJson(scene.markerTracks),
    revision,
    now,
    now,
  ])
}

/** Replaces every scene-owned relation while preserving the global media catalogue. */
async function deleteSceneRows(database: SceneDatabase, sceneId: string): Promise<void> {
  await queryRows(database, 'DELETE FROM capsule_items WHERE scene_id = ?', [sceneId])
  await queryRows(database, 'DELETE FROM keyframes WHERE scene_id = ?', [sceneId])
  await queryRows(database, 'DELETE FROM zones WHERE scene_id = ?', [sceneId])
  await queryRows(database, 'DELETE FROM capsules WHERE scene_id = ?', [sceneId])
  await queryRows(database, 'DELETE FROM items WHERE scene_id = ?', [sceneId])
  await queryRows(database, 'DELETE FROM contents WHERE scene_id = ?', [sceneId])
  await queryRows(database, 'DELETE FROM decors WHERE scene_id = ?', [sceneId])
}

/** Writes normalized rows for all records referenced by one scene snapshot. */
async function insertSceneRows(database: SceneDatabase, scene: EditorScene): Promise<void> {
  for (const content of Object.values(scene.contents)) await insertContent(database, scene.id, content)
  for (const decor of Object.values(scene.decors)) await insertDecor(database, scene.id, decor)
  for (const [sceneOrdinal, item] of scene.items.entries()) await insertItem(database, scene.id, sceneOrdinal, item)
  for (const item of scene.items) {
    if (item.capsule !== undefined) await insertCapsule(database, scene.id, item.id, item.capsule)
  }
  for (const item of scene.items) await insertCapsuleMembership(database, scene.id, item)
  for (const item of scene.items) {
    for (const [ordinal, keyframe] of item.keyframes.entries()) {
      await insertKeyframe(database, scene.id, item.id, ordinal, keyframe)
    }
  }
  for (const zone of Object.values(scene.zones)) await insertZone(database, scene.id, zone)
}

/** Validates document-level references that SQL cannot check inside an opaque decor JSON value. */
function assertSceneRelations(scene: EditorScene): void {
  const zones = scene.zones
  const decorOwners = new Map<string, Array<string | null>>()
  for (const [contentId, content] of Object.entries(scene.contents)) {
    if (contentId !== content.id) throw new Error(`Clé de contenu incohérente : « ${contentId} » ≠ « ${content.id} ».`)
  }
  for (const [decorId, decor] of Object.entries(scene.decors)) {
    if (decorId !== decor.id) throw new Error(`Clé de décor incohérente : « ${decorId} » ≠ « ${decor.id} ».`)
  }
  for (const [zoneId, zone] of Object.entries(zones)) {
    if (zoneId !== zone.id) throw new Error(`Clé de zone incohérente : « ${zoneId} » ≠ « ${zone.id} ».`)
  }
  if (scene.rootDecorId !== undefined && scene.decors[scene.rootDecorId] === undefined) {
    throw new Error(`Décor racine absent : ${scene.rootDecorId}.`)
  }
  for (const item of scene.items) {
    const decorIds = [item.initialDecorId, ...item.keyframes.map((keyframe) => keyframe.decorId)]
    for (const decorId of decorIds) {
      const owners = decorOwners.get(decorId) ?? []
      owners.push(item.parentId)
      decorOwners.set(decorId, owners)
    }
  }
  if (scene.rootDecorId !== undefined) {
    const owners = decorOwners.get(scene.rootDecorId) ?? []
    owners.push(null)
    decorOwners.set(scene.rootDecorId, owners)
  }

  for (const [decorId, owners] of decorOwners) {
    const decor = scene.decors[decorId]
    if (decor === undefined || decor.zoneId === undefined || decor.zoneId === null) continue
    const zone = zones[decor.zoneId]
    if (zone === undefined) throw new Error(`Zone absente pour le décor « ${decorId} » : ${decor.zoneId}.`)
    if (owners.some((ownerId) => ownerId !== zone.capsuleId)) {
      throw new Error(`La zone « ${zone.id} » ne dépend pas de la capsule parente du décor « ${decorId} ».`)
    }
  }
}

/** Inserts one content record and preserves its source-linked timestamps. */
async function insertContent(database: SceneDatabase, sceneId: string, content: Content): Promise<void> {
  await queryRows(database, `
    INSERT INTO contents (
      scene_id, content_id, content_type, source, media_id, text,
      text_auto_size_json, lang, waveform_json, cues_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    sceneId,
    content.id,
    content.type,
    content.source ?? null,
    content.mediaId ?? null,
    content.text ?? null,
    optionalJson(content.textAutoSize),
    content.lang ?? null,
    optionalJson(content.waveform),
    optionalJson(content.cues),
  ])
}

/** Inserts one opaque decor value without extracting or indexing its properties. */
async function insertDecor(database: SceneDatabase, sceneId: string, decor: Decor): Promise<void> {
  await queryRows(database,
    'INSERT INTO decors (scene_id, decor_id, decor_json) VALUES (?, ?, ?)',
    [sceneId, decor.id, stringifyJson(decor)])
}

/** Inserts one item identity while keeping its hierarchy in capsule_items. */
async function insertItem(database: SceneDatabase, sceneId: string, sceneOrdinal: number, item: Item): Promise<void> {
  await queryRows(database, `
    INSERT INTO items (scene_id, item_id, scene_ordinal, item_type, label, visible, content_id, initial_decor_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [sceneId, item.id, sceneOrdinal, item.type, item.label ?? null, item.visible ? 1 : 0, item.contentId, item.initialDecorId])
}

/** Stores one capsule's static authoring settings separately from its child relations. */
async function insertCapsule(database: SceneDatabase, sceneId: string, itemId: string, capsule: CapsuleDef): Promise<void> {
  await queryRows(database, `
    INSERT INTO capsules (
      scene_id, item_id, kind, distribution_json, grid_json,
      default_transition_in, default_transition_out, behavior
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    sceneId,
    itemId,
    capsule.kind,
    stringifyJson(capsule.distribution),
    optionalJson(capsule.grid),
    capsule.defaultTransitionIn ?? null,
    capsule.defaultTransitionOut ?? null,
    capsule.behavior ?? null,
  ])
}

/** Stores parent capsule and author order; null parent denotes the implicit root. */
async function insertCapsuleMembership(database: SceneDatabase, sceneId: string, item: Item): Promise<void> {
  await queryRows(database, `
    INSERT INTO capsule_items (scene_id, item_id, parent_capsule_id, order_key)
    VALUES (?, ?, ?, ?)
  `, [sceneId, item.id, item.parentId, item.order])
}

/** Stores one timeline keyframe and its references to opaque decor values. */
async function insertKeyframe(
  database: SceneDatabase,
  sceneId: string,
  itemId: string,
  ordinal: number,
  keyframe: Keyframe,
): Promise<void> {
  await queryRows(database, `
    INSERT INTO keyframes (
      scene_id, item_id, keyframe_id, ordinal, time_ms, channel, decor_id,
      transition_in_json, transition_out_json, name, marker_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    sceneId,
    itemId,
    keyframe.id,
    ordinal,
    keyframe.timeMs,
    keyframe.channel ?? null,
    keyframe.decorId,
    optionalJson(keyframe.transitionIn),
    optionalJson(keyframe.transitionOut),
    keyframe.name ?? null,
    keyframe.markerId ?? null,
  ])
}

/** Stores zone ownership and both orientation geometries as relational columns. */
async function insertZone(database: SceneDatabase, sceneId: string, zone: Zone): Promise<void> {
  const { landscape, portrait } = zone.surfaces
  await queryRows(database, `
    INSERT INTO zones (
      scene_id, capsule_id, zone_id, name,
      landscape_row, landscape_col, landscape_row_span, landscape_col_span,
      portrait_row, portrait_col, portrait_row_span, portrait_col_span, container_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    sceneId,
    zone.capsuleId,
    zone.id,
    zone.name,
    landscape.row,
    landscape.col,
    landscape.rowSpan,
    landscape.colSpan,
    portrait.row,
    portrait.col,
    portrait.rowSpan,
    portrait.colSpan,
    optionalJson(zone.container),
  ])
}

/** Loads one complete scene under a consistent database read transaction. */
async function readScene(database: SceneDatabase, sceneId: string): Promise<StoredEditorScene | null> {
  const headers = await queryRows(database, 'SELECT * FROM editor_scenes WHERE scene_id = ?', [sceneId])
  const header = headers[0]
  if (header === undefined) return null

  const contentRows = await queryRows(database, 'SELECT * FROM contents WHERE scene_id = ? ORDER BY content_id', [sceneId])
  const decorRows = await queryRows(database, 'SELECT * FROM decors WHERE scene_id = ? ORDER BY decor_id', [sceneId])
  const itemRows = await queryRows(database, 'SELECT * FROM items WHERE scene_id = ? ORDER BY scene_ordinal', [sceneId])
  const capsuleRows = await queryRows(database, 'SELECT * FROM capsules WHERE scene_id = ?', [sceneId])
  const membershipRows = await queryRows(database, 'SELECT * FROM capsule_items WHERE scene_id = ?', [sceneId])
  const keyframeRows = await queryRows(database, 'SELECT * FROM keyframes WHERE scene_id = ? ORDER BY item_id, ordinal', [sceneId])
  const zoneRows = await queryRows(database, 'SELECT * FROM zones WHERE scene_id = ? ORDER BY zone_id', [sceneId])

  const contents = Object.fromEntries(contentRows.map((row) => {
    const content = contentFromRow(row)
    return [content.id, content]
  }))
  const decors = Object.fromEntries(decorRows.map((row) => {
    const decor = parseJsonColumn<Decor>(row, 'decor_json')
    if (decor.id !== stringValue(row, 'decor_id')) throw new Error('Identifiant de décor incohérent en base.')
    return [decor.id, decor]
  }))
  const capsules = new Map(capsuleRows.map((row) => [stringValue(row, 'item_id'), capsuleFromRow(row)]))
  const memberships = new Map(membershipRows.map((row) => [stringValue(row, 'item_id'), row]))
  const keyframesByItem = new Map<string, Keyframe[]>()
  for (const row of keyframeRows) {
    const itemId = stringValue(row, 'item_id')
    const keyframes = keyframesByItem.get(itemId) ?? []
    keyframes.push(keyframeFromRow(row))
    keyframesByItem.set(itemId, keyframes)
  }
  const items = itemRows.map((row) => {
    const itemId = stringValue(row, 'item_id')
    const membership = memberships.get(itemId)
    if (membership === undefined) throw new Error(`Parent/ordre absent pour l’item « ${itemId} ».`)
    const capsule = capsules.get(itemId)
    const label = nullableText(row, 'label')
    return {
      id: itemId,
      type: stringValue(row, 'item_type') as Item['type'],
      ...(label === null ? {} : { label }),
      parentId: nullableText(membership, 'parent_capsule_id'),
      order: stringValue(membership, 'order_key'),
      visible: numberValue(row, 'visible') === 1,
      contentId: nullableText(row, 'content_id'),
      initialDecorId: stringValue(row, 'initial_decor_id'),
      keyframes: keyframesByItem.get(itemId) ?? [],
      ...(capsule === undefined ? {} : { capsule }),
    } satisfies Item
  })
  const zones = Object.fromEntries(zoneRows.map((row) => {
    const zone = zoneFromRow(row)
    return [zone.id, zone]
  }))
  const scene: EditorScene = {
    id: stringValue(header, 'scene_id'),
    meta: {
      title: stringValue(header, 'title'),
      durationMs: numberValue(header, 'duration_ms'),
      durationSource: stringValue(header, 'duration_source') as EditorScene['meta']['durationSource'],
      timeUnit: stringValue(header, 'time_unit') as EditorScene['meta']['timeUnit'],
      capsuleOrder: stringValue(header, 'capsule_order') as EditorScene['meta']['capsuleOrder'],
      ...optionalJsonProperty(header, 'scene_state_json', 'sceneState'),
      ...optionalJsonProperty(header, 'hooks_json', 'hooks'),
    },
    items,
    contents,
    decors,
    zones,
    markerTracks: parseJsonColumn<EditorScene['markerTracks']>(header, 'marker_tracks_json'),
    ...optionalJsonProperty(header, 'root_capsule_json', 'rootCapsule'),
    ...(nullableText(header, 'root_decor_id') === null ? {} : { rootDecorId: nullableText(header, 'root_decor_id')! }),
    ...(nullableText(header, 'master_item_id') === null ? {} : { masterItemId: nullableText(header, 'master_item_id')! }),
  }
  assertSceneRelations(scene)
  return { scene, revision: numberValue(header, 'revision') }
}

/** Reconstructs one content while omitting nullable database fields from the author object. */
function contentFromRow(row: SqlRow): Content {
  return {
    id: stringValue(row, 'content_id'),
    type: stringValue(row, 'content_type') as Content['type'],
    ...(nullableText(row, 'source') === null ? {} : { source: nullableText(row, 'source')! }),
    ...(nullableText(row, 'media_id') === null ? {} : { mediaId: nullableText(row, 'media_id')! }),
    ...(nullableText(row, 'text') === null ? {} : { text: nullableText(row, 'text')! }),
    ...optionalJsonProperty(row, 'text_auto_size_json', 'textAutoSize'),
    ...(nullableText(row, 'lang') === null ? {} : { lang: nullableText(row, 'lang')! }),
    ...optionalJsonProperty(row, 'waveform_json', 'waveform'),
    ...optionalJsonProperty(row, 'cues_json', 'cues'),
  }
}

/** Reconstructs one capsule's settings from its columns and JSON settings groups. */
function capsuleFromRow(row: SqlRow): CapsuleDef {
  return {
    kind: stringValue(row, 'kind') as CapsuleDef['kind'],
    distribution: parseJsonColumn<CapsuleDef['distribution']>(row, 'distribution_json'),
    ...optionalJsonProperty(row, 'grid_json', 'grid'),
    ...(nullableText(row, 'default_transition_in') === null ? {} : { defaultTransitionIn: nullableText(row, 'default_transition_in')! }),
    ...(nullableText(row, 'default_transition_out') === null ? {} : { defaultTransitionOut: nullableText(row, 'default_transition_out')! }),
    ...(nullableText(row, 'behavior') === null ? {} : { behavior: nullableText(row, 'behavior')! }),
  }
}

/** Reconstructs one keyframe while preserving an omitted legacy channel. */
function keyframeFromRow(row: SqlRow): Keyframe {
  const channel = nullableText(row, 'channel')
  return {
    id: stringValue(row, 'keyframe_id'),
    timeMs: numberValue(row, 'time_ms'),
    decorId: stringValue(row, 'decor_id'),
    ...(channel === null ? {} : { channel: channel as KeyframeChannel }),
    ...optionalJsonProperty(row, 'transition_in_json', 'transitionIn'),
    ...optionalJsonProperty(row, 'transition_out_json', 'transitionOut'),
    ...(nullableText(row, 'name') === null ? {} : { name: nullableText(row, 'name')! }),
    ...(nullableText(row, 'marker_id') === null ? {} : { markerId: nullableText(row, 'marker_id')! }),
  }
}

/** Reconstructs one capsule-owned zone from its relational grid tracks. */
function zoneFromRow(row: SqlRow): Zone {
  return {
    id: stringValue(row, 'zone_id'),
    capsuleId: nullableText(row, 'capsule_id'),
    name: stringValue(row, 'name'),
    surfaces: {
      landscape: {
        row: numberValue(row, 'landscape_row'),
        col: numberValue(row, 'landscape_col'),
        rowSpan: numberValue(row, 'landscape_row_span'),
        colSpan: numberValue(row, 'landscape_col_span'),
      },
      portrait: {
        row: numberValue(row, 'portrait_row'),
        col: numberValue(row, 'portrait_col'),
        rowSpan: numberValue(row, 'portrait_row_span'),
        colSpan: numberValue(row, 'portrait_col_span'),
      },
    },
    ...optionalJsonProperty(row, 'container_json', 'container'),
  }
}

/** Upserts the singleton workspace's active scene id. */
async function writeActiveSceneId(database: SceneDatabase, sceneId: string | null): Promise<void> {
  await queryRows(database, `
    INSERT INTO editor_state (state_id, active_scene_id) VALUES (1, ?)
    ON CONFLICT(state_id) DO UPDATE SET active_scene_id = excluded.active_scene_id
  `, [sceneId])
}

/** Returns rows from one parameterized Remix SQLite statement. */
async function queryRows(database: SceneDatabase, text: string, values: unknown[] = []): Promise<SqlRow[]> {
  const result = await database.exec(rawSql(text, values)) as DataManipulationResult
  return (result.rows ?? []) as SqlRow[]
}

/** Parses a JSON column and omits the corresponding model property for SQL NULL. */
function optionalJsonProperty<Value>(row: SqlRow, column: string, property: string): Record<string, Value> | Record<string, never> {
  const value = nullableText(row, column)
  if (value === null) return {}
  try {
    return { [property]: JSON.parse(value) as Value }
  } catch {
    throw new Error(`Valeur JSON invalide en base : ${column}`)
  }
}

/** Serializes an optional JSON field as SQL NULL when it is absent. */
function optionalJson(value: unknown): string | null {
  return value === undefined ? null : stringifyJson(value)
}

/** Parses one required JSON column from SQLite. */
function parseJsonColumn<Value>(row: SqlRow, key: string): Value {
  const value = stringValue(row, key)
  try {
    return JSON.parse(value) as Value
  } catch {
    throw new Error(`Valeur JSON invalide en base : ${key}`)
  }
}

/** Reads a required string from one SQLite row. */
function stringValue(row: SqlRow, key: string): string {
  const value = row[key]
  if (typeof value !== 'string') throw new Error(`Valeur texte invalide en base : ${key}`)
  return value
}

/** Reads a nullable string and normalizes SQLite NULL. */
function nullableText(row: SqlRow, key: string): string | null {
  const value = row[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error(`Valeur texte invalide en base : ${key}`)
  return value
}

/** Reads a SQLite integer or real value as a finite number. */
function numberValue(row: SqlRow, key: string): number {
  const value = row[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Valeur numérique invalide en base : ${key}`)
  return value
}
