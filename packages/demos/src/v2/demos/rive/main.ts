import type { SceneDoc } from 'codplay'
import {
  RIVE_ENGINE,
  RIVE_PRELOAD_STRATEGIES,
} from '@codplay/component-v2'
import { MOUTH_CUES, phraseWordsFR } from './avatar-data/phrase-fr'
import { RHUBARB_TO_TALKING_HEAD_VISEME } from './avatar-data/rhubarb-viseme-map'

const RIVE_SCENE_ID = 'rive-coach'
const SCENE_END_MS = 18_500
const AVATAR_SIZE = '600px'

export const RIVE_COACH_SRC = '/avatars/coach.riv'
export const RIVE_COACH_ARTBOARD = 'Coach model'
export const RIVE_COACH_STATE_MACHINE = 'State Machine 1'

/** Converts the V1 Rhubarb cues into actions consumed by the Rive state machine. */
export function buildRiveCoachVisemeEventimes() {
  return MOUTH_CUES.map((cue) => ({
    name: 'avatar:viseme',
    startAt: Math.round(cue.start * 1000),
    data: { viseme: RHUBARB_TO_TALKING_HEAD_VISEME[cue.value] },
  }))
}

/** Converts the V1 word timings into subtitle eventimes. */
export function buildRiveCoachWordEventimes() {
  return phraseWordsFR.map((word) => ({
    name: 'subtitle:word',
    startAt: word.startMs,
    data: { content: word.word },
  }))
}

/** Creates the complete V2 port of the V1 Rive coach scene. */
export function createScene(): SceneDoc<string> {
  return {
    id: RIVE_SCENE_ID,
    stories: {
      'avatar-story': {
        id: 'avatar-story',
        initial: { move: '@root' },
        persos: [
          {
            id: 'rive-coach-stage',
            type: 'tag',
            initial: {
              tag: 'div',
              move: '@root',
              attr: { id: 'rive-coach-stage' },
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
              move: { target: 'rive-coach-stage' },
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
            type: 'rive',
            initial: {
              src: RIVE_COACH_SRC,
              artboard: RIVE_COACH_ARTBOARD,
              animations: [],
              move: { target: 'rive-coach-stage' },
              width: 600,
              height: 600,
              style: {
                position: 'absolute',
                inset: '0',
                width: '100%',
                height: '100%',
                display: 'block',
              },
            },
            actions: {
              'avatar:start': { broadcast: { type: 'START' } },
            },
          },
          {
            id: 'lip-sync',
            type: 'rive-state-machine',
            initial: {
              stateMachine: RIVE_COACH_STATE_MACHINE,
              lipSyncInput: 'lips sync id',
              emotionInput: 'emotion',
              rel: { target: { scene: RIVE_SCENE_ID, perso: 'avatar' } },
            },
            actions: {
              'avatar:start': { broadcast: { type: 'START' } },
              'avatar:viseme': {},
            },
          },
          {
            id: 'caption',
            type: 'tag',
            initial: {
              tag: 'p',
              content: '',
              move: { target: 'rive-coach-stage' },
              attr: { id: 'rive-coach-caption' },
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
          { name: 'avatar:start', startAt: 0 },
          { name: 'sequence:end', startAt: SCENE_END_MS },
          ...buildRiveCoachVisemeEventimes(),
          ...buildRiveCoachWordEventimes(),
        ],
      },
    },
  }
}

/** Adds the Rive engine and its document preload strategy to the shared layout. */
export const engineCapabilities = RIVE_ENGINE
export const preloadStrategies = RIVE_PRELOAD_STRATEGIES
