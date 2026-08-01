import { isPlainRecord } from '../../shared'
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
  if (value === SCENE_BUILD_CONFIG.rootToken) return { kind: MOUNT_PLACEMENT_ROOT, source }
  if (value === SCENE_BUILD_CONFIG.detachToken) return { kind: MOUNT_PLACEMENT_OFF, source }
  if (!isPlainRecord(value)) return { kind: MOUNT_PLACEMENT_INVALID, source }

  const record = value as CompiledRecord
  const mode = actionMove ? readMoveMode(record.mode) : undefined
  if (actionMove && record.mode !== undefined && mode === undefined) return { kind: MOUNT_PLACEMENT_INVALID, source }
  if (typeof record.parentId !== 'string') return { kind: MOUNT_PLACEMENT_INVALID, source }
  if (record.parentId === SCENE_BUILD_CONFIG.rootToken) return { kind: MOUNT_PLACEMENT_ROOT, mode, source }
  if (record.parentId === SCENE_BUILD_CONFIG.detachToken) return { kind: MOUNT_PLACEMENT_OFF, mode, source }
  return {
    kind: MOUNT_PLACEMENT_PARENT,
    targetId: record.parentId,
    mode: mode ?? (actionMove ? MOVE_ORDER_MODE_AUTO : undefined),
    reorder: typeof record.reorder === 'boolean' ? record.reorder : undefined,
    source,
  }
}

/** Accepts the finite ordering modes defined by the V1 move contract. */
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
