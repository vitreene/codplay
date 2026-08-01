import { isPlainRecord } from '../../../shared'
import type { CompiledRecord, CompiledScene } from '../../../scene/compiled'
import type { MaterializedAction, MaterializedPerso, MaterializedScene } from './types'

type IndexedMaterializedAction = MaterializedAction & { order: number }

/** Selects discrete occurrences active at one timeline position. */
export function materializeScene(scene: CompiledScene, timeMs: number): MaterializedScene {
  assertTimelineTime(timeMs)
  const persos: Record<string, MaterializedPerso> = {}

  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    for (const perso of story.persos) {
      const key = `${storyId}:${perso.id}`
      const actions = (story.eventimes ?? [])
        .map((event, index) => toActiveAction(event, index, perso.actions, timeMs))
        .filter((action): action is IndexedMaterializedAction => action !== null)
        .sort(compareMaterializedActions)
        .map(({ order: _order, ...action }) => action)
      persos[key] = {
        key,
        storyId,
        persoId: perso.id,
        type: perso.type,
        initial: perso.initial,
        actions,
      }
    }
  }

  return { scene, timeMs, persos }
}

/** Converts one compiled event into an active action for one perso. */
function toActiveAction(
  event: CompiledRecord,
  order: number,
  actions: Readonly<Record<string, unknown>>,
  timeMs: number,
): IndexedMaterializedAction | null {
  if (!isScheduledEvent(event) || event.startAt > timeMs) return null
  const action = actions[event.name]
  if (!isPlainRecord(action)) return null
  return {
    name: event.name,
    startAt: event.startAt,
    elapsedMs: timeMs - event.startAt,
    action: action as CompiledRecord,
    order,
  }
}

/** Preserves declaration order for same-time actions while sorting chronology. */
function compareMaterializedActions(
  left: IndexedMaterializedAction,
  right: IndexedMaterializedAction,
): number {
  return left.startAt - right.startAt || left.order - right.order
}

/** Identifies the event shape supported by this materialize slice. */
function isScheduledEvent(value: CompiledRecord): value is CompiledRecord & { name: string; startAt: number } {
  return typeof value.name === 'string' && typeof value.startAt === 'number' && Number.isFinite(value.startAt)
}

/** Rejects invalid timeline inputs before the hot evaluation path. */
function assertTimelineTime(timeMs: number): void {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new Error('Materialize time must be a finite non-negative number.')
  }
}
