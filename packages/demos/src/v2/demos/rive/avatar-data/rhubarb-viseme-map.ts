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
