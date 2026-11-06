import { requestElevenLabs } from './request'

export type ElevenLabsVoice = {
  readonly voiceId: string
  readonly name: string
}

/** Identifies the preset voice selected when it appears in the available choices. */
export const DEFAULT_ELEVENLABS_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'

/** Provides the preset voice choices shown before loading the account list. */
export const DEFAULT_ELEVENLABS_VOICES: readonly ElevenLabsVoice[] = [
  { voiceId: '9BWtsMINqrJLrRacOk9x', name: 'Aria · female, American, expressive' },
  { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah · female, American, soft' },
  { voiceId: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura · female, American, upbeat' },
  { voiceId: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica · female, American, playful' },
  { voiceId: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice · female, British, confident' },
  { voiceId: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger · male, American, confident' },
  { voiceId: 'JBFqnCBsd6RMkjVDRZzb', name: 'George · male, British, warm' },
  { voiceId: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie · male, Australian, natural' },
  { voiceId: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum · male, gravelly, characters' },
  { voiceId: 'pqHfZKP75CvOlQylNhV4', name: 'Bill · male, older, trustworthy' },
]

/** Loads every available account voice through the current paginated API. */
export async function loadElevenLabsVoices(apiKey: string): Promise<readonly ElevenLabsVoice[]> {
  if (apiKey.trim() === '') throw new Error('Saisissez une clé API ElevenLabs.')

  const voices: ElevenLabsVoice[] = []
  const seenPageTokens = new Set<string>()
  let nextPageToken: string | null = null
  let hasMore = true
  while (hasMore) {
    const url = new URL('https://api.elevenlabs.io/v2/voices')
    url.searchParams.set('page_size', '100')
    if (nextPageToken !== null) url.searchParams.set('next_page_token', nextPageToken)

    const response = await requestElevenLabs(url.toString(), apiKey, 'charger les voix de votre compte', {
      method: 'GET',
    })
    const page = readVoicePage(await response.json().catch(() => null))
    voices.push(...page.voices)
    hasMore = page.hasMore
    nextPageToken = page.nextPageToken
    if (hasMore && (nextPageToken === null || seenPageTokens.has(nextPageToken))) {
      throw new Error('ElevenLabs a renvoyé une pagination des voix incomplète.')
    }
    if (nextPageToken !== null) seenPageTokens.add(nextPageToken)
  }

  if (voices.length === 0) throw new Error('Aucune voix disponible pour cette clé ElevenLabs.')
  return voices
}

/** Validates one paginated voice-list response at the API boundary. */
function readVoicePage(value: unknown): Readonly<{
  voices: ElevenLabsVoice[]
  hasMore: boolean
  nextPageToken: string | null
}> {
  if (!isRecord(value) || !Array.isArray(value.voices) || typeof value.has_more !== 'boolean') {
    throw new Error('ElevenLabs a renvoyé une liste de voix illisible.')
  }

  const voices = value.voices.flatMap((item): ElevenLabsVoice[] => {
    if (!isRecord(item) || typeof item.voice_id !== 'string' || typeof item.name !== 'string') return []
    return [{ voiceId: item.voice_id, name: item.name }]
  })
  const nextPageToken = typeof value.next_page_token === 'string' && value.next_page_token !== ''
    ? value.next_page_token
    : null
  return { voices, hasMore: value.has_more, nextPageToken }
}

/** Narrows an unknown API value to an object before reading its fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
