import type { CodPlaySnapshot } from 'codplay'
import { EDITOR_V2_STORY_ID } from '../../builder-v2/types'
import type { EditorPlayerPresentationFrame } from '../commands/editor-player-command-facade'
import { isSameAuthorTime } from '../config/author-time'

/**
 * Reading of what the V2 player presents, shared by the editing bridges: runtime identities,
 * snapshot states and logical values. The snapshot is the boundary that owns these values; each
 * reader validates its value once here.
 */

const RUNTIME_ITEM_PREFIX = `${EDITOR_V2_STORY_ID}:`

/** Runtime id of one document item in the editor's single V2 story. */
export function runtimeItemId(itemId: string): string {
  return `${RUNTIME_ITEM_PREFIX}${itemId}`
}

/** Document id carried by a runtime id of the editor story; `null` for any other runtime id. */
export function documentItemId(runtimeId: string): string | null {
  return runtimeId.startsWith(RUNTIME_ITEM_PREFIX) ? runtimeId.slice(RUNTIME_ITEM_PREFIX.length) : null
}

/** Presented entry of one document item, only when the frame shows the expected author time. */
export function presentedItemAt(
  presentation: EditorPlayerPresentationFrame | null,
  itemId: string,
  timeMs: number,
): EditorPlayerPresentationFrame['items'][number] | null {
  if (presentation === null || !isSameAuthorTime(presentation.timeMs, timeMs)) return null
  return presentation.items.find((candidate) => candidate.itemId === runtimeItemId(itemId)) ?? null
}

/** State of one document item in a V2 snapshot. */
export function snapshotItemState(snapshot: CodPlaySnapshot | null, itemId: string): Record<string, unknown> | null {
  return snapshot?.states.find((entry) => entry.target.persoId === itemId)?.state ?? null
}

/** Style record of one document item in a V2 snapshot (empty when absent). */
export function snapshotItemStyle(snapshot: CodPlaySnapshot | null, itemId: string): Record<string, unknown> {
  const style = snapshotItemState(snapshot, itemId)?.style
  return style && typeof style === 'object' && !Array.isArray(style) ? style as Record<string, unknown> : {}
}

/** Reads one logical cqw length: a unitless number, a `cqw` string or a V2 length value. */
export function readLogicalLength(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    const match = value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))cqw$/)
    return match ? Number(match[1]) : undefined
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  if (record.kind !== 'length' || typeof record.value !== 'number' || !Number.isFinite(record.value)) return undefined
  return record.value
}

/** Reads a dimensionless V2 value without interpreting CSS text as a pixel measurement. */
export function readLogicalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Reads a CSS transform-origin percentage/keyword pair as local-box fractions. */
export function readRotationOrigin(value: unknown): { fx: number; fy: number } | undefined {
  if (typeof value !== 'string') return undefined
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return undefined
  const parse = (part: string, axis: 'x' | 'y'): number | undefined => {
    const keyword = part.toLowerCase()
    if (keyword === 'center') return 0.5
    if (axis === 'x' && keyword === 'left') return 0
    if (axis === 'x' && keyword === 'right') return 1
    if (axis === 'y' && keyword === 'top') return 0
    if (axis === 'y' && keyword === 'bottom') return 1
    if (!part.endsWith('%')) return undefined
    const number = Number.parseFloat(part.slice(0, -1))
    return Number.isFinite(number) ? Math.min(1, Math.max(0, number / 100)) : undefined
  }
  const fx = parse(parts[0]!, 'x')
  const fy = parse(parts[1]!, 'y')
  return fx === undefined || fy === undefined ? undefined : { fx, fy }
}

/** Formats one logical V2 value as decor text without converting its unit. */
export function formatLogicalValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return String(value)
  const record = value as Record<string, unknown>
  if (record.kind === 'length' && typeof record.value === 'number' && typeof record.unit === 'string') {
    return `${record.value}${record.unit}`
  }
  if (record.kind === 'color' && Array.isArray(record.coords) && typeof record.alpha === 'number') {
    const coords = record.coords.filter((coordinate): coordinate is number => typeof coordinate === 'number')
    if (record.space === 'srgb' && coords.length >= 3) {
      return `rgba(${Math.round(coords[0]! * 255)}, ${Math.round(coords[1]! * 255)}, ${Math.round(coords[2]! * 255)}, ${record.alpha})`
    }
    if (record.space === 'oklch' && coords.length >= 3) {
      return `oklch(${coords[0]} ${coords[1]} ${coords[2]} / ${record.alpha})`
    }
  }
  return String(value)
}
