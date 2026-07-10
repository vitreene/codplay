/**
 * Shared handle geometry — used identically by the cs's own 8 resize handles
 * (`selection-frame.ts`) and the zone editor's own 8 resize handles
 * (`zone-editor.ts`). Extracted after both were found carrying byte-identical
 * copies of the same three tables (`2026-07-10`, found while consolidating
 * duplication between the two modules).
 */

export type CornerId = 'nw' | 'ne' | 'se' | 'sw'
export type SideId = 'n' | 'e' | 's' | 'w'
export type HandleId = CornerId | SideId

export const HANDLE_SIZE_PX = 10

/** Characteristic points in local fractions (0..1) of the frame being resized. */
export const CHARACTERISTIC_POINTS: Record<HandleId, { fx: number; fy: number }> = {
  nw: { fx: 0, fy: 0 },
  ne: { fx: 1, fy: 0 },
  se: { fx: 1, fy: 1 },
  sw: { fx: 0, fy: 1 },
  n: { fx: 0.5, fy: 0 },
  e: { fx: 1, fy: 0.5 },
  s: { fx: 0.5, fy: 1 },
  w: { fx: 0, fy: 0.5 }
}

/** Anchor of each handle: the opposite characteristic point stays fixed while resizing. */
export const OPPOSITE_POINT: Record<HandleId, HandleId> = {
  nw: 'se',
  ne: 'sw',
  se: 'nw',
  sw: 'ne',
  n: 's',
  e: 'w',
  s: 'n',
  w: 'e'
}

/** Directional resize cursor per handle. */
export const HANDLE_CURSORS: Record<HandleId, string> = {
  nw: 'nwse-resize',
  ne: 'nesw-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  e: 'ew-resize',
  s: 'ns-resize',
  w: 'ew-resize'
}

export type CreateHandleNodeOptions = {
  doc: Document
  id: HandleId
  /** Data attribute name carrying the handle id — differs per caller (`data-cs-handle`, `data-zone-editor-handle`). */
  attributeName: string
  borderColor: string
  /**
   * The cs's own handle sits inside a parent (`csRoot`) that already has `pointer-events: auto`
   * for its whole box — the handle itself doesn't need to opt back in. The zone editor's own zone
   * node has no such blanket `auto` (see `zonesRoot`'s own `pointer-events: none`, needed so an
   * empty zones layer never steals a trace's first click) — its handles must opt in individually.
   */
  pointerEventsAuto: boolean
}

/** One resize handle, positioned at its own characteristic point — shared by the cs and the zone editor. */
export function createHandleNode(options: CreateHandleNodeOptions): HTMLElement {
  const point = CHARACTERISTIC_POINTS[options.id]
  const handle = options.doc.createElement('div')
  handle.setAttribute(options.attributeName, options.id)
  handle.style.position = 'absolute'
  handle.style.left = `${point.fx * 100}%`
  handle.style.top = `${point.fy * 100}%`
  handle.style.width = `${HANDLE_SIZE_PX}px`
  handle.style.height = `${HANDLE_SIZE_PX}px`
  handle.style.marginLeft = `${-HANDLE_SIZE_PX / 2}px`
  handle.style.marginTop = `${-HANDLE_SIZE_PX / 2}px`
  handle.style.background = '#ffffff'
  handle.style.border = `1px solid ${options.borderColor}`
  handle.style.boxSizing = 'border-box'
  handle.style.cursor = HANDLE_CURSORS[options.id]
  handle.style.touchAction = 'none'
  if (options.pointerEventsAuto) handle.style.pointerEvents = 'auto'
  return handle
}
