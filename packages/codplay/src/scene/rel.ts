import { isPlainRecord } from '../shared'

/** Identifies one scene and, optionally, one perso that publishes a target. */
export type RelTarget = Readonly<{
  scene: string
  perso?: string
}>

/** Immutable author relation used to connect one perso to a rendered target. */
export type Rel = Readonly<{
  target: RelTarget
}>

/** Checks the common relation shape without interpreting library-specific fields. */
export function isRel(value: unknown): value is Rel {
  if (!isPlainRecord(value) || !isPlainRecord(value.target)) return false
  if (!hasOnlyTargetKeys(value.target)) return false
  if (!isNonEmptyString(value.target.scene)) return false
  return value.target.perso === undefined || isNonEmptyString(value.target.perso)
}

/** Keeps library-specific relation extensions outside the common target identity. */
function hasOnlyTargetKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => key === 'scene' || key === 'perso')
}

/** Checks one non-empty identifier carried by a relation target. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
