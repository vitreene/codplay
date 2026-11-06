import type { AudioAlignment, AudioCharacter } from '../audio/types'
import { readAlignedWords } from './audio-timing'
import { requestElevenLabs } from './request'
import { isRecord } from './response'

/** Aligns an author-supplied transcript against an audio track independently of STT. */
export async function alignAudioToText(
  apiKey: string,
  audio: Blob,
  fileName: string,
  text: string,
): Promise<AudioAlignment> {
  const normalizedText = text.trim()
  if (normalizedText === '') throw new Error('Saisissez le texte à aligner sur la prise.')

  const form = new FormData()
  form.append('file', audio, fileName)
  form.append('text', normalizedText)
  const response = await requestElevenLabs(
    'https://api.elevenlabs.io/v1/forced-alignment',
    apiKey,
    'aligner le transcript',
    { method: 'POST', body: form },
  )
  const body: unknown = await response.json().catch(() => null)
  if (!isRecord(body) || !Array.isArray(body.characters)) {
    throw new Error('ElevenLabs a renvoyé un alignement incomplet.')
  }

  const characters = body.characters.flatMap((value): AudioCharacter[] => {
    if (!isRecord(value) || typeof value.text !== 'string' || typeof value.start !== 'number' || typeof value.end !== 'number'
      || value.text === '' || !Number.isFinite(value.start) || !Number.isFinite(value.end)
      || value.start < 0 || value.end < value.start) return []
    return [{ text: value.text, start: value.start, end: value.end }]
  })
  if (characters.length === 0) throw new Error('Aucun caractère n’a pu être aligné sur cette prise.')
  const words = readAlignedWords(characters)
  return { characters, words }
}
