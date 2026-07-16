export type RhubarbVisemeCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'X'

/** Rhubarb mouth-shape codes mapped to TalkingHead/Oculus viseme names. */
export const RHUBARB_TO_TALKING_HEAD_VISEME: Record<RhubarbVisemeCode, string | null> = {
  A: 'PP',
  B: 'DD',
  C: 'E',
  D: 'aa',
  E: 'O',
  F: 'U',
  G: 'FF',
  H: 'nn',
  X: null,
}

/** Returns a supported Rhubarb mouth-shape code or null for invalid input. */
export function readRhubarbVisemeCode(value: unknown): RhubarbVisemeCode | null {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' || value === 'E' || value === 'F' || value === 'G' || value === 'H' || value === 'X'
    ? value
    : null
}
