/**
 * Generates one author document id. UUIDs stay distinct from every id already restored from a
 * persisted scene, so no process-local counter can ever collide with stored data.
 */
export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
