/** Audio timing values shared by provider operations and local processing. */
export type AudioWord = Readonly<{ text: string; start: number; end: number }>
export type AudioCharacter = Readonly<{ text: string; start: number; end: number }>
export type AudioTranscript = Readonly<{ text: string }>
export type AudioAlignment = Readonly<{
  characters: readonly AudioCharacter[]
  words: readonly AudioWord[]
}>
