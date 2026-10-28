import type { EditorScene } from '../commands/types'

/** Checks the stable top-level EditorScene shape at a JSON storage boundary. */
export function isEditorScene(value: unknown): value is EditorScene {
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.meta)) return false
  if (typeof value.meta.title !== 'string' || !Number.isFinite(value.meta.durationMs)) return false
  if (!['arbitrary', 'audio-primary', 'mixed'].includes(String(value.meta.durationSource))) return false
  if (value.meta.timeUnit !== 's' && value.meta.timeUnit !== 'ms') return false
  if (value.meta.capsuleOrder !== 'forward' && value.meta.capsuleOrder !== 'backward') return false
  return Array.isArray(value.items)
    && isRecord(value.contents)
    && isRecord(value.decors)
    && isRecord(value.zones)
    && Object.entries(value.zones).every(([zoneId, zone]) => isRecord(zone)
      && zone.id === zoneId
      && typeof zone.name === 'string'
      && (zone.capsuleId === null || typeof zone.capsuleId === 'string'))
    && isRecord(value.markerTracks)
}

/** Accepts plain object records at an untrusted JSON boundary. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
