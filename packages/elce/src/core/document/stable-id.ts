/** Creates an identifier with the supplied domain prefix. */
export function createStableId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
