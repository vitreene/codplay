import { uniformTrackGeometry } from './grid-geometry'
import type { GridTrackGeometry } from './grid-geometry'
import { createZoneEditorCore } from './zone-editor'
import type { ZoneEditorAnchorPose, ZoneEditorCoreOptions, ZoneEditorHandle, ZoneEditorHost } from './zone-editor'

/** Numeric pose of one zone surface in the scene overlay host's local coordinate space. */
export type ZoneEditorV2Pose = ZoneEditorAnchorPose

export type ZoneEditorV2Options = Omit<ZoneEditorCoreOptions, 'host' | 'overlayRoot'> & Readonly<{
  /** Stable editor-owned scene host; it is never a player item node. */
  sceneRoot: HTMLElement
  /** Reads the latest accepted V2 presentation pose. Call `sync()` after its existing owner updates. */
  getPose: () => ZoneEditorV2Pose | null
}>

/** Mounts the shared zone gestures from a numeric pose without reading player DOM. */
export function createZoneEditorV2(options: ZoneEditorV2Options): ZoneEditorHandle {
  const host: ZoneEditorHost = {
    getPose: options.getPose,
    subscribe: () => () => {},
    positionOverlay(overlay, pose): void {
      overlay.style.position = 'absolute'
      overlay.style.zIndex = '1150'
      overlay.style.left = `${pose.origin.x}px`
      overlay.style.top = `${pose.origin.y}px`
      overlay.style.width = `${pose.localWidth}px`
      overlay.style.height = `${pose.localHeight}px`
      overlay.style.transform = `matrix(${pose.matrix.a}, ${pose.matrix.b}, ${pose.matrix.c}, ${pose.matrix.d}, 0, 0)`
    },
    getTrackGeometry(grid): GridTrackGeometry | null {
      const pose = options.getPose()
      if (pose === null || pose.localWidth <= 0 || pose.localHeight <= 0) return null
      return uniformTrackGeometry({
        rows: grid.rows,
        cols: grid.cols,
        localWidth: pose.localWidth,
        localHeight: pose.localHeight,
        columnGap: grid.gap?.col ?? 0,
        rowGap: grid.gap?.row ?? 0,
      })
    },
    viewportToLocal(x, y): Readonly<{ x: number; y: number }> | null {
      const pose = options.getPose()
      if (pose === null) return null
      const bounds = options.sceneRoot.getBoundingClientRect()
      const width = options.sceneRoot.clientWidth
      const height = options.sceneRoot.clientHeight
      if (bounds.width <= 0 || bounds.height <= 0 || width <= 0 || height <= 0) return null
      const rootX = (x - bounds.left) * width / bounds.width
      const rootY = (y - bounds.top) * height / bounds.height
      const dx = rootX - pose.origin.x
      const dy = rootY - pose.origin.y
      const determinant = pose.matrix.a * pose.matrix.d - pose.matrix.b * pose.matrix.c
      if (Math.abs(determinant) < 1e-9) return null
      return {
        x: (pose.matrix.d * dx - pose.matrix.c * dy) / determinant,
        y: (-pose.matrix.b * dx + pose.matrix.a * dy) / determinant,
      }
    },
    isCellPlacementAvailable(grid, minCellSize): boolean {
      const pose = options.getPose()
      if (pose === null) return true
      const cellWidth = (pose.localWidth - (grid.gap?.col ?? 0) * (grid.cols - 1)) / grid.cols
      const cellHeight = (pose.localHeight - (grid.gap?.row ?? 0) * (grid.rows - 1)) / grid.rows
      return cellWidth >= minCellSize && cellHeight >= minCellSize
    },
    destroy(): void {},
  }

  return createZoneEditorCore({
    overlayRoot: options.sceneRoot,
    host,
    initialState: options.initialState,
    onZonesChange: options.onZonesChange,
    onSelectionChange: options.onSelectionChange,
    ...(options.canRemoveZone === undefined ? {} : { canRemoveZone: options.canRemoveZone }),
    setStateNotifiesHost: false,
    ...(options.fineDisplayThreshold === undefined ? {} : { fineDisplayThreshold: options.fineDisplayThreshold }),
    ...(options.minCellSizePx === undefined ? {} : { minCellSizePx: options.minCellSizePx }),
  })
}

