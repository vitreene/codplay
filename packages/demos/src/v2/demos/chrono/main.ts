import type { CompiledRecord } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'

const START_SECONDS = 20
const STOP_SECONDS = 0

/** Duration exposed by this scene to the common V2 layout. */
export const SCENE_DURATION_MS = START_SECONDS * 1000

type ChronoTweenInput = Readonly<{
  progress: number
  data?: Readonly<Record<string, unknown>>
}>

type ChronoStatus = 'idle' | 'running' | 'paused'

type ChronoState = Readonly<{
  status: ChronoStatus
  start: number
  stop: number
  durationMs: number
  startedAtMs: number
  currentValue: number
}>

/** Reads the timer range carried by the triggering event. */
function readChronoRange(data: Readonly<Record<string, unknown>> | undefined): Readonly<{
  start: number
  stop: number
  durationMs: number
}> {
  const start = typeof data?.start === 'number' ? data.start : START_SECONDS
  const stop = typeof data?.stop === 'number' ? data.stop : STOP_SECONDS
  const computedDurationMs = Math.abs(start - stop) * 1000
  const durationMs = typeof data?.duration === 'number' && data.duration > 0
    ? data.duration
    : Math.max(1, computedDurationMs)
  return { start, stop, durationMs }
}

/** Interpolates one timer value without reading DOM or mutable runtime state. */
function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

/** Reads the normalized progress represented by one paused timer value. */
function resolveChronoProgress(start: number, stop: number, value: number): number {
  if (start === stop) return 0
  return clampProgress((value - start) / (stop - start))
}

/** Formats one timer value for the static paused/reset display action. */
function formatChronoValue(value: number): string {
  const seconds = Math.floor(value)
  const centiseconds = Math.round((value - seconds) * 100)
  return `${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`
}

/** Selects the display color for one normalized timer progress. */
function resolveChronoColor(progress: number): string {
  return progress < 0.5 ? '#4ade80' : progress < 0.75 ? '#fb923c' : '#f87171'
}

/** Creates the static needle pose kept after a scene-level pause. */
function createPausedNeedleAction(value: number): CompiledRecord {
  return { style: { transform: `rotate(${((value / 60) * 360).toFixed(3)}deg)` } }
}

/** Creates the static display pose kept after a scene-level pause. */
function createPausedDisplayAction(start: number, stop: number, value: number): CompiledRecord {
  const progress = resolveChronoProgress(start, stop, value)
  return {
    content: formatChronoValue(value),
    style: { color: resolveChronoColor(progress) },
  }
}

/** Produces the needle pose for one resolved TweenAction frame. */
function resolveNeedleFrame({ progress, data }: ChronoTweenInput): Readonly<Record<string, unknown>> {
  const range = readChronoRange(data)
  const rotation = interpolate((range.start / 60) * 360, (range.stop / 60) * 360, progress)
  return {
    style: { transform: `rotate(${rotation.toFixed(3)}deg)` },
  }
}

/** Produces the counter text and color for one resolved TweenAction frame. */
function resolveDisplayFrame({ progress, data }: ChronoTweenInput): Readonly<Record<string, unknown>> {
  const range = readChronoRange(data)
  const value = interpolate(range.start, range.stop, progress)
  return {
    content: formatChronoValue(value),
    style: { color: resolveChronoColor(progress) },
  }
}

/** Creates the static SVG clock face used by the scene. */
function buildClockFaceMarkup(): string {
  const cx = 150
  const cy = 150
  const outerRadius = 143
  const majorInnerRadius = 124
  const minorInnerRadius = 134
  const textRadius = 110
  const parts: string[] = []

  for (let index = 0; index < 60; index += 1) {
    const radians = (index * 6 - 90) * (Math.PI / 180)
    const isMajor = index % 5 === 0
    const innerRadius = isMajor ? majorInnerRadius : minorInnerRadius
    const x1 = (cx + innerRadius * Math.cos(radians)).toFixed(2)
    const y1 = (cy + innerRadius * Math.sin(radians)).toFixed(2)
    const x2 = (cx + outerRadius * Math.cos(radians)).toFixed(2)
    const y2 = (cy + outerRadius * Math.sin(radians)).toFixed(2)
    const stroke = isMajor ? '#475569' : '#1e293b'
    const strokeWidth = isMajor ? '2.5' : '1'
    parts.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`,
    )
  }

  for (let index = 1; index <= 12; index += 1) {
    const seconds = index * 5
    const radians = (seconds * 6 - 90) * (Math.PI / 180)
    const x = (cx + textRadius * Math.cos(radians)).toFixed(2)
    const y = (cy + textRadius * Math.sin(radians)).toFixed(2)
    const label = seconds === 60 ? '60' : String(seconds).padStart(2, '0')
    parts.push(
      `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="#334155" font-size="11" font-family="monospace">${label}</text>`,
    )
  }

  return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`
}

type ChronoStrapOutput = Readonly<{
  events: readonly Readonly<{ name: string; data?: CompiledRecord }>[]
  update?: CompiledRecord
}>

/** Reads the discrete timer state stored by the chrono strap. */
function readChronoState(state: Readonly<Record<string, unknown>>): ChronoState | undefined {
  const value = state.chrono
  if (typeof value !== 'object' || value === null) return undefined
  const chrono = value as Record<string, unknown>
  if (
    (chrono.status !== 'idle' && chrono.status !== 'running' && chrono.status !== 'paused')
    || typeof chrono.start !== 'number'
    || typeof chrono.stop !== 'number'
    || typeof chrono.durationMs !== 'number'
    || typeof chrono.startedAtMs !== 'number'
    || typeof chrono.currentValue !== 'number'
  ) return undefined
  return {
    status: chrono.status,
    start: chrono.start,
    stop: chrono.stop,
    durationMs: chrono.durationMs,
    startedAtMs: chrono.startedAtMs,
    currentValue: chrono.currentValue,
  }
}

/** Clamps one timer progress value to its authored duration. */
function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Reads the timer value at one discrete event boundary. */
function resolveChronoValueAt(state: ChronoState, timeMs: number): number {
  const elapsedMs = Math.max(0, timeMs - state.startedAtMs)
  const progress = clampProgress(elapsedMs / state.durationMs)
  return interpolate(state.start, state.stop, progress)
}

/** Builds the replayable timer state written by one chrono transition. */
function createChronoState(
  status: ChronoStatus,
  range: Readonly<{ start: number; stop: number; durationMs: number }>,
  startedAtMs: number,
  currentValue: number,
): CompiledRecord {
  return {
    chrono: {
      status,
      start: range.start,
      stop: range.stop,
      durationMs: range.durationMs,
      startedAtMs,
      currentValue,
    },
  }
}

/** Returns the discrete strap transitions that start, stop, or reset the timer. */
function resolveChronoStrap(
  {
    event,
    state,
  }: {
    event: { name: string; data?: Readonly<Record<string, unknown>>; applyAtMs?: number }
    state: Readonly<Record<string, unknown>>
  },
): ChronoStrapOutput | undefined {
  if (event.name === 'chrono:start') {
    const previous = readChronoState(state)
    const range = previous?.status === 'paused'
      ? {
          start: previous.currentValue,
          stop: previous.stop,
          durationMs: Math.max(1, Math.abs(previous.currentValue - previous.stop) * 1000),
        }
      : readChronoRange(event.data)
    const startedAtMs = event.applyAtMs ?? 0
    return {
      events: [
        {
          name: 'chrono:needle',
          data: { start: range.start, stop: range.stop, duration: range.durationMs },
        },
        {
          name: 'chrono:display',
          data: { start: range.start, stop: range.stop, duration: range.durationMs },
        },
      ],
      update: createChronoState('running', range, startedAtMs, range.start),
    }
  }

  if (event.name === 'chrono:stop') {
    const previous = readChronoState(state)
    if (previous?.status !== 'running') return { events: [{ name: 'tween:stop' }] }
    const currentValue = resolveChronoValueAt(previous, event.applyAtMs ?? previous.startedAtMs)
    return {
      events: [
        { name: 'tween:stop' },
        { name: 'chrono:needle-set', data: createPausedNeedleAction(currentValue) },
        {
          name: 'chrono:display-set',
          data: createPausedDisplayAction(previous.start, previous.stop, currentValue),
        },
      ],
      update: createChronoState('paused', previous, previous.startedAtMs, currentValue),
    }
  }

  if (event.name === 'chrono:reset') {
    return {
      events: [
        { name: 'tween:stop' },
        { name: 'chrono:needle-set', data: { style: { transform: 'rotate(0deg)' } } },
        { name: 'chrono:display-set', data: { content: '--:--', style: { color: '#334155' } } },
      ],
      update: { chrono: { status: 'idle' } },
    }
  }

  return undefined
}

/** Creates the V2 port of the V1 chrono scene through the common layout contract. */
export function createScene(): SceneDoc {
  return {
    id: 'chrono-scene',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        straps: { chrono: resolveChronoStrap },
        listen: [
          { on: 'chrono:start', straps: ['chrono'] },
          { on: 'chrono:stop', straps: ['chrono'] },
          { on: 'chrono:reset', straps: ['chrono'] },
        ],
        persos: [
          {
            id: 'chrono-root',
            type: 'list',
            initial: { move: '@root', className: 'chrono-root' },
            actions: {},
          },
          {
            id: 'chrono-wrapper',
            type: 'list',
            initial: { move: { target: 'chrono-root' }, className: 'chrono-wrapper' },
            actions: {},
          },
          {
            id: 'chrono-face',
            type: 'layout',
            initial: {
              move: { target: 'chrono-wrapper' },
              markup: buildClockFaceMarkup(),
              className: 'chrono-face',
            },
            actions: {},
          },
          {
            id: 'chrono-needle',
            type: 'list',
            initial: { move: { target: 'chrono-wrapper' }, className: 'chrono-needle' },
            actions: {
              'chrono:needle': {
                duration: SCENE_DURATION_MS,
                ease: 'linear',
                fn: resolveNeedleFrame,
              },
              'chrono:needle-set': {},
            },
          },
          {
            id: 'chrono-dot',
            type: 'list',
            initial: { move: { target: 'chrono-wrapper' }, className: 'chrono-dot' },
            actions: {},
          },
          {
            id: 'chrono-display',
            type: 'tag',
            initial: {
              tag: 'span',
              move: { target: 'chrono-wrapper' },
              content: '--:--',
              className: 'chrono-display',
            },
            actions: {
              'chrono:display': {
                duration: SCENE_DURATION_MS,
                ease: 'linear',
                fn: resolveDisplayFrame,
              },
              'chrono:display-set': {},
            },
          },
          {
            id: 'chrono-controls',
            type: 'list',
            initial: { move: { target: 'chrono-root' }, className: 'chrono-controls' },
            actions: {},
          },
          {
            id: 'btn-chrono-start',
            type: 'tag',
            initial: {
              tag: 'button',
              content: 'Démarrer',
              className: 'chrono-button chrono-button--start',
              attr: { type: 'button' },
              move: { target: 'chrono-controls' },
            },
            emit: {
              click: { event: { name: 'chrono:start' }, data: { start: START_SECONDS, stop: STOP_SECONDS } },
            },
            actions: {
              'chrono:start': { style: { display: 'none' } },
              'chrono:reset': { style: { display: 'inline-flex' } },
            },
          },
          {
            id: 'btn-chrono-pause',
            type: 'tag',
            initial: {
              tag: 'button',
              content: 'Pause',
              className: 'chrono-button chrono-button--pause',
              attr: { type: 'button' },
              style: { display: 'none' },
              move: { target: 'chrono-controls' },
            },
            emit: { click: { event: { name: 'chrono:stop' } } },
            actions: {
              'chrono:start': { style: { display: 'inline-flex' } },
              'chrono:stop': { style: { display: 'none' } },
              'chrono:reset': { style: { display: 'none' } },
            },
          },
          {
            id: 'btn-chrono-resume',
            type: 'tag',
            initial: {
              tag: 'button',
              content: 'Reprendre',
              className: 'chrono-button chrono-button--resume',
              attr: { type: 'button' },
              style: { display: 'none' },
              move: { target: 'chrono-controls' },
            },
            emit: {
              click: { event: { name: 'chrono:start' }, data: { start: START_SECONDS, stop: STOP_SECONDS } },
            },
            actions: {
              'chrono:stop': { style: { display: 'inline-flex' } },
              'chrono:start': { style: { display: 'none' } },
              'chrono:reset': { style: { display: 'none' } },
            },
          },
          {
            id: 'btn-chrono-reset',
            type: 'tag',
            initial: {
              tag: 'button',
              content: 'Réinitialiser',
              className: 'chrono-button chrono-button--reset',
              attr: { type: 'button' },
              move: { target: 'chrono-controls' },
            },
            emit: { click: { event: { name: 'chrono:reset' } } },
            actions: {},
          },
        ],
        eventimes: [],
      },
    },
  }
}
