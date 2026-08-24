import { compareNumberPaths, isPlainRecord } from '../../../shared'
import type { CompiledRecord } from '../../../scene/compiled'
import { buildTrackRegistry } from '../../player/pipeline'
import type { SolvedScene } from '../../player/pipeline'
import type { MediaTransition } from '../../components/component-surface-types'
import { readInitialMaster } from './media-sync-state'
import type {
  BroadcastAction,
  BroadcastOccurrence,
} from './media-sync-types'

/** Collects all active media broadcast actions in one deterministic timeline order. */
export function collectBroadcastOccurrences(scene: SolvedScene): readonly BroadcastOccurrence[] {
  const occurrences: BroadcastOccurrence[] = []
  const tracks = buildTrackRegistry(scene.scene)
  for (const perso of Object.values(scene.persos)) {
    if (perso.type !== 'media') continue
    for (const action of perso.actions ?? []) {
      const broadcast = readBroadcastAction(action.action)
      if (broadcast === null) continue
      occurrences.push({
        persoKey: perso.key,
        trackId: action.trackId,
        trackActive: tracks.tracks[action.trackId]?.active ?? true,
        action,
        broadcast,
      })
    }
  }
  return occurrences.sort(compareBroadcastOccurrences)
}

/** Produces a stable signature for the active media actions at one scene time. */
export function createSceneSignature(
  scene: SolvedScene,
  occurrences: readonly BroadcastOccurrence[],
): string {
  const mediaFlags = Object.values(scene.persos)
    .filter((perso) => perso.type === 'media')
    .map((perso) => `${perso.key}:${readInitialMaster(scene.scene, perso) ? '1' : '0'}`)
    .sort()
  return JSON.stringify([
    mediaFlags,
    occurrences.map((occurrence) => [
      occurrence.persoKey,
      occurrence.trackId,
      occurrence.action.startAt,
      occurrence.action.eventId,
      occurrence.action.declarationPath,
      occurrence.broadcast,
    ]),
  ])
}

/** Reads one supported broadcast payload from one compiled action. */
function readBroadcastAction(action: CompiledRecord): BroadcastAction | null {
  const value = action.broadcast
  if (!isPlainRecord(value)) return null
  const broadcast = value as CompiledRecord
  const type = broadcast.type
  if (type !== 'START' && type !== 'PAUSE' && type !== 'STOP') return null
  return {
    type,
    startAt: typeof broadcast.startAt === 'number' ? broadcast.startAt : undefined,
    endAt: typeof broadcast.endAt === 'number' ? broadcast.endAt : undefined,
    transition: readMediaTransition(broadcast.transition),
  }
}

/** Reads the optional transition payload without interpreting foreign properties. */
function readMediaTransition(value: unknown): MediaTransition | undefined {
  if (!isPlainRecord(value)) return undefined
  const duration = value.duration
  return {
    from: isPlainRecord(value.from) ? value.from : undefined,
    to: isPlainRecord(value.to) ? value.to : undefined,
    duration: typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 ? duration : undefined,
  }
}

/** Sorts occurrences by authored timeline order and declaration path. */
function compareBroadcastOccurrences(left: BroadcastOccurrence, right: BroadcastOccurrence): number {
  return left.action.startAt - right.action.startAt
    || left.action.trackOrder - right.action.trackOrder
    || compareNumberPaths(left.action.declarationPath, right.action.declarationPath)
    || left.persoKey.localeCompare(right.persoKey)
}

/** Identifies one compiled broadcast occurrence across consecutive presentations. */
export function createBroadcastOccurrenceKey(occurrence: BroadcastOccurrence): string {
  return JSON.stringify([
    occurrence.persoKey,
    occurrence.trackId,
    occurrence.trackActive,
    occurrence.action.startAt,
    occurrence.action.eventId,
    occurrence.action.eventSeq,
    occurrence.action.declarationPath,
    occurrence.broadcast,
  ])
}

/** Returns whether the next broadcast set only adds occurrences to the current set. */
export function isBroadcastAdditionOnly(
  previous: ReadonlySet<string>,
  next: ReadonlySet<string>,
): boolean {
  if (next.size <= previous.size) return false
  for (const key of previous) {
    if (!next.has(key)) return false
  }
  return true
}
