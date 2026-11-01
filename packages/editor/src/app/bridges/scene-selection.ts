import type { Actor } from 'xstate'
import { EDITOR_V2_STORY_ID } from '../../builder-v2/types'
import type { EditorPlayerPresentationFrame } from '../commands/editor-player-command-facade'
import type { EditorCoordinationBridge } from './editor-coordination-bridge'
import type { controllerMachine } from '../controller/controller-machine'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'

type SceneSelectionCoordination = Pick<EditorCoordinationBridge, 'getSceneHost' | 'presentation'>

/** Resolves a rendered player item to its stable document identity. */
function resolveClickedItemId(target: Element, sceneItemIds: ReadonlySet<string>): string | null {
  const runtimeId = target.closest('[data-item-id]')?.getAttribute('data-item-id')
  if (runtimeId === undefined || runtimeId === null || runtimeId === '') return null
  const prefix = `${EDITOR_V2_STORY_ID}:`
  const itemId = runtimeId.startsWith(prefix) ? runtimeId.slice(prefix.length) : runtimeId
  return sceneItemIds.has(itemId) ? itemId : null
}

/** Resolves the unique item under the pointer from its current player pose when its DOM frame is inert. */
function resolvePresentedItemId(
  sceneRoot: HTMLElement,
  sceneItemIds: ReadonlySet<string>,
  clientX: number,
  clientY: number,
  presentation: EditorPlayerPresentationFrame | null,
): string | null {
  if (presentation === null) return null
  const bounds = sceneRoot.getBoundingClientRect()
  const width = sceneRoot.clientWidth
  const height = sceneRoot.clientHeight
  if (bounds.width <= 0 || bounds.height <= 0 || width <= 0 || height <= 0) return null

  const point = {
    x: (clientX - bounds.left) * width / bounds.width,
    y: (clientY - bounds.top) * height / bounds.height,
  }
  const itemIdPrefix = `${EDITOR_V2_STORY_ID}:`
  const hits = presentation.items.flatMap(({ itemId, pose }) => {
    if (!itemId.startsWith(itemIdPrefix)
      || !sceneItemIds.has(itemId.slice(itemIdPrefix.length))
      || pose.localWidth <= 0 || pose.localHeight <= 0) return []
    const determinant = pose.matrix.a * pose.matrix.d - pose.matrix.b * pose.matrix.c
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-8) return []
    const dx = point.x - pose.origin.x
    const dy = point.y - pose.origin.y
    const localX = (pose.matrix.d * dx - pose.matrix.c * dy) / determinant
    const localY = (-pose.matrix.b * dx + pose.matrix.a * dy) / determinant
    return localX >= 0 && localX <= pose.localWidth && localY >= 0 && localY <= pose.localHeight
      ? [itemId.slice(itemIdPrefix.length)]
      : []
  })
  return hits.length === 1 ? hits[0] ?? null : null
}

/** Creates the app's sole scene-pointer selection route for structural and move-presented items. */
export function createSceneSelectionHandler(
  controller: Actor<typeof controllerMachine>,
  actions: EditorActionsFacade,
  coordination: SceneSelectionCoordination,
): (event: PointerEvent) => void {
  return (event) => {
    const target = event.target
    if (!event.isPrimary || event.button !== 0 || !(target instanceof Element)
      || target.closest('#editor-scene-region') === null) return
    const snapshot = controller.getSnapshot()
    const context = snapshot.context
    if (context.authoringMode === 'zone'
      || snapshot.value === 'creating'
      || target.closest('[data-selection-frame], [data-selection-frame-creation]') !== null) return

    const itemTarget = target.closest('[data-item-id]')
    if (itemTarget === null && target.closest('[data-editor-overlay]') !== null) return

    const scene = context.scene
    const itemIds = new Set(scene?.items.map((item) => item.id) ?? [])
    const itemId = scene === null ? null
      : (itemTarget === null ? null : resolveClickedItemId(itemTarget, itemIds))
        ?? (() => {
          const sceneRoot = coordination.getSceneHost()
          return sceneRoot === null ? null : resolvePresentedItemId(
            sceneRoot,
            itemIds,
            event.clientX,
            event.clientY,
            coordination.presentation.get(),
          )
        })()
    if (itemId !== null) {
      // The item selection owns this hit even when the visible zone grid is above the player item.
      // Prevent the same press from also starting a zone trace on the grid background.
      event.stopPropagation()
      actions.selectItem([itemId])
      return
    }
    if (context.selection.itemIds.length > 0) actions.clearSelection()
  }
}
