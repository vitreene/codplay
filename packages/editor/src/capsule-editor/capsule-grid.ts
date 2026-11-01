import { DEFAULT_AUTO_CAPSULE_CONFIG, GRID_MODE } from '@codplay/capsule-automation'
import type { CapsuleDef, CapsuleKind, EditorScene, ZoneRect } from '../app/commands/types'

export type CapsuleGrid = NonNullable<CapsuleDef['grid']>

/** Resolves the current Capsule Automation grid defaults for an authored capsule. */
export function effectiveCapsuleGrid(kind: CapsuleKind, grid?: CapsuleGrid): CapsuleGrid {
  const defaults = DEFAULT_AUTO_CAPSULE_CONFIG.types[kind]
  return {
    rows: grid?.rows ?? defaults.defaultRows,
    cols: grid?.cols ?? defaults.defaultCols,
    ...(grid?.gap === undefined ? {} : { gap: { ...grid.gap } }),
  }
}

/** Reports whether Capsule Automation lets the author set this capsule's grid dimensions. */
export function isManualCapsuleType(kind: CapsuleKind): boolean {
  return DEFAULT_AUTO_CAPSULE_CONFIG.types[kind].gridMode === GRID_MODE.manual
}

/** Resolves the authored grid dimensions for the implicit root or one explicit capsule. */
export function capsuleGridForScene(scene: EditorScene, capsuleId: string | null): CapsuleGrid | null {
  if (capsuleId === null) return scene.rootCapsule?.grid ?? null
  const item = scene.items.find((candidate) => candidate.id === capsuleId)
  if (item?.type !== 'capsule' || item.capsule === undefined) return null
  return effectiveCapsuleGrid(item.capsule.kind, item.capsule.grid)
}

/** Keeps one zone surface inside a changed capsule grid while preserving its identity. */
export function clampZoneRectToGrid(area: ZoneRect, grid: Pick<CapsuleGrid, 'rows' | 'cols'>): ZoneRect {
  const row = Math.min(Math.max(1, Math.floor(area.row)), grid.rows)
  const col = Math.min(Math.max(1, Math.floor(area.col)), grid.cols)
  return {
    row,
    col,
    rowSpan: Math.min(Math.max(1, Math.floor(area.rowSpan)), grid.rows - row + 1),
    colSpan: Math.min(Math.max(1, Math.floor(area.colSpan)), grid.cols - col + 1),
  }
}
