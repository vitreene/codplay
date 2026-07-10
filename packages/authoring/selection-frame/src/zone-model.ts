/**
 * Pure state + operations for the zone editor's data model — no DOM, no gesture, testable in
 * isolation (`2026-07-03-selection-frame-variantes-plan.md` §Éditeur de zones, step 5). A zone's
 * `{row,col,rowSpan,colSpan}` shares the exact vocabulary of capsule-automation's own
 * `AutoCapsuleChildPlacementInput` (1-based indices, `number` span counts) — no translation layer
 * needed between what this module produces and what capsule-automation resolves into CSS.
 */

export type ZoneGridModel = {
  rows: number
  cols: number
  /** CSS gap — coarse grids only (see `MAX_GAP_ROWS_COLS_FOR_CSS_GAP` below). */
  gap?: { row: number; col: number }
  padding?: { top: number; right: number; bottom: number; left: number }
  /** Default fake-gap width (contiguous cells) applied to a split when the caller omits one. */
  fakeGapUnits?: number
}

export type ZoneDef = {
  name: string
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
 * Lowest unused `z{n}` — the plan's own default-naming convention (§Gestes d'édition: "nom par
 * défaut (z1, z2, … premier libre)"). Reused identically for split's own fallback base name.
 */
function firstFreeName(existingNames: ReadonlySet<string>, base = 'z'): string {
  for (let n = 1; n < 100_000; n += 1) {
    const candidate = `${base}${n}`
    if (!existingNames.has(candidate)) return candidate
  }
  throw new Error('firstFreeName: unable to allocate a free zone name')
}

function namesOf(state: ZoneEditorState): Set<string> {
  return new Set(state.zones.map((z) => z.name))
}

/** Adds one zone at the given footprint — `name` defaults to the first free `z{n}`. */
export function addZone(state: ZoneEditorState, area: { row: number; col: number; rowSpan: number; colSpan: number }, name?: string): ZoneEditorState {
  const existingNames = namesOf(state)
  const resolvedName = name ?? firstFreeName(existingNames)
  if (existingNames.has(resolvedName)) {
    throw new Error(`addZone: a zone named '${resolvedName}' already exists`)
  }
  return { ...state, zones: [...state.zones, { name: resolvedName, ...area }] }
}

export function removeZone(state: ZoneEditorState, name: string): ZoneEditorState {
  return { ...state, zones: state.zones.filter((z) => z.name !== name) }
}

export function renameZone(state: ZoneEditorState, name: string, next: string): ZoneEditorState {
  if (name === next) return state
  if (state.zones.some((z) => z.name === next)) {
    throw new Error(`renameZone: a zone named '${next}' already exists`)
  }
  const target = state.zones.find((z) => z.name === name)
  if (!target) throw new Error(`renameZone: no zone named '${name}'`)
  return { ...state, zones: state.zones.map((z) => (z.name === name ? { ...z, name: next } : z)) }
}

export type SplitOptions = { rows: number[]; cols: number[] }

/**
 * The valid equal-part counts for one axis of `span`, given a fake gap of `gapUnits` contiguous
 * cells kept between each part — plan's own formula (§Gestes d'édition): parts stay equal, the
 * gap stays constant, so `n` is valid only when `(span - (n-1)*gapUnits)` divides evenly by `n`.
 * `gapUnits:0` (no fake gap) reduces to "the integer divisors of span", the plan's own base case.
 */
function validSplitCounts(span: number, gapUnits: number): number[] {
  const valid: number[] = []
  for (let n = 1; n <= span; n += 1) {
    const usable = span - (n - 1) * gapUnits
    if (usable > 0 && usable % n === 0) valid.push(n)
  }
  return valid
}

/**
 * Every valid split count for a zone, on each axis independently, at the grid's own default fake
 * gap (or 0 when none is configured) — what the editor offers the author before calling
 * `splitZone`. Reading this instead of `splitZone` guessing on its own keeps one source of truth
 * for "which counts are even possible" between the preview UI and the actual mutation.
 */
export function getSplitOptions(state: ZoneEditorState, name: string): SplitOptions {
  const zone = state.zones.find((z) => z.name === name)
  if (!zone) throw new Error(`getSplitOptions: no zone named '${name}'`)
  const gapUnits = state.grid.fakeGapUnits ?? 0
  return {
    rows: validSplitCounts(zone.rowSpan, gapUnits),
    cols: validSplitCounts(zone.colSpan, gapUnits),
  }
}

/**
 * Splits one zone into `div.rows * div.cols` equal children (each axis independent — omitting one
 * leaves it un-split, i.e. `1`), replacing the source zone. Children are named `${name}-1`,
 * `${name}-2`, … in row-major order (plan's own example: "z3-1, z3-2, …").
 */
export function splitZone(state: ZoneEditorState, name: string, div: { rows?: number; cols?: number; gapUnits?: number }): { state: ZoneEditorState; createdNames: string[] } {
  const zone = state.zones.find((z) => z.name === name)
  if (!zone) throw new Error(`splitZone: no zone named '${name}'`)

  const gapUnits = div.gapUnits ?? state.grid.fakeGapUnits ?? 0
  const rowCount = div.rows ?? 1
  const colCount = div.cols ?? 1

  const rowPartSize = (zone.rowSpan - (rowCount - 1) * gapUnits) / rowCount
  const colPartSize = (zone.colSpan - (colCount - 1) * gapUnits) / colCount
  if (!Number.isInteger(rowPartSize) || rowPartSize <= 0 || !Number.isInteger(colPartSize) || colPartSize <= 0) {
    throw new Error(`splitZone: ${rowCount}x${colCount} with gapUnits=${gapUnits} does not divide zone '${name}' (${zone.rowSpan}x${zone.colSpan}) into equal integer parts`)
  }

  const children: ZoneDef[] = []
  const createdNames: string[] = []
  let index = 1
  for (let r = 0; r < rowCount; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const childName = `${zone.name}-${index}`
      children.push({
        name: childName,
        row: zone.row + r * (rowPartSize + gapUnits),
        col: zone.col + c * (colPartSize + gapUnits),
        rowSpan: rowPartSize,
        colSpan: colPartSize,
      })
      createdNames.push(childName)
      index += 1
    }
  }

  const nextState: ZoneEditorState = { ...state, zones: [...state.zones.filter((z) => z.name !== name), ...children] }
  return { state: nextState, createdNames }
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

  const rowStart = Math.min(...zones.map((z) => z.row))
  const colStart = Math.min(...zones.map((z) => z.col))
  const rowEnd = Math.max(...zones.map((z) => z.row + z.rowSpan))
  const colEnd = Math.max(...zones.map((z) => z.col + z.colSpan))

  const mergedName = name ?? zones[0]!.name
  const merged: ZoneDef = { name: mergedName, row: rowStart, col: colStart, rowSpan: rowEnd - rowStart, colSpan: colEnd - colStart }

  const remaining = state.zones.filter((z) => !names.includes(z.name))
  return { state: { ...state, zones: [...remaining, merged] }, mergedName }
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
