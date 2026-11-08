/** Narrows an unknown ElevenLabs response value at its network boundary. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
