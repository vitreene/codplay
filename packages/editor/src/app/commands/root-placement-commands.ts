import type { EditorScene, RootPlacementMode, Zone, ZoneRect } from './types'

export const ROOT_PLACEMENT_GRID: Readonly<Record<RootPlacementMode, Readonly<{ rows: number; cols: number }>>> = {
  transform: { rows: 1, cols: 1 },
  'fine-grid': { rows: 90, cols: 160 },
}

/** Identifies one of the two root placement schemes persisted in `rootCapsule.grid`. */
export function rootPlacementModeForScene(scene: EditorScene): RootPlacementMode | null {
  const grid = scene.rootCapsule?.grid
  if (grid?.rows === ROOT_PLACEMENT_GRID.transform.rows && grid.cols === ROOT_PLACEMENT_GRID.transform.cols) return 'transform'
  if (grid?.rows === ROOT_PLACEMENT_GRID['fine-grid'].rows && grid.cols === ROOT_PLACEMENT_GRID['fine-grid'].cols) return 'fine-grid'
  return null
}

/** Stores the chosen root grid, refusing a grid reduction that would reinterpret existing zones. */
export function setRootPlacementMode(scene: EditorScene, args: { mode: RootPlacementMode }): EditorScene {
  const grid = ROOT_PLACEMENT_GRID[args.mode]
  const currentMode = rootPlacementModeForScene(scene)
  const hasRootZones = Object.values(scene.zones).some((zone) => zone.capsuleId === null)
  if (args.mode === 'transform' && hasRootZones && currentMode !== 'transform') {
    throw new Error('setRootPlacementMode: root zones must be removed before switching to the 1 × 1 grid')
  }

  const currentCapsule = scene.rootCapsule ?? {
    kind: 'card' as const,
    distribution: { mode: 'stagger' as const, staggerInMs: 0, staggerOutMs: 0 },
  }
  if (
    scene.rootCapsule !== undefined
    && currentCapsule.grid?.rows === grid.rows
    && currentCapsule.grid.cols === grid.cols
  ) return scene

  return { ...scene, rootCapsule: { ...currentCapsule, grid } }
}

/** Adds one root placement zone using the first free root-scoped `zN` name. */
export function createRootZone(
  scene: EditorScene,
  args: { zoneId: string; area: ZoneRect },
): EditorScene {
  if (rootPlacementModeForScene(scene) !== 'fine-grid') {
    throw new Error('createRootZone: the root capsule must use the 90 × 160 grid')
  }
  if (args.zoneId.trim() === '' || scene.zones[args.zoneId] !== undefined) {
    throw new Error(`createRootZone: zone id '${args.zoneId}' is empty or already exists`)
  }
  const { row, col, rowSpan, colSpan } = args.area
  const isValidArea = [row, col, rowSpan, colSpan].every(Number.isInteger)
    && row >= 1
    && col >= 1
    && rowSpan >= 1
    && colSpan >= 1
    && row + rowSpan - 1 <= ROOT_PLACEMENT_GRID['fine-grid'].rows
    && col + colSpan - 1 <= ROOT_PLACEMENT_GRID['fine-grid'].cols
  if (!isValidArea) throw new RangeError('createRootZone: area must fit inside the 90 × 160 root grid')

  const usedNames = new Set(
    Object.values(scene.zones)
      .filter((zone) => zone.capsuleId === null)
      .map((zone) => zone.name),
  )
  const nameIndex = Array.from({ length: usedNames.size + 1 }, (_value, index) => index + 1)
    .find((index) => !usedNames.has(`z${index}`))!
  const zone: Zone = {
    id: args.zoneId,
    capsuleId: null,
    name: `z${nameIndex}`,
    surfaces: { portrait: args.area, landscape: args.area },
  }
  return { ...scene, zones: { ...scene.zones, [zone.id]: zone } }
}
