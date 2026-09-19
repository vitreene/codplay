import { isPlainRecord } from '../shared'

/** Immutable author relation used to connect one perso to a rendered host target. */
export type Rel = Readonly<{
  host: string
  target?: string
}>

/** Checks the common relation fields without interpreting library-specific extensions. */
export function isRel(value: unknown): value is Rel {
  if (!isPlainRecord(value)) return false
  if (!isNonEmptyString(value.host)) return false
  return value.target === undefined || isNonEmptyString(value.target)
}

/** Checks one non-empty identifier carried by a relation target. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
