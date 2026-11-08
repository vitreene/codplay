import type { AudioTranscript } from '../audio/types'
import { requestElevenLabs } from './request'
import { isRecord } from './response'

/** Returns recognized text without requesting the separate alignment operation. */
export async function transcribeAudio(
  apiKey: string,
  audio: Blob,
  fileName: string,
): Promise<AudioTranscript> {
  const form = new FormData()
  form.append('file', audio, fileName)
  form.append('model_id', 'scribe_v2')
  form.append('timestamps_granularity', 'none')
  form.append('tag_audio_events', 'false')

  const response = await requestElevenLabs(
    'https://api.elevenlabs.io/v1/speech-to-text',
    apiKey,
    'transcrire la prise',
    { method: 'POST', body: form },
  )
  const body: unknown = await response.json().catch(() => null)
  if (!isRecord(body) || typeof body.text !== 'string') {
    throw new Error('ElevenLabs a renvoyé un transcript incomplet.')
  }

  return { text: body.text }
}
