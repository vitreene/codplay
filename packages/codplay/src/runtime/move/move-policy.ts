import { isPlainRecord } from '../../shared'
import { isPreparedPath } from 'ace'
import type { PathTraversal } from 'ace'
import { SCENE_BUILD_CONFIG } from '../../scene/config/scene-build'
import {
  MOVE_ORDER_MODE_APPEND,
  MOVE_ORDER_MODE_AUTO,
  MOVE_ORDER_MODE_FIRST,
  MOVE_ORDER_MODE_LAST,
  MOVE_ORDER_MODE_PREPEND,
  MOVE_ISSUE_COMMAND_INVALID,
  MOVE_ISSUE_CONFLICT_SAME_TICK,
  MOVE_ISSUE_LAST_INVALID_SAME_TICK,
  type MoveTransition,
  type MoveFlipMode,
  type MovePathAnchor,
  type MoveOrderMode,
  type MovePolicyIssue,
} from '../config/move'
import {
  MOUNT_PLACEMENT_INVALID,
  MOUNT_PLACEMENT_OFF,
  MOUNT_PLACEMENT_PARENT,
  MOUNT_PLACEMENT_ROOT,
  MOUNT_PLACEMENT_UNSPECIFIED,
  MOUNT_PLACEMENT_SOURCE_INITIAL,
  MOUNT_PLACEMENT_SOURCE_MOVE,
  type MountPlacementSource,
} from '../config/mount-placement'
import type { CompiledRecord, CompiledValue } from '../../scene/compiled'
import type { MaterializedAction, ResolvedPlacement } from '../player/pipeline/types'

/** Result of one pure move-policy evaluation. */
export type MovePolicyResult = Readonly<{
  placement: ResolvedPlacement
  issues: readonly MovePolicyIssue[]
}>

/** Selects one effective placement from initial state and materialized moves. */
export function selectEffectiveMove(
  initialMove: CompiledValue | undefined,
  actions: readonly MaterializedAction[],
): MovePolicyResult {
  let placement = readMove(initialMove, false)
  const issues: MovePolicyIssue[] = []
  if (placement.kind === MOUNT_PLACEMENT_INVALID) {
    issues.push({ code: MOVE_ISSUE_COMMAND_INVALID, message: 'Initial move command is invalid.' })
  }
  const groups = new Map<string, ResolvedPlacement[]>()
  const groupOrder: string[] = []

  for (const action of actions) {
    if (!Object.prototype.hasOwnProperty.call(action.action, 'move')) continue
    const key = action.eventSeq === undefined
      ? `time:${action.startAt}`
      : `event:${action.eventSeq}`
    if (!groups.has(key)) {
      groupOrder.push(key)
      groups.set(key, [])
    }
    groups.get(key)?.push(readMove(action.action.move, true))
  }

  for (const key of groupOrder) {
    const candidates = groups.get(key) ?? []
    const candidate = candidates.at(-1)
    if (candidate === undefined || candidate.kind === MOUNT_PLACEMENT_INVALID) continue
    if (candidates.length > 1) {
      issues.push({
        code: MOVE_ISSUE_CONFLICT_SAME_TICK,
        message: `Multiple move commands target one perso in ${key}.`,
      })
    }
    placement = candidate
  }

  for (const key of groupOrder) {
    const candidate = groups.get(key)?.at(-1)
    if (candidate?.kind === MOUNT_PLACEMENT_INVALID) {
      issues.push({
        code: MOVE_ISSUE_LAST_INVALID_SAME_TICK,
        message: `The last move command is invalid in ${key}; no move from this tick applies.`,
      })
    }
  }

  return { placement, issues }
}

/** Converts one authored move declaration to a typed logical placement. */
function readMove(value: CompiledValue | undefined, actionMove: boolean): ResolvedPlacement {
  const source = actionMove ? MOUNT_PLACEMENT_SOURCE_MOVE : MOUNT_PLACEMENT_SOURCE_INITIAL
  if (value === undefined) return { kind: MOUNT_PLACEMENT_UNSPECIFIED, source }
  if (typeof value === 'string') return readTarget(value, source, undefined, undefined, undefined, actionMove)
  if (!isPlainRecord(value)) return { kind: MOUNT_PLACEMENT_INVALID, source }

  const record = value as CompiledRecord
  if (typeof record.target !== 'string') return { kind: MOUNT_PLACEMENT_INVALID, source }
  const mode = actionMove ? readMoveMode(record.mode) : undefined
  if (actionMove && record.mode !== undefined && mode === undefined) return { kind: MOUNT_PLACEMENT_INVALID, source }
  const flipMode = readMoveFlipMode(record.flipMode)
  if (flipMode === INVALID_FLIP_MODE) return { kind: MOUNT_PLACEMENT_INVALID, source }
  const transition = readMoveTransition(record.transition)
  if (transition === INVALID_TRANSITION) return { kind: MOUNT_PLACEMENT_INVALID, source }
  const target = readTarget(record.target, source, mode, flipMode, record.reorder, actionMove)
  return target
}

const INVALID_TRANSITION = Symbol('invalid move transition')
const INVALID_FLIP_MODE = Symbol('invalid move flip mode')

/** Resolves one authored target while preserving structural placement metadata. */
function readTarget(
  target: string,
  source: MountPlacementSource,
  mode?: MoveOrderMode,
  flipMode?: MoveFlipMode | typeof INVALID_FLIP_MODE,
  reorder?: CompiledValue,
  actionMove = false,
): ResolvedPlacement {
  if (flipMode === INVALID_FLIP_MODE) return { kind: MOUNT_PLACEMENT_INVALID, source }
  const reorderValue = typeof reorder === 'boolean' ? reorder : undefined
  if (target === SCENE_BUILD_CONFIG.rootToken) return { kind: MOUNT_PLACEMENT_ROOT, mode, flipMode, source }
  if (target === SCENE_BUILD_CONFIG.detachToken) return { kind: MOUNT_PLACEMENT_OFF, mode, flipMode, source }
  return {
    kind: MOUNT_PLACEMENT_PARENT,
    targetId: target,
    mode: mode ?? (actionMove ? MOVE_ORDER_MODE_AUTO : undefined),
    flipMode,
    source,
    reorder: reorderValue,
  }
}

/** Validates the explicit HTML presentation strategy without inventing one. */
function readMoveFlipMode(value: CompiledValue | undefined): MoveFlipMode | typeof INVALID_FLIP_MODE | undefined {
  if (value === undefined) return undefined
  if (value === 'local' || value === 'overlay-world') return value
  return INVALID_FLIP_MODE
}

/** Accepts compiler-prepared transition data without parsing SVG at runtime. */
function readMoveTransition(value: CompiledValue | undefined): MoveTransition | typeof INVALID_TRANSITION | undefined {
  if (value === undefined) return undefined
  if (!isPlainRecord(value)) return INVALID_TRANSITION
  const record = value as CompiledRecord
  if (record.duration !== undefined && (typeof record.duration !== 'number' || !Number.isFinite(record.duration) || record.duration <= 0)) {
    return INVALID_TRANSITION
  }
  if (record.ease !== undefined && typeof record.ease !== 'string') return INVALID_TRANSITION
  if (record.path !== undefined && !isPreparedPath(record.path)) return INVALID_TRANSITION
  if (record.traversal !== undefined && record.traversal !== 'parameter' && record.traversal !== 'arc-length') return INVALID_TRANSITION
  if (record.traversal !== undefined && record.path === undefined) return INVALID_TRANSITION
  if (record.pathAnchor !== undefined && record.pathAnchor !== 'aabb' && record.pathAnchor !== 'center') return INVALID_TRANSITION
  if (record.pathAnchor !== undefined && record.path === undefined) return INVALID_TRANSITION
  return {
    duration: record.duration as number | undefined,
    ease: record.ease,
    path: record.path,
    traversal: record.traversal as PathTraversal | undefined,
    pathAnchor: record.pathAnchor as MovePathAnchor | undefined,
  }
}

/** Accepts the finite ordering modes defined by the CodPlay move contract. */
function readMoveMode(value: CompiledValue | undefined): MoveOrderMode | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value === MOVE_ORDER_MODE_AUTO
    || value === MOVE_ORDER_MODE_FIRST
    || value === MOVE_ORDER_MODE_LAST
    || value === MOVE_ORDER_MODE_APPEND
    || value === MOVE_ORDER_MODE_PREPEND) return value
  return undefined
}
