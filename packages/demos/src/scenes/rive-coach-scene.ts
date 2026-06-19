import type { SceneDoc } from 'codplay/player/types'
import { MOUTH_CUES, PRESTON_TO_TH, phraseWordsFR } from './avatar-data/phrase-fr'

const SCENE_END_MS = 18500
const AVATAR_SIZE = '600px'

const RIV_SRC = '/avatars/coach.riv'
const ARTBOARD = 'Coach model'
const STATE_MACHINE = 'State Machine 1'

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

export function createRiveCoachScene(): SceneDoc {
  return {
    id: 'rive-coach-scene',
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
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                overflow: 'hidden',
                background: '#1a1a2e',
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
            type: 'rive-coach',
            initial: {
              src: RIV_SRC,
              artboard: ARTBOARD,
              stateMachine: STATE_MACHINE,
              move: { parentId: 'avatar-stage' },
              style: {
                position: 'absolute',
                inset: '0',
                width: '100%',
                height: '100%',
                display: 'block',
              },
            },
            actions: {
              'avatar:start':  { broadcast: { type: 'START' } },
              'avatar:viseme': {},
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
          { name: 'scene:start',  startAt: 0 },
          { name: 'audio:start',  startAt: 0 },
          { name: 'avatar:start', startAt: 0 },
          { name: 'sequence:end', startAt: SCENE_END_MS },
          ...buildVisemeEventimes(),
          ...buildWordEventimes(),
        ],
      },
    },
  } as unknown as SceneDoc
}
