import { isPlainRecord } from '../../shared'
import { isPreparedPath } from 'ace'
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
  const reparent = readMoveReparent(record.reparent)
  if (reparent === INVALID_REPARENT) return { kind: MOUNT_PLACEMENT_INVALID, source }
  // The former presentation and path-integration fields are deliberately not
  // accepted after the author contract migration.
  if (Object.prototype.hasOwnProperty.call(record, 'flipMode')) return { kind: MOUNT_PLACEMENT_INVALID, source }
  const transition = readMoveTransition(record.transition)
  if (transition === INVALID_TRANSITION) return { kind: MOUNT_PLACEMENT_INVALID, source }
  const target = readTarget(record.target, source, mode, reparent, record.reorder, actionMove)
  return target
}

const INVALID_TRANSITION = Symbol('invalid move transition')
const INVALID_REPARENT = Symbol('invalid move reparent')

/** Resolves one authored target while preserving structural placement metadata. */
function readTarget(
  target: string,
  source: MountPlacementSource,
  mode?: MoveOrderMode,
  reparent?: boolean | typeof INVALID_REPARENT,
  reorder?: CompiledValue,
  actionMove = false,
): ResolvedPlacement {
  if (reparent === INVALID_REPARENT) return { kind: MOUNT_PLACEMENT_INVALID, source }
  const reorderValue = typeof reorder === 'boolean' ? reorder : undefined
  if (target === SCENE_BUILD_CONFIG.rootToken) return { kind: MOUNT_PLACEMENT_ROOT, mode, reparent, source }
  if (target === SCENE_BUILD_CONFIG.detachToken) return { kind: MOUNT_PLACEMENT_OFF, mode, reparent, source }
  return {
    kind: MOUNT_PLACEMENT_PARENT,
    targetId: target,
    mode: mode ?? (actionMove ? MOVE_ORDER_MODE_AUTO : undefined),
    reparent,
    source,
    reorder: reorderValue,
  }
}

/** Validates the optional author request for an overlay reparent presentation. */
function readMoveReparent(value: CompiledValue | undefined): boolean | typeof INVALID_REPARENT | undefined {
  if (value === undefined) return undefined
  return typeof value === 'boolean' ? value : INVALID_REPARENT
}

/** Accepts compiler-prepared transition data without parsing SVG at runtime. */
function readMoveTransition(value: CompiledValue | undefined): MoveTransition | typeof INVALID_TRANSITION | undefined {
  if (value === undefined) return undefined
  if (!isPlainRecord(value)) return INVALID_TRANSITION
  const record = value as CompiledRecord
  if (record.duration !== undefined && (typeof record.duration !== 'number' || !Number.isFinite(record.duration) || record.duration <= 0)) {
    return INVALID_TRANSITION
  }
  if (record.delay !== undefined
    && (typeof record.delay !== 'number' || !Number.isFinite(record.delay) || record.delay < 0)) {
    return INVALID_TRANSITION
  }
  if (record.ease !== undefined && typeof record.ease !== 'string') return INVALID_TRANSITION
  if (record.path !== undefined && !isPreparedPath(record.path)) return INVALID_TRANSITION
  if (Object.prototype.hasOwnProperty.call(record, 'traversal')) return INVALID_TRANSITION
  if (Object.prototype.hasOwnProperty.call(record, 'pathAnchor')) return INVALID_TRANSITION
  return {
    duration: record.duration as number | undefined,
    delay: record.delay as number | undefined,
    ease: record.ease,
    path: record.path,
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
