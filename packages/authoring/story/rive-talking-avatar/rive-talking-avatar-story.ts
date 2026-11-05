import type { Move, StoryDoc } from 'codplay'

import type {
  RiveInitial,
  RiveInputValues,
  RiveViewModelInitial,
} from '@codplay/component-v2/rive/core'

export type RiveTalkingAvatarProfile = Readonly<{
  document: Pick<RiveInitial, 'src' | 'artboard' | 'width' | 'height' | 'fit' | 'alignment'>
  viewModel: Omit<
    Pick<RiveViewModelInitial, 'stateMachine' | 'viewModel' | 'instance' | 'values' | 'blendSpeed'>,
    'values'
  > & Readonly<{ values: RiveInputValues & Readonly<{ isTalking: boolean }> }>
}>

export type RiveTalkingAvatarFrame = Readonly<{
  startAt: number
  values: RiveInputValues
}>

export type RiveTalkingAvatarCaption = Readonly<{
  startAt: number
  endAt: number
  text: string
}>

export type RiveTalkingAvatarStoryOptions = Readonly<{
  id: string
  profile: RiveTalkingAvatarProfile
  voice: Readonly<{ src: string; durationMs: number }>
  frames: readonly RiveTalkingAvatarFrame[]
  frame?: Readonly<{
    move?: Move
    className?: string
    style?: Readonly<Record<string, unknown>>
  }>
  captions?: Readonly<{
    cues: readonly RiveTalkingAvatarCaption[]
    className?: string
    style?: Readonly<Record<string, unknown>>
  }>
}>

/** Builds a portable narrated Rive story through ordinary CodPlay components. */
export function createRiveTalkingAvatarStory(options: RiveTalkingAvatarStoryOptions): StoryDoc<string> {
  const { id, profile, voice, frames, frame, captions } = options
  const stageId = `${id}-stage`
  const avatarId = `${id}-avatar`
  const valuesId = `${id}:values`
  const captionId = `${id}:caption`
  const startEvent = `${id}:start`
  const isTalkingStartEvent = `${id}:is-talking-start`
  const isTalkingEndEvent = `${id}:is-talking-end`

  return {
    id,
    persos: [
      {
        id: stageId,
        type: 'tag',
        initial: {
          tag: 'div',
          move: frame?.move ?? '@root',
          attr: { id: stageId },
          className: frame?.className,
          style: {
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            ...frame?.style,
          },
        },
      },
      {
        id: `${id}-voice`,
        type: 'media',
        initial: {
          tag: 'audio',
          src: voice.src,
          sync: 'master',
          move: stageId,
          style: { display: 'none' },
        },
        actions: { [startEvent]: { broadcast: { type: 'START' } } },
      },
      {
        id: avatarId,
        type: 'rive',
        initial: {
          ...profile.document,
          animations: [],
          move: stageId,
          style: {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            display: 'block',
          },
        },
        actions: { [startEvent]: { broadcast: { type: 'START' } } },
      },
      {
        id: valuesId,
        type: 'rive-view-model',
        initial: { ...profile.viewModel, rel: { host: avatarId } },
        actions: {
          [startEvent]: { broadcast: { type: 'START' } },
          [isTalkingStartEvent]: { values: { isTalking: true } },
          [isTalkingEndEvent]: { values: { isTalking: false } },
        },
      },
      ...(captions === undefined ? [] : [{
        id: captionId,
        type: 'tag',
        initial: {
          tag: 'p',
          content: '',
          move: stageId,
          attr: { id: `${id}-caption` },
          className: captions.className,
          style: {
            position: 'absolute',
            bottom: '0.75rem',
            left: '50%',
            transform: 'translateX(-50%)',
            margin: '0',
            padding: '0.25rem 0.625rem',
            color: '#fff',
            fontSize: '0.9375rem',
            background: 'rgba(0,0,0,0.55)',
            borderRadius: '0.25rem',
            minHeight: '1.6em',
            textAlign: 'center',
            pointerEvents: 'none',
            ...captions.style,
          },
        },
      }]),
    ],
    eventimes: [
      { name: startEvent, startAt: 0 },
      { name: isTalkingStartEvent, startAt: 0 },
      ...frames.map(({ startAt, values }) => ({
        name: valuesId,
        startAt,
        data: { values: { ...values } },
      })),
      ...(captions?.cues.flatMap(({ startAt, endAt, text }) => [
        { name: captionId, startAt, data: { content: text } },
        { name: captionId, startAt: endAt, data: { content: '' } },
      ]) ?? []),
      {
        name: isTalkingEndEvent,
        startAt: voice.durationMs,
      },
    ],
  }
}
