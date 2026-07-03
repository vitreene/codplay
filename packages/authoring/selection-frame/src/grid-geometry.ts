/**
 * Measured grid track geometry — no uniform-track assumption. Track sizes are
 * read from the container's computed style, where the browser resolves
 * gridTemplateColumns/Rows to pixel lists (v1 plan, «cellules irrégulières»).
 */
export type GridTrackGeometry = {
  /** Resolved column sizes in local px. */
  cols: number[]
  /** Resolved row sizes in local px. */
  rows: number[]
  columnGap: number
  rowGap: number
}

/**
 * Parses one computed track list ("130px 260px 130px") into pixel sizes.
 * Returns null when any entry is not a resolved pixel value (e.g. jsdom
 * returns the authored "1fr 2fr" — no layout engine).
 */
export function parseResolvedTrackList(value: string): number[] | null {
  const parts = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return null
  const sizes: number[] = []
  for (const part of parts) {
    if (!part.endsWith('px')) return null
    const parsed = Number.parseFloat(part)
    if (!Number.isFinite(parsed) || parsed < 0) return null
    sizes.push(parsed)
  }
  return sizes
}

/**
 * Measures the resolved track geometry of one grid container through computed
 * styles. Returns null when the browser did not resolve the templates to px.
 */
export function measureGridTracks(container: Element): GridTrackGeometry | null {
  const win = container.ownerDocument.defaultView
  if (win === null) return null
  const computed = win.getComputedStyle(container)
  const cols = parseResolvedTrackList(computed.gridTemplateColumns)
  const rows = parseResolvedTrackList(computed.gridTemplateRows)
  if (cols === null || rows === null) return null
  const parseGap = (value: string): number => {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return {
    cols,
    rows,
    columnGap: parseGap(computed.columnGap),
    rowGap: parseGap(computed.rowGap)
  }
}

/** Uniform fallback geometry when resolved templates are unavailable. */
export function uniformTrackGeometry(input: {
  rows: number
  cols: number
  localWidth: number
  localHeight: number
  columnGap: number
  rowGap: number
}): GridTrackGeometry {
  const cellWidth = Math.max(1e-3, (input.localWidth - input.columnGap * (input.cols - 1)) / input.cols)
  const cellHeight = Math.max(1e-3, (input.localHeight - input.rowGap * (input.rows - 1)) / input.rows)
  return {
    cols: Array.from({ length: input.cols }, () => cellWidth),
    rows: Array.from({ length: input.rows }, () => cellHeight),
    columnGap: input.columnGap,
    rowGap: input.rowGap
  }
}

/** Local px position of the start edge of track `index1` (1-based). */
export function trackAnchorPx(tracks: number[], gap: number, index1: number): number {
  let anchor = 0
  for (let index = 0; index < index1 - 1; index += 1) {
    anchor += (tracks[index] ?? 0) + gap
  }
  return anchor
}

/** Local px extent of `span` tracks starting at `start1` (1-based), gaps included. */
export function trackSpanPx(tracks: number[], gap: number, start1: number, span: number): number {
  let size = 0
  for (let index = start1 - 1; index < start1 - 1 + span; index += 1) {
    size += tracks[index] ?? 0
  }
  return size + gap * Math.max(0, span - 1)
}

/** Track index (1-based) containing one local px position — boundary walk. */
export function trackIndexAtPx(tracks: number[], gap: number, positionPx: number): number {
  let cursor = 0
  for (let index = 0; index < tracks.length; index += 1) {
    cursor += (tracks[index] ?? 0) + gap
    if (positionPx < cursor) {
      return index + 1
    }
  }
  return tracks.length
}

/** Track index (1-based) whose start anchor is nearest to one target px position. */
export function nearestTrackAnchor(tracks: number[], gap: number, targetPx: number, maxIndex1: number): number {
  let best = 1
  let bestDistance = Infinity
  for (let index1 = 1; index1 <= Math.min(tracks.length, maxIndex1); index1 += 1) {
    const distance = Math.abs(trackAnchorPx(tracks, gap, index1) - targetPx)
    if (distance < bestDistance) {
      bestDistance = distance
      best = index1
    }
  }
  return best
}

/** Span count whose px extent is nearest to one target size (1-based start). */
export function nearestTrackSpan(tracks: number[], gap: number, start1: number, targetPx: number): number {
  const maxSpan = tracks.length - start1 + 1
  let best = 1
  let bestDistance = Infinity
  for (let span = 1; span <= maxSpan; span += 1) {
    const distance = Math.abs(trackSpanPx(tracks, gap, start1, span) - targetPx)
    if (distance < bestDistance) {
      bestDistance = distance
      best = span
    }
  }
  return best
}
