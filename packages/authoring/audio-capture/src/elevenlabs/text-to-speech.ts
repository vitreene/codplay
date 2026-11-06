import type { AudioCharacter, AudioWord } from '../audio/types'
import { readAlignedWords } from './audio-timing'
import { requestElevenLabs } from './request'
import { isRecord } from './response'

export type GeneratedSpeech = Readonly<{
  audio: Blob
  characters: readonly AudioCharacter[]
  words: readonly AudioWord[]
  transcript: string
}>

/** Generates an MP3 and reads character timings from timestamped ElevenLabs TTS. */
export async function generateSpeechWithTimestamps(
  apiKey: string,
  voiceId: string,
  text: string,
  modelId: 'eleven_multilingual_v2' | 'eleven_flash_v2_5' | 'eleven_turbo_v2_5',
): Promise<GeneratedSpeech> {
  const normalizedText = text.trim()
  if (normalizedText === '') throw new Error('Saisissez le texte à prononcer.')

  const response = await requestElevenLabs(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
    apiKey,
    'générer la voix',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: normalizedText, model_id: modelId }),
    },
  )
  const body: unknown = await response.json().catch(() => null)
  if (!isRecord(body) || typeof body.audio_base64 !== 'string') {
    throw new Error('ElevenLabs a renvoyé un résultat vocal incomplet.')
  }
  const alignment = body.alignment ?? body.normalized_alignment
  if (!isRecord(alignment)) throw new Error('ElevenLabs a renvoyé un alignement vocal incomplet.')

  const characters = readTtsCharacters(alignment)
  return {
    audio: decodeBase64Audio(body.audio_base64),
    characters,
    words: readAlignedWords(characters),
    transcript: normalizedText,
  }
}

/** Reads the character-level timing arrays returned by timestamped TTS. */
function readTtsCharacters(value: Record<string, unknown>): readonly AudioCharacter[] {
  const characters = value.characters
  const startTimes = value.character_start_times_seconds
  const endTimes = value.character_end_times_seconds
  if (!Array.isArray(characters)
    || !Array.isArray(startTimes)
    || !Array.isArray(endTimes)
    || characters.length !== startTimes.length
    || characters.length !== endTimes.length) {
    throw new Error('ElevenLabs a renvoyé un alignement des caractères illisible.')
  }

  const result = characters.flatMap((character, index): AudioCharacter[] => {
    const start = startTimes[index]
    const end = endTimes[index]
    if (typeof character !== 'string' || typeof start !== 'number' || typeof end !== 'number'
      || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return []
    return [{ text: character, start, end }]
  })
  if (result.length !== characters.length) throw new Error('ElevenLabs a renvoyé un alignement des caractères illisible.')
  return result
}

/** Converts the provider's base64 response into a browser-playable MP3. */
function decodeBase64Audio(value: string): Blob {
  let binary: string
  try {
    binary = atob(value)
  } catch {
    throw new Error('ElevenLabs a renvoyé un fichier audio illisible.')
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (bytes.length === 0) throw new Error('ElevenLabs a renvoyé une piste vocale vide.')
  return new Blob([bytes], { type: 'audio/mpeg' })
}
