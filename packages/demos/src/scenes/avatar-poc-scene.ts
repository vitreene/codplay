import type { SceneDoc } from 'codplay/player/types'
import { MOUTH_CUES, PRESTON_TO_TH, phraseWordsFR } from './avatar-data/phrase-fr'

// End of speech, derived from the forced-alignment data (last viseme/word boundary)
// rather than a guessed constant — sequence:end fires exactly when the voice ends.
const SPEECH_END_MS = Math.max(
  Math.round(MOUTH_CUES[MOUTH_CUES.length - 1]!.end * 1000),
  phraseWordsFR[phraseWordsFR.length - 1]!.endMs,
)

function buildVisemeEventimes() {
  return MOUTH_CUES.map((c) => ({
    name: 'avatar:viseme',
    startAt: Math.round(c.start * 1000),
    data: { viseme: PRESTON_TO_TH[c.value] ?? null },
  }))
}

function buildWordEventimes() {
  return phraseWordsFR.map((w) => ({
    name: 'subtitle:word',
    startAt: w.startMs,
    data: { content: w.word },
  }))
}

export function createAvatarPocScene(): SceneDoc {
  return {
    id: 'avatar-poc-scene',
    rootStories: ['avatar-story'],
    stories: {
      'avatar-story': {
        id: 'avatar-story',
        entries: ['avatar-stage', 'audio', 'avatar', 'caption'],
        persos: [
          {
            id: 'avatar-stage',
            type: 'tag',
            initial: {
              tag: 'div',
              style: {
                position: 'relative',
                width: '600px',
                height: '600px',
                overflow: 'hidden',
              },
            },
            actions: {},
          },
          {
            id: 'audio',
            type: 'media',
            initial: {
              tag: 'video',
              src: '/assets/1_7b_e.mp3',
              master: true,
              move: { parentId: 'avatar-stage' },
              style: {
                position: 'absolute',
                left: '0',
                top: '0',
                width: '1px',
                height: '1px',
                opacity: 0,
                pointerEvents: 'none',
              },
            },
            actions: {
              'audio:start': { broadcast: { type: 'START' } },
            },
          },
          {
            id: 'avatar',
            type: 'avatar3d',
            initial: {
              move: { parentId: 'avatar-stage' },
            },
            actions: {
              // Visemes — data.viseme drives the mouth shape
              'avatar:viseme': {},
              // Direct morph override — data.name + data.value (still used by external callers)
              'avatar:morph': {},
              // Gesture — data.gesture: string | null
              'avatar:gesture': {},
              // Gaze — data.enabled: boolean
              'avatar:gaze': {},
              // Mood — data.mood: MoodName
              'avatar:mood': {},
              // Idle — each event registers a per-frame fn in the component's action handler.
              'avatar:blink':     { blink:     true },
              'avatar:head-drift': { headDrift: true },
              'avatar:breathe':   { breathe:   true },
            },
          },
          {
            id: 'caption',
            type: 'text',
            initial: {
              tag: 'p',
              content: '',
              move: { parentId: 'avatar-stage' },
              style: {
                position: 'absolute',
                bottom: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                margin: '0',
                padding: '4px 10px',
                color: '#fff',
                fontSize: '15px',
                background: 'rgba(0,0,0,0.55)',
                borderRadius: '4px',
                minHeight: '1.6em',
                textAlign: 'center',
                pointerEvents: 'none',
              },
            },
            actions: {
              'subtitle:word': {},
            },
          },
        ],
        eventimes: [
          { name: 'scene:start', startAt: 0 },
          { name: 'audio:start', startAt: 0 },
          // Idle animations — seek-safe: direct eventimes replayed on any seek.
          { name: 'avatar:blink',      startAt: 0 },
          { name: 'avatar:breathe',    startAt: 0 },
          { name: 'avatar:head-drift', startAt: 0 },
          // Gaze always on — seek-safe
          { name: 'avatar:gaze', startAt: 0, data: { enabled: true } },
          // Gesture sequence — seeds from eventSeq → deterministic at seek
          { name: 'avatar:gesture', startAt: 8000,  data: { gesture: 'shrug' } },
          { name: 'avatar:gesture', startAt: 11000, data: { gesture: 'handup' } },
          { name: 'avatar:gesture', startAt: 15000, data: { gesture: 'shrug' } },
          { name: 'avatar:gesture', startAt: 17500, data: { gesture: null } },
          // Fires exactly when the voice ends (forced-alignment derived) — stops idle loops.
          { name: 'sequence:end', startAt: SPEECH_END_MS },
          ...buildVisemeEventimes(),
          ...buildWordEventimes(),
        ],
      },
    },
  } as unknown as SceneDoc
}
