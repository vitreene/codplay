import type { AudioCharacter, AudioWord } from '../audio/types'

/** Groups aligned characters into word occurrences while keeping source timings. */
export function readAlignedWords(characters: readonly AudioCharacter[]): readonly AudioWord[] {
  const words: AudioWord[] = []
  let currentText = ''
  let currentStart: number | null = null
  let currentEnd = 0
  characters.forEach(({ text, start, end }) => {
    if (/\s/u.test(text)) {
      if (currentStart !== null) words.push({ text: currentText, start: currentStart, end: currentEnd })
      currentText = ''
      currentStart = null
      return
    }
    currentText += text
    currentStart ??= start
    currentEnd = Math.max(currentEnd, end)
  })
  if (currentStart !== null) words.push({ text: currentText, start: currentStart, end: currentEnd })
  if (words.length === 0) throw new Error('Les caractères alignés ne contiennent aucun mot horodaté.')
  return words
}
