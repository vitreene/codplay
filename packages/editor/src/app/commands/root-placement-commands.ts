import type { EditorScene, Orientation, RootPlacementMode, Zone, ZoneRect } from './types'

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
  if (!isValidRootArea(args.area)) throw new RangeError('createRootZone: area must fit inside the 90 × 160 root grid')

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

/** Applies one orientation's authored surface to the complete root-zone set by stable id. */
export function setRootZonesSurface(
  scene: EditorScene,
  args: Readonly<{
    orientation: Orientation
    zones: readonly Readonly<{ id: string; name: string; area: ZoneRect }>[]
  }>,
): EditorScene {
  if (args.zones.length > 0 && rootPlacementModeForScene(scene) !== 'fine-grid') {
    throw new Error('setRootZonesSurface: the root capsule must use the 90 × 160 grid')
  }

  const ids = new Set<string>()
  const names = new Set<string>()
  for (const zone of args.zones) {
    if (zone.id.trim() === '' || ids.has(zone.id)) throw new Error(`setRootZonesSurface: duplicate or empty zone id '${zone.id}'`)
    if (zone.name.trim() === '' || names.has(zone.name)) throw new Error(`setRootZonesSurface: duplicate or empty zone name '${zone.name}'`)
    if (!isValidRootArea(zone.area)) throw new RangeError(`setRootZonesSurface: area for zone '${zone.id}' must fit inside the 90 × 160 root grid`)
    const existing = scene.zones[zone.id]
    if (existing !== undefined && existing.capsuleId !== null) {
      throw new Error(`setRootZonesSurface: zone '${zone.id}' does not belong to the root capsule`)
    }
    ids.add(zone.id)
    names.add(zone.name)
  }

  const currentRootZones = Object.values(scene.zones).filter((zone) => zone.capsuleId === null)
  const removed = currentRootZones.filter((zone) => !ids.has(zone.id))
  const attachedZone = removed.find((zone) => Object.values(scene.decors).some((decor) => decor.zoneId === zone.id))
  if (attachedZone !== undefined) {
    throw new Error(`setRootZonesSurface: zone '${attachedZone.id}' is still assigned to a decor`)
  }

  const zones = { ...scene.zones }
  for (const zone of removed) delete zones[zone.id]
  for (const input of args.zones) {
    const existing = scene.zones[input.id]
    zones[input.id] = {
      ...(existing === undefined ? {} : existing),
      id: input.id,
      capsuleId: null,
      name: input.name,
      surfaces: args.orientation === 'landscape'
        ? { landscape: input.area, portrait: existing?.surfaces.portrait ?? input.area }
        : { portrait: input.area, landscape: existing?.surfaces.landscape ?? input.area },
    }
  }
  return { ...scene, zones }
}

/** Checks one root-zone cell range against the authored 90 × 160 track grid. */
function isValidRootArea(area: ZoneRect): boolean {
  const { row, col, rowSpan, colSpan } = area
  return [row, col, rowSpan, colSpan].every(Number.isInteger)
    && row >= 1
    && col >= 1
    && rowSpan >= 1
    && colSpan >= 1
    && row + rowSpan - 1 <= ROOT_PLACEMENT_GRID['fine-grid'].rows
    && col + colSpan - 1 <= ROOT_PLACEMENT_GRID['fine-grid'].cols
}
