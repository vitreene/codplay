import { requestElevenLabs } from './request'

/** Converts a recording to the selected ElevenLabs voice without replacing the source. */
export async function transformVoice(
  apiKey: string,
  voiceId: string,
  audio: Blob,
  fileName: string,
): Promise<Blob> {
  const form = new FormData()
  form.append('audio', audio, fileName)
  form.append('model_id', 'eleven_multilingual_sts_v2')

  const response = await requestElevenLabs(
    `https://api.elevenlabs.io/v1/voice-changer/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    apiKey,
    'transformer la voix',
    { method: 'POST', body: form },
  )
  const result = await response.blob()
  if (result.size === 0) throw new Error('ElevenLabs a renvoyé une piste vocale vide.')
  return new Blob([result], { type: response.headers.get('content-type') ?? 'audio/mpeg' })
}
