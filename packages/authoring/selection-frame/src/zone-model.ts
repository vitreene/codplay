/**
 * Pure state + operations for the zone editor's data model — no DOM, no gesture, testable in
 * isolation (`2026-07-10-zone-container-design.md`, superseding `2026-07-03-selection-frame-variantes-plan.md`
 * §Éditeur de zones' own original split model). A zone's `{row,col,rowSpan,colSpan}` shares the
 * exact vocabulary of capsule-automation's own `AutoCapsuleChildPlacementInput` (1-based indices,
 * `number` span counts) — no translation layer needed between what this module produces and what
 * capsule-automation resolves into CSS.
 */

export type ZoneGridModel = {
  rows: number
  cols: number
  /** CSS gap — coarse grids only (see `MAX_GAP_ROWS_COLS_FOR_CSS_GAP` below). */
  gap?: { row: number; col: number }
  padding?: { top: number; right: number; bottom: number; left: number }
}

/**
 * `id` is stable and persistent — never reassigned, not even by `renameZone`. `name` is the
 * displayed/renamable label. Any future attachment (a capsule child bound to a specific zone)
 * references `id`, never `name` — a rename never breaks an existing attachment (design doc
 * §Identifiant stable).
 *
 * `container`, when present, means this SAME zone has been divided (design doc §`container` —
 * propriété optionnelle de `ZoneDef`) — never a separate entity in a separate list: "container est
 * une propriété d'une zone... pas de raison d'en faire une entité à part" (user, 2026-07-11). Its
 * own `row`/`col`/`rowSpan`/`colSpan` never change because of `container` — that's still where the
 * zone lives on the main grid. A zone without `container` behaves exactly as it always has.
 */
export type ZoneDef = {
  id: string
  name: string
  row: number
  col: number
  rowSpan: number
  colSpan: number
  container?: ZoneContainerData
}

/**
 * A persistent division structure carried by one `ZoneDef.container` (design doc §`container` —
 * interne au zone-editor: never a capsule, never resolved through capsule-automation). Born from
 * `divideZone` (always 2 children on one axis — "diviser en 2" is the founding signal, never an
 * arbitrary rows×cols chosen upfront), grown via `resizeContainerAxis`, and dissolved via
 * `breakContainer` (relative→absolute transposition, figée). Rendered as a real, AUTONOMOUS
 * `display:grid` inside the zone's own DOM node (design doc §Rendu) — never inherited via
 * `subgrid` (ruled out: this module always renders zones in a separate overlay, never a true DOM
 * descendant of a real grid parent), and never the grid-fine-principale's own per-cell rendering
 * mechanism (bounded to one division's own rows×cols, generally 2 to a few dozen — never the
 * ~14400-track scale that forced the background-gradient rewrite for the main grid).
 */
export type ZoneContainerData = {
  grid: { rows: number; cols: number; gap?: { row: number; col: number } }
  children: ZoneContainerChild[]
}

/**
 * One child of a `ZoneContainerData`, in coordinates RELATIVE to its own local grid (1-based, same
 * vocabulary as `ZoneDef`). No `name` of its own — a container child has no editable identity
 * before the container is broken (design doc §Nommage des enfants): its displayed name is computed
 * from the owning zone's own `name` + row/col, never stored. `id` is the only stable reference
 * available before a break — an attachment made against this `id` survives both later container
 * edits (axis resize) and the eventual break itself (the `id` carries over unchanged onto the
 * resulting `ZoneDef`).
 */
export type ZoneContainerChild = {
  id: string
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

export type ZoneEditorState = {
  grid: ZoneGridModel
  /** Zones may overlap — no uniqueness constraint on placement, only on `name`. */
  zones: ZoneDef[]
}

/**
 * A saved card IS a complete `ZoneEditorState` — explicit alias documenting the intent in code
 * rather than by implicit convention (design doc §Card — contrat de type dédié). A future
 * host-project UI saves one via `getState(): ZoneCard`, applies one via `setState(card: ZoneCard)`
 * — both already exist on `ZoneEditorHandle`, nothing new needed here. `container` is one tool
 * among others to build a card's own zone collection, never the definition of what a card is
 * (design doc §Rapport à « card »).
 */
export type ZoneCard = ZoneEditorState

/**
 * Above this many rows/cols on either axis, CSS `gap` is disallowed by this model (plan §Affichage
 * de la grille : "grilles fines n'utilisent pas de gap CSS" — visual gaps become reserved tracks
 * instead). Below it, `gap` stays a normal CSS property.
 */
export const MAX_GAP_ROWS_COLS_FOR_CSS_GAP = 32

export type ZoneModelValidationError = {
  code: 'ZONE_GRID_GAP_NOT_ALLOWED_ON_FINE_GRID'
  message: string
}

/**
 * A grid this fine must express visual spacing as reserved tracks (`reserveTracksForGap`), never
 * CSS `gap` — enforced here rather than left to the caller to remember.
 */
export function validateZoneGridModel(grid: ZoneGridModel): ZoneModelValidationError[] {
  if (!grid.gap) return []
  const isFine = grid.rows > MAX_GAP_ROWS_COLS_FOR_CSS_GAP || grid.cols > MAX_GAP_ROWS_COLS_FOR_CSS_GAP
  if (!isFine) return []
  return [
    {
      code: 'ZONE_GRID_GAP_NOT_ALLOWED_ON_FINE_GRID',
      message: `CSS gap is not allowed on a grid this fine (${grid.rows}x${grid.cols}, threshold ${MAX_GAP_ROWS_COLS_FOR_CSS_GAP}) — use reserved tracks instead`,
    },
  ]
}

/**
 * Every zone-editor-scoped name currently in use — one list now that `container` lives on
 * `ZoneDef` itself (a zone with `container` is still just one entry here). Container children's
 * computed names are NOT included, since they carry no name of their own to collide with (design
 * doc §Nommage des enfants).
 */
function namesOf(state: ZoneEditorState): Set<string> {
  return new Set(state.zones.map((z) => z.name))
}

/**
 * Every zone `id` currently in use — every `ZoneDef`'s own `id`, AND every container child's own
 * `id` (children do carry a real, stable `id` even without a `name` of their own — design doc
 * §Identifiant stable). Used only to keep freshly generated ids collision-free within one state;
 * never exposed.
 */
function idsOf(state: ZoneEditorState): Set<string> {
  const ids = new Set<string>()
  for (const zone of state.zones) {
    ids.add(zone.id)
    if (zone.container) for (const child of zone.container.children) ids.add(child.id)
  }
  return ids
}

/**
 * Lowest unused `z{n}` — the plan's own default-naming convention (§Gestes d'édition: "nom par
 * défaut (z1, z2, … premier libre)").
 */
function firstFreeName(existingNames: ReadonlySet<string>, base = 'z'): string {
  for (let n = 1; n < 100_000; n += 1) {
    const candidate = `${base}${n}`
    if (!existingNames.has(candidate)) return candidate
  }
  throw new Error('firstFreeName: unable to allocate a free zone name')
}

/**
 * Lowest unused `id{n}` — id generation is explicitly unnormed by the design doc (any scheme is
 * fine); this one is deterministic and collision-checked against the CURRENT state only, which is
 * simple to reason about and to test. Not claimed to survive a remove-then-re-add at the same
 * position (design doc §Génération de l'id notes that possibility as a non-normative nicety, only
 * worth taking if it falls out for free — a counter scoped to "what exists right now" does not
 * provide it, and this module does not attempt to).
 */
function firstFreeId(existingIds: ReadonlySet<string>): string {
  for (let n = 1; n < 100_000; n += 1) {
    const candidate = `id${n}`
    if (!existingIds.has(candidate)) return candidate
  }
  throw new Error('firstFreeId: unable to allocate a free zone id')
}

/** Adds one zone at the given footprint — `name` defaults to the first free `z{n}`, `id` is always freshly generated. */
export function addZone(state: ZoneEditorState, area: { row: number; col: number; rowSpan: number; colSpan: number }, name?: string): ZoneEditorState {
  const existingNames = namesOf(state)
  const resolvedName = name ?? firstFreeName(existingNames)
  if (existingNames.has(resolvedName)) {
    throw new Error(`addZone: a zone named '${resolvedName}' already exists`)
  }
  const id = firstFreeId(idsOf(state))
  return { ...state, zones: [...state.zones, { id, name: resolvedName, ...area }] }
}

/** Any zone by `name` — a zone carrying `container` removes just as any other (its children go with it). */
export function removeZone(state: ZoneEditorState, name: string): ZoneEditorState {
  return { ...state, zones: state.zones.filter((z) => z.name !== name) }
}

/** Any zone by `name` — `id` never changes; a container child has no name of its own to rename (design doc §Nommage des enfants). */
export function renameZone(state: ZoneEditorState, name: string, next: string): ZoneEditorState {
  if (name === next) return state
  if (namesOf(state).has(next)) {
    throw new Error(`renameZone: a zone named '${next}' already exists`)
  }
  const target = state.zones.find((z) => z.name === name)
  if (!target) throw new Error(`renameZone: no zone named '${name}'`)
  return { ...state, zones: state.zones.map((z) => (z.name === name ? { ...z, name: next } : z)) }
}

/**
 * Merges 2+ zones into one covering their bounding footprint (min/max of origins and extents in
 * track indices, plan's own definition) — the merged zone takes the first selected zone's own
 * name unless `name` is given explicitly, and the source zones are removed.
 */
export function mergeZones(state: ZoneEditorState, names: string[], name?: string): { state: ZoneEditorState; mergedName: string } {
  if (names.length < 2) throw new Error('mergeZones: at least 2 zone names are required')
  const zones = names.map((n) => {
    const zone = state.zones.find((z) => z.name === n)
    if (!zone) throw new Error(`mergeZones: no zone named '${n}'`)
    return zone
  })
  // A zone carrying `container` cannot merge — its division structure has no meaning attached to
  // a bounding-box footprint different from its own; merging would silently drop it. Explicit
  // rejection, not a silent data loss.
  const dividedName = zones.find((z) => z.container)?.name
  if (dividedName !== undefined) {
    throw new Error(`mergeZones: '${dividedName}' has been divided (carries a container) — break it before merging`)
  }

  const rowStart = Math.min(...zones.map((z) => z.row))
  const colStart = Math.min(...zones.map((z) => z.col))
  const rowEnd = Math.max(...zones.map((z) => z.row + z.rowSpan))
  const colEnd = Math.max(...zones.map((z) => z.col + z.colSpan))

  const mergedName = name ?? zones[0]!.name
  // Inherits the first selected zone's own `id`, same convention as `mergedName` defaulting to
  // the first selected zone's own `name` — the merged zone continues that zone's own identity.
  const merged: ZoneDef = { id: zones[0]!.id, name: mergedName, row: rowStart, col: colStart, rowSpan: rowEnd - rowStart, colSpan: colEnd - colStart }

  const remaining = state.zones.filter((z) => !names.includes(z.name))
  return { state: { ...state, zones: [...remaining, merged] }, mergedName }
}

export type Axis = 'row' | 'col'

/**
 * Adds `container` to an existing zone — the SAME `ZoneDef` gains the field, never removed from
 * `zones`, never a new entry created (design doc §`container` — propriété optionnelle de `ZoneDef`:
 * "container est une propriété d'une zone... pas de raison d'en faire une entité à part"). ALWAYS
 * a 2-way split on ONE axis — "diviser en 2" is the founding signal (design doc §Cycle de vie),
 * never an arbitrary rows×cols chosen upfront. `axis` defaults to `'col'` (vertical split, 2
 * columns) when the host UI has no explicit setting — an explicit user decision, never derived
 * from a heuristic (zone size, aspect ratio, etc.). The zone's own `row`/`col`/`rowSpan`/`colSpan`
 * are untouched — dividing a zone never moves it on the main grid.
 */
export function divideZone(state: ZoneEditorState, name: string, axis: Axis = 'col'): ZoneEditorState {
  const zone = state.zones.find((z) => z.name === name)
  if (!zone) throw new Error(`divideZone: no zone named '${name}'`)
  if (zone.container) throw new Error(`divideZone: '${name}' already carries a container — resize its axis instead`)

  const existingIds = idsOf(state)
  const firstChildId = firstFreeId(existingIds)
  existingIds.add(firstChildId)
  const secondChildId = firstFreeId(existingIds)

  const isRow = axis === 'row'
  const children: ZoneContainerChild[] = [
    { id: firstChildId, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
    { id: secondChildId, row: isRow ? 2 : 1, col: isRow ? 1 : 2, rowSpan: 1, colSpan: 1 },
  ]

  const container: ZoneContainerData = { grid: isRow ? { rows: 2, cols: 1 } : { rows: 1, cols: 2 }, children }
  return { ...state, zones: state.zones.map((z) => (z.name === name ? { ...z, container } : z)) }
}

/**
 * Adjusts one axis' own division count on an existing container — the same function for both a
 * keyboard-driven adjustment and a direct API call (design doc §API). "Les zones-enfants
 * correspondent aux cellules d'une grille" (user, 2026-07-11) — this is a real grid, not an
 * abstract rows×cols counter: `children` is REGENERATED to exactly match `rows×cols`, one 1×1
 * child per cell, every time the count changes. Cells that existed before keep their own `id`
 * (an attachment survives), cells added by growing an axis get a fresh `id`, cells removed by
 * shrinking an axis simply disappear along with their own `id` (no attachment can survive that —
 * there's nothing left to point at).
 *
 * Throws if `name` doesn't carry a live `container`, or if the resulting count on this axis would
 * be below the divider's own floor (`count < 2` — "on passe de deux à un, jamais à zéro"; the
 * floor is GLOBAL, not per-axis: a container always has at least 2 children regardless of which
 * axis holds them). No "out of bounds" rejection anymore — shrinking simply drops the cells that
 * no longer exist, exactly like removing a row/column from any grid.
 */
export function resizeContainerAxis(state: ZoneEditorState, name: string, axis: Axis, count: number): ZoneEditorState {
  const zone = state.zones.find((z) => z.name === name)
  if (!zone?.container) throw new Error(`resizeContainerAxis: '${name}' does not carry a container`)
  if (count < 2) throw new Error(`resizeContainerAxis: count must be >= 2 (a container never has fewer than 2 children), got ${count}`)

  const nextGrid = axis === 'row' ? { ...zone.container.grid, rows: count } : { ...zone.container.grid, cols: count }

  const existingIdByCell = new Map<string, string>()
  for (const child of zone.container.children) existingIdByCell.set(`${child.row}.${child.col}`, child.id)

  const existingIds = idsOf(state)
  const children: ZoneContainerChild[] = []
  for (let row = 1; row <= nextGrid.rows; row += 1) {
    for (let col = 1; col <= nextGrid.cols; col += 1) {
      const preservedId = existingIdByCell.get(`${row}.${col}`)
      const id = preservedId ?? firstFreeId(existingIds)
      existingIds.add(id)
      children.push({ id, row, col, rowSpan: 1, colSpan: 1 })
    }
  }

  return { ...state, zones: state.zones.map((z) => (z.name === name ? { ...z, container: { grid: nextGrid, children } } : z)) }
}

/**
 * Breaks ONE zone's own `container` — relative→absolute transposition, figée (design doc §Cycle
 * de vie: the geometry is exactly what was displayed at the moment of the call, never recomputed
 * later). The SOURCE zone (the one carrying `container`) is removed from `zones`, replaced by one
 * `ZoneDef` per child. Each child gains a real `name` (computed here, now persisted) built from
 * the source zone's own `name` + its local row/col; its `id` carries over unchanged (an
 * attachment already bound to that `id` survives the break). Never applied in bulk across every
 * divided zone — a caller that wants to "break everything" iterates `state.zones.filter(z =>
 * z.container)` itself and calls this once per zone.
 */
export function breakContainer(state: ZoneEditorState, name: string): { state: ZoneEditorState; createdNames: string[] } {
  const zone = state.zones.find((z) => z.name === name)
  if (!zone?.container) throw new Error(`breakContainer: '${name}' does not carry a container`)

  const rowPartSize = zone.rowSpan / zone.container.grid.rows
  const colPartSize = zone.colSpan / zone.container.grid.cols

  const created: ZoneDef[] = zone.container.children.map((child) => ({
    id: child.id,
    name: computeContainerChildName(zone.name, child.row, child.col),
    row: zone.row + (child.row - 1) * rowPartSize,
    col: zone.col + (child.col - 1) * colPartSize,
    rowSpan: child.rowSpan * rowPartSize,
    colSpan: child.colSpan * colPartSize,
  }))
  const createdNames = created.map((z) => z.name)

  return {
    state: { ...state, zones: [...state.zones.filter((z) => z.name !== name), ...created] },
    createdNames,
  }
}

/** Computed display name of one container child — never stored (design doc §Nommage des enfants). */
export function computeContainerChildName(zoneName: string, row: number, col: number): string {
  return `${zoneName}.${row}.${col}`
}

/**
 * Read-only listing of EVERY named zone in the scene — every `ZoneDef` (feuille ou portant
 * `container`) AND every container child — for the attachment context (design doc §API: a future
 * item-attachment UI needs "toutes les zones... accessibles (pas d'édition dans ce contexte)").
 * Never used for editing itself — renaming or removing an individual container child stays
 * impossible before a break (§Nommage des enfants).
 */
export function listAllZoneNames(state: ZoneEditorState): Array<{ id: string; name: string; kind: 'leaf' | 'container-child'; containerId?: string }> {
  const zones = state.zones.map((z) => ({ id: z.id, name: z.name, kind: 'leaf' as const }))
  const containerChildren = state.zones.flatMap((z) =>
    z.container
      ? z.container.children.map((child) => ({
          id: child.id,
          name: computeContainerChildName(z.name, child.row, child.col),
          kind: 'container-child' as const,
          containerId: z.id,
        }))
      : []
  )
  return [...zones, ...containerChildren]
}

/**
 * Reserved-track adjustment for a fine grid that needs visual gaps (plan §Affichage de la grille:
 * `n × pas + (n − 1) × gapUnits` doesn't generally land exactly on the fine grid's own row/col
 * count — e.g. 16 macro-cells at step 10 + 15 reserved tracks = 175, not 160). Picks the
 * `macroCount` nearest to `preferredMacroCount` for which the reserved layout fits within
 * `maxFineTracks`, and returns the exact fine-track count that layout consumes — the caller
 * corrects `ZoneGridModel.rows`/`.cols` to this value.
 */
export function adjustFineGridForReservedTracks(input: {
  maxFineTracks: number
  stepSize: number
  reservedGapUnits: number
  preferredMacroCount: number
}): { macroCount: number; fineTrackCount: number } {
  const { maxFineTracks, stepSize, reservedGapUnits, preferredMacroCount } = input
  const layoutSize = (macroCount: number): number => macroCount * stepSize + Math.max(0, macroCount - 1) * reservedGapUnits

  let best: { macroCount: number; fineTrackCount: number } | undefined
  let bestDistance = Infinity
  for (let macroCount = 1; macroCount * stepSize <= maxFineTracks; macroCount += 1) {
    const fineTrackCount = layoutSize(macroCount)
    if (fineTrackCount > maxFineTracks) continue
    const distance = Math.abs(macroCount - preferredMacroCount)
    if (distance < bestDistance) {
      bestDistance = distance
      best = { macroCount, fineTrackCount }
    }
  }
  if (!best) throw new Error(`adjustFineGridForReservedTracks: no macroCount fits within maxFineTracks=${maxFineTracks} at stepSize=${stepSize}`)
  return best
}
