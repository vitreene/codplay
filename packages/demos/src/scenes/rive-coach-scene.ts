import type { SceneDoc } from 'codplay/player/types'
import { MOUTH_CUES, phraseWordsFR } from './avatar-data/phrase-fr'
import { riveCoachVisemeConversionStraps } from './avatar-data/rive-viseme-conversion'

const SCENE_END_MS = 18500
const AVATAR_SIZE = '600px'

export const RIVE_COACH_SRC = '/avatars/coach.riv'
export const RIVE_COACH_ARTBOARD = 'Coach model'
export const RIVE_COACH_STATE_MACHINE = 'State Machine 1'

export function buildRiveCoachVisemeEventimes() {
  return MOUTH_CUES.map((c) => ({
    name: 'avatar:viseme:raw',
    startAt: Math.round(c.start * 1000),
    data: { viseme: c.value },
  }))
}

export function buildRiveCoachWordEventimes() {
  return phraseWordsFR.map((w) => ({
    name: 'subtitle:word',
    startAt: w.startMs,
    data: { content: w.word },
  }))
}

type RiveCoachBlockOptions = {
  stageId: string
  audioId: string
  avatarId: string
  captionId?: string
  parentId: string
  width: string
  height: string
  showCaption?: boolean
  stageClassName?: string
  avatarStyle?: Record<string, unknown>
  captionStyle?: Record<string, unknown>
  stageStyle?: Record<string, unknown>
}

export function createRiveCoachBlock(options: RiveCoachBlockOptions) {
  const showCaption = options.showCaption !== false
  const persos: Array<Record<string, unknown>> = [
    {
      id: options.stageId,
      type: 'tag',
      initial: {
        tag: 'div',
        className: options.stageClassName,
        move: { parentId: options.parentId },
        style: {
          position: 'relative',
          width: options.width,
          height: options.height,
          overflow: 'hidden',
          background: '#1a1a2e',
          ...options.stageStyle,
        },
      },
      actions: {},
    },
    {
      id: options.audioId,
      type: 'media',
      initial: {
        tag: 'video',
        src: '/assets/1_7b_e.mp3',
        master: true,
        move: { parentId: options.stageId },
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
      id: options.avatarId,
      type: 'rive-coach',
      initial: {
        src: RIVE_COACH_SRC,
        artboard: RIVE_COACH_ARTBOARD,
        stateMachine: RIVE_COACH_STATE_MACHINE,
        move: { parentId: options.stageId },
        style: {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          display: 'block',
          ...options.avatarStyle,
        },
      },
      actions: {
        'avatar:start': { broadcast: { type: 'START' } },
        'avatar:viseme': {},
      },
    },
  ]

  if (showCaption) {
    persos.push({
      id: options.captionId ?? `${options.stageId}-caption`,
      type: 'text',
      initial: {
        tag: 'p',
        content: '',
        move: { parentId: options.stageId },
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
          ...options.captionStyle,
        },
      },
      actions: {
        'subtitle:word': {},
      },
    })
  }

  return {
    persos,
    eventimes: [
      { name: 'audio:start', startAt: 0 },
      { name: 'avatar:start', startAt: 0 },
      ...buildRiveCoachVisemeEventimes(),
      ...(showCaption ? buildRiveCoachWordEventimes() : []),
    ],
    listen: [{ on: 'avatar:viseme:raw', straps: ['rive-coach-viseme-convert'] }],
  }
}

export function createRiveCoachScene(): SceneDoc {
  return {
    id: 'rive-coach-scene',
    rootStories: ['avatar-story'],
    stories: {
      'avatar-story': {
        id: 'avatar-story',
        straps: riveCoachVisemeConversionStraps,
        listen: [
          { on: 'avatar:viseme:raw', straps: ['rive-coach-viseme-convert'] },
        ],
        persos: [
          {
            id: 'avatar-stage',
            type: 'tag',
            initial: {
              tag: 'div',
              move: '@root',
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
               src: RIVE_COACH_SRC,
               artboard: RIVE_COACH_ARTBOARD,
               stateMachine: RIVE_COACH_STATE_MACHINE,
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
          ...buildRiveCoachVisemeEventimes(),
          ...buildRiveCoachWordEventimes(),
        ],
      },
    },
  } as unknown as SceneDoc
}
