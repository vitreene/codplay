import type { ScormVersion } from './scorm-types'

/** Returns the maximum suspend-data length for one SCORM edition. */
export function suspendDataLimit(version: ScormVersion): number {
  return version === '1.2' ? 4096 : 64000
}
