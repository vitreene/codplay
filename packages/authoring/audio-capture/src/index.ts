/// <reference path="./jsx.d.ts" />

export {
  clearRememberedElevenLabsApiKey,
  loadRememberedElevenLabsApiKey,
  rememberElevenLabsApiKey,
} from './elevenlabs/api-key-storage'
export { loadElevenLabsVoices, type ElevenLabsVoice } from './elevenlabs/voices'
export {
  type AudioAlignment,
  type AudioCharacter,
  type AudioTranscript,
  type AudioWord,
} from './audio/types'
export { alignAudioToText } from './elevenlabs/forced-alignment'
export { generateSpeechWithTimestamps, type GeneratedSpeech } from './elevenlabs/text-to-speech'
export { transcribeAudio } from './elevenlabs/speech-to-text'
export { transformVoice } from './elevenlabs/voice-transformation'
export { registerAudioCaptureElement, type AudioCaptureInsertEventDetail } from './ui/audio-capture-element'
