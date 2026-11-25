import type { EditorScene, RootPlacementMode } from '../../commands/types'
import type { ControllerContext } from '../../controller/types'
import { canSetRootPlacementMode, rootPlacementModeForScene } from '../../commands/root-placement-commands'
import { resolveTarget } from '../../bridges/decor-edit/decor-target'
import { itemUsesZonePlacement } from '../../bridges/decor-edit/decor-patches'

/**
 * Display rules of the Decor inspector region: which panel shows, which tools are available and
 * pressed. Pure functions of the controller state; the components only render their result.
 */

/** Panel shown in the inspector: the Decor palette, or the capsule / scene settings. */
export type InspectorPanel = 'decor' | 'capsule'

/** Root placement choices, with their button label and the grid they apply. */
const ROOT_PLACEMENT_OPTIONS: ReadonlyArray<Readonly<{ value: RootPlacementMode; label: string; title: string }>> = [
  { value: 'transform', label: 'Libre', title: 'Grille 1 × 1' },
  { value: 'fine-grid', label: 'Grille', title: 'Grille 90 × 160' },
]

/** Title of a root placement choice refused because root zones still use the fine grid. */
const ROOT_PLACEMENT_REFUSED_TITLE = 'Retirer les zones racine avant de passer en grille 1 × 1'

/**
 * Object edited by the scene panel: the selected capsule's id, `'root'` when nothing is selected,
 * or `null` when the selection has no capsule or scene settings.
 */
export function scenePanelTarget(scene: EditorScene | null, selection: ControllerContext['selection']): string | null {
  if (scene === null) return null
  if (selection.itemIds.length === 0) return 'root'
  if (selection.itemIds.length !== 1) return null
  const item = scene.items.find((candidate) => candidate.id === selection.itemIds[0])
  return item?.type === 'capsule' && item.capsule !== undefined ? item.id : null
}

/** Panel opened when the scene-panel target changes: its settings when it has some, the palette otherwise. */
export function defaultInspectorPanel(target: string | null): InspectorPanel {
  return target === null ? 'decor' : 'capsule'
}

/**
 * Zone/Block toolbar. `locked` is true during playback or item creation. The offset tool exists only
 * in block mode, for an item whose geometry follows a zone at the author time.
 */
export function authoringToolsState(context: ControllerContext, locked: boolean, authorTimeMs: number) {
  const { scene, selection } = context
  const target = scene === null ? null : resolveTarget(scene, selection, authorTimeMs)
  const item = target === null ? undefined : scene?.items.find((candidate) => candidate.id === target.itemId)
  const usesZone = scene !== null && item !== undefined
    && itemUsesZonePlacement(scene, item, authorTimeMs, target?.keyframeId)
  return {
    visible: scene !== null,
    disabled: locked,
    mode: context.authoringMode,
    offsetTool: context.authoringMode === 'block' && usesZone ? { pressed: context.editGesture === 'offset' } : null,
    zonesHiddenInBlockMode: context.authoringMode === 'block' ? context.hideZonesInBlockMode : null,
  }
}

/** Root placement buttons and the zone visibility toggle of the scene settings. */
export function rootSettingsState(scene: EditorScene, zonesVisible: boolean, locked: boolean) {
  const mode = rootPlacementModeForScene(scene)
  return {
    modes: ROOT_PLACEMENT_OPTIONS.map((option) => {
      const allowed = canSetRootPlacementMode(scene, option.value)
      return {
        ...option,
        title: allowed ? option.title : ROOT_PLACEMENT_REFUSED_TITLE,
        pressed: mode === option.value,
        disabled: locked || !allowed,
      }
    }),
    zones: {
      label: zonesVisible ? 'Masquer les zones' : 'Afficher les zones',
      pressed: zonesVisible,
      disabled: mode !== 'fine-grid' || locked,
    },
  }
}
