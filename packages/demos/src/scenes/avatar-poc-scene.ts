import type { SceneDoc } from 'codplay/player/types'
import { MOUTH_CUES, PRESTON_TO_TH, phraseWordsFR } from './avatar-data/phrase-fr'

const SCENE_END_MS = 18500

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
          { name: 'scene:start', startAt: 0 },
          { name: 'audio:start', startAt: 0 },
          { name: 'sequence:end', startAt: SCENE_END_MS },
          ...buildVisemeEventimes(),
          ...buildWordEventimes(),
        ],
      },
    },
  } as unknown as SceneDoc
}

