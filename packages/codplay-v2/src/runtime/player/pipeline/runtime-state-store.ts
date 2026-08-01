import { STRAP_SCOPE_SCENE, type StrapScope } from '../../config/strap-scope'
import { isPlainRecord } from '../../../shared'
import type { CompiledRecord, CompiledScene, CompiledValue } from '../../../scene/compiled'

/** Runtime state store separated by scene and story ownership scope. */
export class RuntimeStateStore {
  private sceneState: Record<string, CompiledValue>
  private readonly storyStates = new Map<string, Record<string, CompiledValue>>()

  /** Creates one store from the compiled initial scene and story states. */
  constructor(scene: CompiledScene) {
    this.sceneState = cloneRecord(scene.scene.state)
    for (const [storyId, story] of Object.entries(scene.scene.stories)) {
      this.storyStates.set(storyId, cloneRecord(story.state))
    }
  }

  /** Reads one immutable snapshot for a strap invocation. */
  snapshot(scope: StrapScope, storyId?: string): CompiledRecord {
    if (scope === STRAP_SCOPE_SCENE) return freezeRecord(cloneRecord(this.sceneState))
    if (storyId === undefined) throw new Error('Story state snapshot requires storyId.')
    return freezeRecord(cloneRecord(this.storyStates.get(storyId)))
  }

  /** Applies one explicit state update and returns the resulting read-only snapshot. */
  applyUpdate(scope: StrapScope, update: CompiledRecord, storyId?: string): CompiledRecord {
    const target = this.getMutableTarget(scope, storyId)
    for (const [key, value] of Object.entries(update)) target[key] = cloneValue(value)
    return this.snapshot(scope, storyId)
  }

  /** Replaces a scope from a materialized state after seek reconstruction. */
  replace(scope: StrapScope, state: CompiledRecord, storyId?: string): void {
    const target = this.getMutableTarget(scope, storyId)
    for (const key of Object.keys(target)) delete target[key]
    for (const [key, value] of Object.entries(state)) target[key] = cloneValue(value)
  }

  /** Resolves the mutable target for one explicit state scope. */
  private getMutableTarget(scope: StrapScope, storyId?: string): Record<string, CompiledValue> {
    if (scope === STRAP_SCOPE_SCENE) return this.sceneState
    if (storyId === undefined) throw new Error('Story state update requires storyId.')
    const existing = this.storyStates.get(storyId)
    if (existing !== undefined) return existing
    const created: Record<string, CompiledValue> = {}
    this.storyStates.set(storyId, created)
    return created
  }
}

/** Clones one optional compiled state record. */
function cloneRecord(record: CompiledRecord | undefined): Record<string, CompiledValue> {
  if (record === undefined) return {}
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, cloneValue(value)]))
}

/** Clones one recursive compiled value. */
function cloneValue(value: CompiledValue): CompiledValue {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (isPlainRecord(value)) return cloneRecord(value)
  return value
}

/** Freezes a snapshot recursively before exposing it to a strap. */
function freezeRecord(record: Record<string, CompiledValue>): CompiledRecord {
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      freezeArray(value)
    } else if (isPlainRecord(value)) {
      freezeRecord(value as Record<string, CompiledValue>)
    }
  }
  return Object.freeze(record)
}

/** Freezes one recursive array in a state snapshot. */
function freezeArray(values: readonly CompiledValue[]): void {
  for (const value of values) {
    if (Array.isArray(value)) freezeArray(value)
    else if (isPlainRecord(value)) freezeRecord(value as Record<string, CompiledValue>)
  }
  Object.freeze(values)
}
