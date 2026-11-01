import type { AuthorApi } from './author-api'
import { calibrateGhostToWorldSnapshot, captureOverlayPose, ensureOverlayLayer, localFractionToViewportPoint } from './overlay-pose'
import { measureGridTracks, uniformTrackGeometry } from './grid-geometry'
import type { GridTrackGeometry } from './grid-geometry'
import { worldDeltaToLocalDelta } from 'codplay-v1/runtime/modules/list-flip/engine/dom-matrix'
import { createMinimalAnchor } from './tracked-session'
import { createZoneEditorCore } from './zone-editor'
import type { ZoneEditorAnchorPose, ZoneEditorCoreOptions, ZoneEditorHandle, ZoneEditorHost } from './zone-editor'
import type { ZoneGridModel } from './zone-model'

export type { ZoneEditorHandle } from './zone-editor'

export type ZoneEditorOptions = Omit<ZoneEditorCoreOptions, 'host' | 'overlayRoot'> & Readonly<{
  authorApi: AuthorApi
  sceneRoot: Element
  /** Runtime identifier of the capsule node tracked by this legacy entry point. */
  containerId: string
}>

/** Retains the existing node-backed entry point for consumers outside the V2 editor integration. */
export function createZoneEditor(options: ZoneEditorOptions): ZoneEditorHandle {
  const anchor = createMinimalAnchor({ authorApi: options.authorApi, persoIds: [options.containerId] })
  let containerNode: HTMLElement | null = null

  const readPose = (): ReturnType<typeof captureOverlayPose> | null => {
    const node = anchor.getNode(options.containerId)
    containerNode = anchor.canAct() && node instanceof HTMLElement ? node : null
    return containerNode === null ? null : captureOverlayPose(containerNode)
  }

  const host: ZoneEditorHost = {
    getPose(): ZoneEditorAnchorPose | null {
      const pose = readPose()
      if (pose === null) return null
      return {
        origin: { x: pose.rect.left, y: pose.rect.top },
        matrix: pose.matrix,
        localWidth: pose.localWidth,
        localHeight: pose.localHeight,
      }
    },
    subscribe(listener): () => void {
      return anchor.subscribe(listener)
    },
    positionOverlay(overlay, pose): void {
      const current = readPose()
      if (current === null) return
      overlay.style.position = 'fixed'
      overlay.style.left = `${pose.origin.x}px`
      overlay.style.top = `${pose.origin.y}px`
      overlay.style.width = `${pose.localWidth}px`
      overlay.style.height = `${pose.localHeight}px`
      overlay.style.transform = `matrix(${pose.matrix.a}, ${pose.matrix.b}, ${pose.matrix.c}, ${pose.matrix.d}, 0, 0)`
      calibrateGhostToWorldSnapshot(overlay, current.rect)
    },
    getTrackGeometry(grid): GridTrackGeometry | null {
      const current = readPose()
      if (containerNode === null || current === null) return null
      const measured = measureGridTracks(containerNode)
      if (measured !== null) return measured
      if (current.localWidth <= 0 || current.localHeight <= 0) return null
      return uniformTrackGeometry({
        rows: grid.rows,
        cols: grid.cols,
        localWidth: current.localWidth,
        localHeight: current.localHeight,
        columnGap: grid.gap?.col ?? 0,
        rowGap: grid.gap?.row ?? 0,
      })
    },
    viewportToLocal(x, y): Readonly<{ x: number; y: number }> | null {
      const current = readPose()
      if (current === null || containerNode === null) return null
      const origin = localFractionToViewportPoint(current, 0, 0)
      return worldDeltaToLocalDelta(current.matrix, x - origin.x, y - origin.y)
    },
    isCellPlacementAvailable(_grid: ZoneGridModel, minCellSize): boolean {
      const measured = containerNode === null ? null : measureGridTracks(containerNode)
      if (measured === null) return true
      const cellWidth = (measured.cols[0] ?? 0) - measured.columnGap
      const cellHeight = (measured.rows[0] ?? 0) - measured.rowGap
      return cellWidth >= minCellSize && cellHeight >= minCellSize
    },
    destroy(): void {
      anchor.destroy()
      containerNode = null
    },
  }

  return createZoneEditorCore({
    overlayRoot: ensureOverlayLayer(options.sceneRoot),
    host,
    initialState: options.initialState,
    onZonesChange: options.onZonesChange,
    onSelectionChange: options.onSelectionChange,
    ...(options.canRemoveZone === undefined ? {} : { canRemoveZone: options.canRemoveZone }),
    ...(options.setStateNotifiesHost === undefined ? {} : { setStateNotifiesHost: options.setStateNotifiesHost }),
    ...(options.fineDisplayThreshold === undefined ? {} : { fineDisplayThreshold: options.fineDisplayThreshold }),
    ...(options.minCellSizePx === undefined ? {} : { minCellSizePx: options.minCellSizePx }),
  })
}

