import type { RuntimeModuleHost } from '../../components/types'

/**
 * Registry access this module needs — a direct subset of `RuntimeModuleHost['registries']`,
 * never a public-facing facade (`RuntimeRegistrySnapshot`/`player.getRuntimeRegistry()`):
 * low-level node access from a scene-facing mechanism belongs exclusively to the module
 * system, the same channel `moveModule`/`listModule`/`replaceModule` already use.
 */
export type ListDndRegistries = RuntimeModuleHost['registries']

/**
 * Resolves where a point lands relative to one list's current children —
 * the destination list id and the insertion index within it. `null` when
 * the point does not land over any DND-enabled list.
 */
export type ListDndDropTarget = {
  listId: string
  index: number
}

/** Static ghost styling — see `CaptureDeclaration.ghost` (`capture-types.ts`), forwarded unchanged. */
export type ListDndGhostConfig = {
  className?: string
  style?: Record<string, string | number>
}

export type ListDndModule = {
  /**
   * Hit-tests `clientX`/`clientY` against the mounted children of
   * `candidateListIds`, resolving the destination list and the index the
   * dragged item would land at (excluding the dragged item itself from the
   * candidates it is hit-tested against). Returns `null` when the point
   * lands over none of the candidate lists.
   */
  resolveDropTarget: (input: {
    clientX: number
    clientY: number
    draggedPersoId: string
    candidateListIds: readonly string[]
  }) => ListDndDropTarget | null
  /**
   * Live preview during a drag: resolves the drop target, then moves a raw
   * DOM ghost sibling to occupy the resolved slot (never a real perso, never
   * tracked by `ListComponent`) — the dragged item itself is never touched,
   * it keeps following the pointer freely, and the list's real children are
   * never reordered during preview. Safe to call every frame: an unchanged
   * resolved target is a no-op. The real (post-drop) order only changes once
   * the drop's `move` action is applied by `moveModule`/`list-flip` — see
   * `getCommitTarget`.
   */
  previewAt: (input: {
    clientX: number
    clientY: number
    draggedPersoId: string
    candidateListIds: readonly string[]
    ghost?: ListDndGhostConfig
  }) => ListDndDropTarget | null
  /**
   * Resolves what a drop for `draggedPersoId` should commit to, right now —
   * the last live-resolved target (`previewAt`'s own cache, matching
   * exactly what the ghost last visually showed — never recomputed fresh
   * from a hit-test at this point, which could disagree with what the user
   * saw and resolve a different slot), falling back to the drag's recorded
   * origin when the pointer never landed on any candidate list this drag.
   * Read-only, no mutation. `null` only when no drag is currently tracked
   * for `draggedPersoId` at all (called outside any active drag).
   */
  getCommitTarget: (draggedPersoId: string) => { parentId: string; mode: number } | null
  /**
   * Finalizes one drag once its resulting `move` action has already been
   * applied by `moveModule`/`list-flip` (the real attach/detach + FLIP —
   * this module never does that itself anymore) — clears the dragged
   * node's floating styles (`previewAt`'s `position: fixed` escape), removes
   * the ghost, and forgets every per-drag map entry for `draggedPersoId`.
   * Returns `false` (and touches nothing) when no drag was tracked for
   * `draggedPersoId` — signals to the caller that this `move` action is
   * unrelated to this module and should be left alone.
   */
  finalizeDrop: (draggedPersoId: string) => boolean
}
