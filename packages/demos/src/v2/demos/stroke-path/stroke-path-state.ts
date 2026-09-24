/** One persisted stroke shared with the V1 Stroke Path local-storage format. */
export type StoredStroke = Readonly<{
  [key: string]: string
  id: string
  d: string
  color: string
}>

/** V1-compatible key retained so both fixture versions can share saved strokes. */
export const STROKE_PATH_STORAGE_KEY = 'codplay-stroke-path-sketch'

type AreaOrigin = Readonly<{ left: number; top: number }>

let areaOrigin: AreaOrigin = { left: 0, top: 0 }

/** Resets the fixture-local pointer origin before a fresh V2 scene mount. */
export function resetStrokePathAreaOrigin(): void {
  areaOrigin = { left: 0, top: 0 }
}

/** Stores one measured scene-local SVG origin for the next capture session. */
export function setStrokePathAreaOrigin(left: number, top: number): void {
  areaOrigin = { left, top }
}

/** Returns the latest fixture-local screen origin used by capture initialization. */
export function getStrokePathAreaOrigin(): AreaOrigin {
  return areaOrigin
}

/** Reads valid persisted strokes, keeping the most recent entry for each ID. */
export function readStoredStrokes(): readonly StoredStroke[] {
  try {
    const raw = globalThis.localStorage?.getItem(STROKE_PATH_STORAGE_KEY)
    if (raw === null || raw === undefined) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const byId = new Map<string, StoredStroke>()
    for (const value of parsed) {
      if (!isStoredStroke(value)) continue
      byId.set(value.id, value)
    }
    return [...byId.values()]
  } catch {
    return []
  }
}

/** Replaces the persisted stroke collection while containing storage failures. */
export function writeStoredStrokes(strokes: readonly StoredStroke[]): void {
  try {
    globalThis.localStorage?.setItem(STROKE_PATH_STORAGE_KEY, JSON.stringify(strokes))
  } catch {
    // Storage is optional for this fixture; drawing remains available in memory.
  }
}

/** Removes the persisted stroke collection while containing storage failures. */
export function clearStoredStrokes(): void {
  try {
    globalThis.localStorage?.removeItem(STROKE_PATH_STORAGE_KEY)
  } catch {
    // Storage is optional for this fixture; clearing the visible strokes still works.
  }
}

/** Checks the stable string fields shared by the V1 and V2 storage formats. */
export function isStoredStroke(value: unknown): value is StoredStroke {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.d === 'string'
    && typeof record.color === 'string'
}
