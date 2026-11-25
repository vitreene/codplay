import type { Actor } from 'xstate'
import { createZoneEditorV2 } from '@codplay/selection-frame/v2'
import type { ZoneEditorHandle, ZoneEditorState, ZoneEditorV2Pose } from '@codplay/selection-frame/v2'
import { capsuleGridForScene, isManualCapsuleType } from '../../../capsule-editor/capsule-grid'
import { cqwToPx } from '../../../decor-editor/units'
import type { EditorScene, Orientation } from '../../commands/types'
import { ROOT_PLACEMENT_GRID, rootPlacementModeForScene } from '../../commands/root-placement-commands'
import type { EditorPlayerPresentationFrame } from '../../commands/editor-player-command-facade'
import type { controllerMachine } from '../../controller/controller-machine'
import type { AuthoringMode, Selection } from '../../controller/types'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import { runtimeItemId } from '../presentation-reading'

/** Binding of the shared Zone Editor overlay to the selected capsule (or the scene root) zone surface. */

/** Editor state read by the binding; each port answers for the current instant. */
export type ZoneSurfaceBindingPorts = Readonly<{
  machine: Actor<typeof controllerMachine>
  actions: EditorActionsFacade
  presentation: () => EditorPlayerPresentationFrame | null
  isPlaybackActive: () => boolean
  isCreating: () => boolean
  inspectorPanel: () => 'decor' | 'capsule'
}>

/** Zone surface authored or targeted by the selection: a capsule in Zone mode, else the item's parent. */
export function activeZoneCapsuleId(scene: EditorScene, selection: Selection, authoringMode: AuthoringMode | null): string | null {
  if (selection.itemIds.length !== 1) return null
  const item = scene.items.find((candidate) => candidate.id === selection.itemIds[0])
  if (item === undefined) return null
  if (item.type === 'capsule' && authoringMode !== 'block') return item.id
  return item.parentId
}

/** Reports whether this capsule type (or the fine-grid root) exposes the zone grid of the current workflow. */
export function hasZoneSurface(scene: EditorScene, capsuleId: string | null): boolean {
  if (capsuleId === null) return rootPlacementModeForScene(scene) === 'fine-grid'
  const capsule = scene.items.find((item) => item.id === capsuleId)
  return capsule?.type === 'capsule' && capsule.capsule !== undefined && isManualCapsuleType(capsule.capsule.kind)
}

/** Owns the Zone Editor mounted on the scene host: its state, visibility, commits and selection. */
export class ZoneSurfaceBinding {
  private readonly ports: ZoneSurfaceBindingPorts
  private zoneEditor: ZoneEditorHandle | null = null
  private zoneEditorRoot: HTMLElement | null = null
  private host: HTMLElement | null = null
  private syncingSelection = false
  private blockMoveGestureActive = false

  constructor(ports: ZoneSurfaceBindingPorts) {
    this.ports = ports
  }

  /** Mounts the Zone Editor on one scene host, initialised from the current document. */
  mount(host: HTMLElement): void {
    const { machine } = this.ports
    const { scene, selection } = machine.getSnapshot().context
    this.host = host
    this.zoneEditor = createZoneEditorV2({
      sceneRoot: host,
      getPose: () => {
        const context = machine.getSnapshot().context
        return context.scene === null ? null : this.pose(context.scene, this.capsuleId(context.scene, context.selection))
      },
      initialState: scene === null
        ? { grid: ROOT_PLACEMENT_GRID['fine-grid'], zones: [] }
        : this.state(scene, selection),
      onZonesChange: (state) => this.commit(state),
      onSelectionChange: (names) => {
        if (this.syncingSelection) return
        if (machine.getSnapshot().context.authoringMode === 'block') {
          this.syncSelection()
          return
        }
        const selectedName = names.length === 1 ? names[0] : undefined
        const zoneId = selectedName === undefined
          ? null
          : this.zoneEditor?.getState().zones.find((zone) => zone.name === selectedName)?.id ?? null
        this.ports.actions.selectZone(zoneId)
      },
      canRemoveZone: (zone) => {
        const current = machine.getSnapshot().context.scene
        return current !== null && !Object.values(current.decors).some((decor) => decor.zoneId === zone.id)
      },
    })
    this.zoneEditorRoot = host.querySelector<HTMLElement>('[data-zone-editor]')
  }

  /** Destroys the Zone Editor and forgets its host. */
  unmount(): void {
    this.zoneEditor?.destroy()
    this.zoneEditor = null
    this.zoneEditorRoot = null
    this.host = null
  }

  /** Resynchronises the overlay from the committed document and the presented capsule pose. */
  sync(scene: EditorScene, selection: Selection): void {
    this.zoneEditor?.setState(this.state(scene, selection))
    this.zoneEditor?.sync()
    this.syncVisibility()
  }

  /** Shows the grid, zones and labels according to authoring mode, capsule settings and playback. */
  syncVisibility(): void {
    const context = this.ports.machine.getSnapshot().context
    const capsuleId = context.scene === null ? null : this.capsuleId(context.scene, context.selection)
    const capsuleSettingsTarget = context.selection.itemIds.length === 0
      || (context.scene !== null && context.selection.itemIds.length === 1
        && context.scene.items.some((item) => item.id === context.selection.itemIds[0] && item.type === 'capsule' && item.capsule !== undefined))
    const capsuleGridEditing = this.ports.inspectorPanel() === 'capsule'
      && capsuleSettingsTarget
      && context.authoringMode !== 'block'
    const grid = context.scene === null ? null : capsuleGridForScene(context.scene, capsuleId)
    const finePlacementGrid = grid?.rows === ROOT_PLACEMENT_GRID['fine-grid'].rows
      && grid.cols === ROOT_PLACEMENT_GRID['fine-grid'].cols
    const blockMovePreview = context.authoringMode === 'block' && this.blockMoveGestureActive
    const gridDropTarget = blockMovePreview && finePlacementGrid
    const playbackActive = this.ports.isPlaybackActive()
    const visible = !playbackActive
      && context.scene !== null
      && hasZoneSurface(context.scene, capsuleId)
      && (context.zonesVisible || context.authoringMode === 'zone' || capsuleGridEditing || blockMovePreview)
      && (!(context.authoringMode === 'block' && context.hideZonesInBlockMode) || blockMovePreview)
    const showGrid = visible && (gridDropTarget
      || (!blockMovePreview && (context.zonesVisible || context.authoringMode === 'zone' || capsuleGridEditing)))
    this.zoneEditor?.setPartVisibility('grid', showGrid)
    this.zoneEditor?.setPartVisibility('zones', visible && !gridDropTarget)
    this.zoneEditor?.setPartVisibility('labels', visible && !gridDropTarget)
    if (this.zoneEditorRoot !== null) {
      this.zoneEditorRoot.inert = context.authoringMode === 'block' || playbackActive || this.ports.isCreating()
    }
  }

  /** Keeps the target overlay visible for the lifetime of one block move gesture. */
  setBlockMoveGestureActive(active: boolean): void {
    if (this.blockMoveGestureActive === active) return
    this.blockMoveGestureActive = active
    this.syncVisibility()
  }

  /** Restores the overlay highlight from the controller's selected zone. */
  syncSelection(): void {
    const context = this.ports.machine.getSnapshot().context
    const scene = context.scene
    const capsuleId = scene === null ? null : this.capsuleId(scene, context.selection)
    const selectedZone = context.selectedZoneId === null ? undefined : scene?.zones[context.selectedZoneId]
    this.syncingSelection = true
    this.zoneEditor?.select(selectedZone === undefined || selectedZone.capsuleId !== capsuleId ? [] : [selectedZone.name])
    this.syncingSelection = false
  }

  /** Zone ids under one viewport point, from the shared track hit-test; empty without an overlay. */
  zoneIdsAtPoint(clientX: number, clientY: number): string[] {
    return this.zoneEditor?.getZoneIdsAtPoint(clientX, clientY) ?? []
  }

  /** Reports whether a Zone Editor is mounted. */
  isMounted(): boolean {
    return this.zoneEditor !== null
  }

  /** Active zone surface for the current authoring mode. */
  private capsuleId(scene: EditorScene, selection: Selection): string | null {
    return activeZoneCapsuleId(scene, selection, this.ports.machine.getSnapshot().context.authoringMode)
  }

  /** Numeric pose of the zone surface, read from the V2 presentation without touching player DOM. */
  private pose(scene: EditorScene, capsuleId: string | null): ZoneEditorV2Pose | null {
    if (this.host === null || !hasZoneSurface(scene, capsuleId)) return null
    if (capsuleId === null) {
      const width = this.host.clientWidth
      const height = this.host.clientHeight
      if (width <= 0 || height <= 0) return null
      return { origin: { x: 0, y: 0 }, matrix: { a: 1, b: 0, c: 0, d: 1 }, localWidth: width, localHeight: height }
    }
    return this.ports.presentation()?.items.find((item) => item.itemId === runtimeItemId(capsuleId))?.pose ?? null
  }

  /** Stored surface matching the capsule's current aspect. */
  private orientation(scene: EditorScene, capsuleId: string | null): Orientation {
    const pose = this.pose(scene, capsuleId)
    return pose !== null && pose.localHeight > pose.localWidth ? 'portrait' : 'landscape'
  }

  /** Projects one surface's track zones and cqw gutters into the overlay's local model. */
  private state(scene: EditorScene, selection: Selection): ZoneEditorState {
    const capsuleId = this.capsuleId(scene, selection)
    const grid = capsuleGridForScene(scene, capsuleId)
    const orientation = this.orientation(scene, capsuleId)
    const gapWidth = this.pose(scene, capsuleId)?.localWidth ?? null
    const gap = grid?.gap === undefined || gapWidth === null
      ? undefined
      : { row: cqwToPx(grid.gap.row, gapWidth), col: cqwToPx(grid.gap.col, gapWidth) }
    return {
      grid: grid === null
        ? { ...ROOT_PLACEMENT_GRID['transform'] }
        : { rows: grid.rows, cols: grid.cols, ...(gap === undefined ? {} : { gap }) },
      zones: Object.values(scene.zones)
        .filter((zone) => zone.capsuleId === capsuleId)
        .map((zone) => ({ id: zone.id, name: zone.name, ...zone.surfaces[orientation] })),
    }
  }

  /** Commits one completed zone gesture; in Block mode the overlay is restored instead. */
  private commit(state: ZoneEditorState): void {
    const context = this.ports.machine.getSnapshot().context
    const scene = context.scene
    if (context.authoringMode === 'block') {
      if (scene !== null) this.zoneEditor?.setState(this.state(scene, context.selection))
      return
    }
    if (scene === null) return
    const capsuleId = this.capsuleId(scene, context.selection)
    if (!hasZoneSurface(scene, capsuleId)) return
    this.ports.actions.setZonesSurface({
      capsuleId,
      orientation: this.orientation(scene, capsuleId),
      zones: state.zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        area: { row: zone.row, col: zone.col, rowSpan: zone.rowSpan, colSpan: zone.colSpan },
      })),
    })
  }
}
