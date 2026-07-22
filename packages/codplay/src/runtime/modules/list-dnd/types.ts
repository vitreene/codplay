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
   * Live preview during a drag: resolves the drop target, then repositions
   * every *neighbor* affected by the dragged item landing there (via
   * `ListComponent.repositionChild`, per `v1-list-spec.md`'s container
   * operations) — the dragged item itself is never touched, it keeps
   * following the pointer freely. Safe to call every frame: repositioning
   * a neighbor already at its resolved position is a no-op for
   * `ListComponent`. Never mutates anything beyond the live neighbor
   * order — the real (post-drop) order changes only via `commit`.
   */
  previewAt: (input: {
    clientX: number
    clientY: number
    draggedPersoId: string
    candidateListIds: readonly string[]
    ghost?: ListDndGhostConfig
  }) => ListDndDropTarget | null
  /**
   * Resolves the drop target and applies the real, final reposition of the
   * dragged item itself (via `ListComponent.attachChild`/`repositionChild`,
   * same container operations as `previewAt` uses for neighbors) — called
   * once, at the end of a drag. Returns `null` (and touches nothing) when
   * the point lands over none of the candidate lists.
   */
  commit: (input: {
    clientX: number
    clientY: number
    draggedPersoId: string
    candidateListIds: readonly string[]
  }) => ListDndDropTarget | null
}
