import type { StrapCollection, StoryEvent } from 'codplay-v1/player'
import type { ActionSequenceStrapStep } from 'codplay-v1/player/strap-types'
import type { SceneDoc } from 'codplay-v1/player/types'
import type { ThreejsBuildContext, ThreejsBuildResult, ThreejsSimulationFn } from '@codplay/threejs'
import { MOUTH_CUES, phraseWordsFR } from './avatar-data/phrase-fr'
import { RHUBARB_TO_RIVE_VISEME, riveCoachVisemeConversionStraps } from './avatar-data/rive-viseme-conversion'
import type { RhubarbVisemeCode } from './avatar-data/rhubarb-viseme-map'
import { createRiveCoachBlock } from './rive-coach-scene'
import { buildAnimeGridScene, createAnimeGridSimulation } from './threejs-anime-grid-scene'
import { buildReverseIllusionSchedule, resolveResumeDelayMs, type TimedEntry } from './shared/reverse-illusion'

const MASHUP_END_MS = 18500

// Rewind illusion envelope — hardcoded per the validated design
// (docs/plans/2026-07-24-mashup-reverse-illusion-plan.md): at TRIGGER_OFFSET_MS
// the scene mimes a return to TARGET_OFFSET_MS's look (REVERSE_DURATION_MS),
// holds (PAUSE_DURATION_MS), then resumes forward by duplicating the same
// window identically before continuing into the untouched tail.
const TARGET_OFFSET_MS = 2000
const TRIGGER_OFFSET_MS = 5000
const REVERSE_DURATION_MS = 1500
const PAUSE_DURATION_MS = 1000
const WINDOW_DURATION_MS = TRIGGER_OFFSET_MS - TARGET_OFFSET_MS
const RESUME_DELAY_MS = resolveResumeDelayMs({ reverseDurationMs: REVERSE_DURATION_MS, pauseDurationMs: PAUSE_DURATION_MS })
const TOTAL_SHIFT_MS = RESUME_DELAY_MS + WINDOW_DURATION_MS
const SEQUENCE_END_MS = MASHUP_END_MS + TOTAL_SHIFT_MS

const REWIND_SPEC = {
  targetOffsetMs: TARGET_OFFSET_MS,
  triggerOffsetMs: TRIGGER_OFFSET_MS,
  reverseDurationMs: REVERSE_DURATION_MS,
  pauseDurationMs: PAUSE_DURATION_MS,
}

function toSequenceSteps<T>(entries: TimedEntry<T>[], toEvent: (value: T) => StoryEvent): ActionSequenceStrapStep[] {
  return entries.map((entry) => ({ startAt: entry.offsetMs, step: { event: toEvent(entry.value) } }))
}

/**
 * Convertit une liste de valeurs numériques ponctuelles en pas de tween
 * chaînés `from → to` sur la durée qui sépare deux valeurs consécutives —
 * jamais un saut instantané. Le dernier point n'ouvre pas de nouveau pas
 * (rien à tweenir après lui).
 */
function toTweenSteps(
  entries: TimedEntry<number>[],
  toEvent: (from: number, to: number, durationMs: number) => StoryEvent,
): ActionSequenceStrapStep[] {
  const steps: ActionSequenceStrapStep[] = []
  for (let i = 0; i < entries.length - 1; i += 1) {
    const from = entries[i]!
    const to = entries[i + 1]!
    const durationMs = to.offsetMs - from.offsetMs
    if (durationMs <= 0) continue
    steps.push({ startAt: from.offsetMs, step: { event: toEvent(from.value, to.value, durationMs) } })
  }
  return steps
}

// Tout ce qui suit reste dans une seule story (mashup-root-story) : aucun
// event de canal n'a besoin de cascade — la cible est toujours une action de
// perso locale à cette même story.

// ── Visème (Rive, déjà converti — bypass du strap raw→rive, valeurs en dur) ──

const visemeEntries: TimedEntry<RhubarbVisemeCode>[] = MOUTH_CUES
  .filter((cue) => RHUBARB_TO_RIVE_VISEME[cue.value] !== null)
  .map((cue) => ({ offsetMs: Math.round(cue.start * 1000), value: cue.value }))
const visemeSplit = buildReverseIllusionSchedule(visemeEntries, REWIND_SPEC)

function visemeEvent(value: RhubarbVisemeCode): StoryEvent {
  return { name: 'avatar:viseme', data: { viseme: RHUBARB_TO_RIVE_VISEME[value] } }
}

// ── Mots (légende) ────────────────────────────────────────────────────────

const wordEntries: TimedEntry<string>[] = phraseWordsFR.map((w) => ({ offsetMs: w.startMs, value: w.word }))
const wordSplit = buildReverseIllusionSchedule(wordEntries, REWIND_SPEC)

function wordEvent(value: string): StoryEvent {
  return { name: 'subtitle:word', data: { content: value } }
}

// ── Audio — scrub par sauts (broadcast:START déjà réutilisable à tout instant,
// create-media-sync-module.ts:136-161), un seul START au resume suffit ensuite
// puisque la lecture continue naturellement en temps réel. ─────────────────

const AUDIO_STEP_MS = 300
const audioSampleEntries: TimedEntry<number>[] = []
for (let t = TARGET_OFFSET_MS; t < TRIGGER_OFFSET_MS; t += AUDIO_STEP_MS) {
  audioSampleEntries.push({ offsetMs: t, value: t })
}
const audioBackSplit = buildReverseIllusionSchedule(audioSampleEntries, REWIND_SPEC)

function audioStartEvent(mediaMs: number): StoryEvent {
  return { name: 'mashup:audio:rewind', data: { broadcast: { type: 'START', startAt: mediaMs } } }
}

function audioPauseEvent(): StoryEvent {
  return { name: 'mashup:audio:rewind', data: { broadcast: { type: 'PAUSE' } } }
}

// ── Vidéo (media perso indépendant, démarre VIDEO_START_DELAY_MS après le
// début réel de la scène — courte, donc décalée pour ne pas finir avant le
// déclenchement). Mêmes instants réels de scrub que l'audio, mais un temps
// média décalé d'autant, puisque sa propre horloge interne ne commence qu'à
// VIDEO_START_DELAY_MS. ────────────────────────────────────────────────────

const VIDEO_START_DELAY_MS = 1500

const videoSampleEntries: TimedEntry<number>[] = audioSampleEntries.map((entry) => ({
  offsetMs: entry.offsetMs,
  value: Math.max(0, entry.value - VIDEO_START_DELAY_MS),
}))
const videoBackSplit = buildReverseIllusionSchedule(videoSampleEntries, REWIND_SPEC)

function videoStartEvent(mediaMs: number): StoryEvent {
  return { name: 'mashup:video:rewind', data: { broadcast: { type: 'START', startAt: mediaMs } } }
}

function videoPauseEvent(): StoryEvent {
  return { name: 'mashup:video:rewind', data: { broadcast: { type: 'PAUSE' } } }
}

// ── Barre de progression (fausse — illustrative). Trois tranches, même
// mécanique répétée : avant le déclenchement (eventimes réels, forward,
// jamais touchés), puis back/resume (straps) pour la fenêtre rejouée. ──────

const PROGRESS_TICK_MS = 500
const progressEntries: TimedEntry<number>[] = []
for (let t = 0; t <= MASHUP_END_MS; t += PROGRESS_TICK_MS) {
  progressEntries.push({ offsetMs: t, value: Math.round((t / MASHUP_END_MS) * 100) })
}
const progressSplit = buildReverseIllusionSchedule(progressEntries, REWIND_SPEC)
// Inclut le tick exactement à TRIGGER_OFFSET_MS (pas seulement <) pour que le
// dernier segment forward tween jusqu'à la valeur du déclenchement, sans à-coup.
const progressForwardEntries = progressEntries.filter((entry) => entry.offsetMs <= TRIGGER_OFFSET_MS)
// Point de départ synthétique pour la phase "back" : la valeur au moment même
// du déclenchement, pour que son premier segment tween depuis là où le
// forward vient de s'arrêter, au lieu de sauter directement à sa 1ère cue.
const progressValueAtTrigger = Math.round((TRIGGER_OFFSET_MS / MASHUP_END_MS) * 100)
const progressBackWithStart: TimedEntry<number>[] = [{ offsetMs: 0, value: progressValueAtTrigger }, ...progressSplit.back]

function progressFillTweenEvent(from: number, to: number, durationMs: number): StoryEvent {
  return { name: 'mashup:progress:fill', data: { style: { width: { from: `${from}%`, to: `${to}%`, duration: durationMs } } } }
}

function progressPointerTweenEvent(from: number, to: number, durationMs: number): StoryEvent {
  return { name: 'mashup:progress:pointer', data: { style: { left: { from: `${from}%`, to: `${to}%`, duration: durationMs } } } }
}

// ── Fond threejs — flip de direction via un ref custom, pas une table de cues ──

type BgClock = { direction: 1 | -1 }

function buildReversibleAnimeGridScene(context: ThreejsBuildContext): ThreejsBuildResult {
  const result = buildAnimeGridScene(context)
  return {
    ...result,
    refs: {
      ...(result.refs ?? {}),
      clock: { direction: 1 } satisfies BgClock,
    },
  }
}

/** Enveloppe `createAnimeGridSimulation` avec une horloge virtuelle accumulée, dont le sens
 *  suit le ref `clock` — le calcul original reste intact, seul le `timelineMs` qu'il reçoit change. */
function createReversibleAnimeGridSimulation(): ThreejsSimulationFn {
  const inner = createAnimeGridSimulation()
  let virtualElapsedMs = 0
  let lastRealMs: number | null = null

  return (input) => {
    if (lastRealMs === null) lastRealMs = input.timelineMs
    const deltaMs = input.timelineMs - lastRealMs
    lastRealMs = input.timelineMs

    const clock = input.refs.get('clock') as BgClock | undefined
    const direction = clock?.direction ?? 1
    virtualElapsedMs = Math.max(0, virtualElapsedMs + deltaMs * direction)

    inner({ ...input, timelineMs: virtualElapsedMs })
  }
}

function bgDirectionEvent(direction: 1 | -1): StoryEvent {
  return {
    name: 'mashup:bg:direction',
    data: { set: [{ ref: 'clock', values: { direction } }] },
  }
}

// ── Scène ──────────────────────────────────────────────────────────────────

const riveBlock = createRiveCoachBlock({
  stageId: 'mashup-rive-stage',
  audioId: 'mashup-audio',
  avatarId: 'mashup-avatar',
  parentId: 'mashup-aside-slot',
  width: '340px',
  height: '340px',
  showCaption: true,
  stageClassName: 'mashup-rive-stage',
  avatarStyle: {
    inset: 'auto',
    left: '50%',
    bottom: '-6%',
    width: '165%',
    height: '165%',
    transform: 'translateX(-50%)',
  },
  captionStyle: {
    bottom: '8px',
    width: '88%',
    fontSize: '0.85rem',
    padding: '0.3em 0.55em',
  },
  stageStyle: {
    width: '100%',
    height: '100%',
  },
})

// audio:start/avatar:start restent à 0 (< TRIGGER_OFFSET_MS) ; seule la queue
// vidéo/mots au-delà du déclenchement est retirée — régénérée par le strap
// "resume", jamais rejouée deux fois depuis le planning original.
const filteredRiveEventimes = riveBlock.eventimes.filter((entry) => entry.startAt < TRIGGER_OFFSET_MS)

// Ajoute le vocabulaire d'action du rewind sur le perso audio existant (aucun doublon).
for (const perso of riveBlock.persos) {
  if ((perso as { id?: string }).id === 'mashup-audio') {
    (perso as { actions: Record<string, unknown> }).actions['mashup:audio:rewind'] = {}
  }
}

export const mashupBackAndForeScene = {
  id: 'mashup-back-and-fore-scene',
  stories: {
    'mashup-root-story': {
      id: 'mashup-root-story',
      initial: { move: '@root' },
      straps: {
        ...riveCoachVisemeConversionStraps,
        'mashup-rewind-back': ({ context }) => {
          return [
            {
              events: [
                { name: 'mashup:rewind:back-start' },
                bgDirectionEvent(-1),
              ],
            },
            context.planned.sequence(toSequenceSteps(visemeSplit.back, visemeEvent)),
            context.planned.sequence(toSequenceSteps(wordSplit.back, wordEvent)),
            context.planned.sequence(toTweenSteps(progressBackWithStart, progressFillTweenEvent)),
            context.planned.sequence(toTweenSteps(progressBackWithStart, progressPointerTweenEvent)),
            context.planned.sequence([
              ...toSequenceSteps(audioBackSplit.back, audioStartEvent),
              { startAt: REVERSE_DURATION_MS, step: { event: audioPauseEvent() } },
            ]),
            context.planned.sequence([
              ...toSequenceSteps(videoBackSplit.back, videoStartEvent),
              { startAt: REVERSE_DURATION_MS, step: { event: videoPauseEvent() } },
            ]),
            // Pas de cascade ici : cet event doit rester local à mashup-root-story
            // pour matcher sa propre règle `listen` (cascade le ré-aiguillerait au
            // niveau scène, où rien ne le rattrape, et "mashup-rewind-resume" ne
            // se déclencherait jamais).
            context.planned.wait(RESUME_DELAY_MS, {
              event: { name: 'mashup:rewind:resume:trigger' },
            }),
          ]
        },
        'mashup-rewind-resume': ({ context }) => {
          return [
            {
              events: [
                { name: 'mashup:rewind:resume-start' },
                bgDirectionEvent(1),
                audioStartEvent(TARGET_OFFSET_MS),
                videoStartEvent(Math.max(0, TARGET_OFFSET_MS - VIDEO_START_DELAY_MS)),
              ],
            },
            context.planned.sequence(toSequenceSteps(visemeSplit.resume, visemeEvent)),
            context.planned.sequence(toSequenceSteps(wordSplit.resume, wordEvent)),
            context.planned.sequence(toTweenSteps(progressSplit.resume, progressFillTweenEvent)),
            context.planned.sequence(toTweenSteps(progressSplit.resume, progressPointerTweenEvent)),
          ]
        },
      } as StrapCollection,
      listen: [
        ...riveBlock.listen,
        { on: 'mashup:rewind:start', straps: ['mashup-rewind-back'] },
        { on: 'mashup:rewind:resume:trigger', straps: ['mashup-rewind-resume'] },
      ],
      persos: [
        {
          id: 'mashup-stage',
          type: 'tag',
          initial: {
            tag: 'div',
            className: 'mashup-stage',
            move: '@root',
            style: {
              position: 'relative',
            },
          },
          actions: {},
        },
        {
          id: 'mashup-bg',
          type: 'threejs',
          initial: {
            move: { parentId: 'mashup-stage' },
            width: 960,
            height: 640,
            build: buildReversibleAnimeGridScene,
          },
          actions: {
            'scene:start': {
              simulate: createReversibleAnimeGridSimulation(),
            },
            'mashup:bg:direction': {},
          },
        },
        {
          id: 'mashup-overlay',
          type: 'layout',
          initial: {
            markup: `
              <div class="mashup-overlay">
                <div data-part="mashup-video-slot" class="mashup-video-slot"></div>
                <div data-part="mashup-aside-slot" class="mashup-aside-slot"></div>
                <div data-part="mashup-progress-slot" class="mashup-progress-slot"></div>
              </div>
            `,
            move: { parentId: 'mashup-stage' },
          } as never,
          actions: {},
        },
        ...riveBlock.persos,
        {
          id: 'mashup-video',
          type: 'media',
          initial: {
            tag: 'video',
            src: '/assets/LcXkmXyuZQ.mp4',
            master: false,
            className: 'mashup-video',
            video: { style: { objectFit: 'cover', display: 'block' } },
            move: { parentId: 'mashup-video-slot' },
          },
          actions: {
            'mashup:video:start': { broadcast: { type: 'START' } },
            'mashup:video:rewind': {},
          },
        },
        {
          id: 'mashup-progress-group',
          type: 'tag',
          initial: {
            tag: 'div',
            className: 'mashup-progress-group',
            move: { parentId: 'mashup-progress-slot' },
          },
          actions: {
            'mashup:rewind:back-start': {
              style: { scale: { from: 1, to: 1.8, duration: 400 } },
            },
            'mashup:rewind:resume-start': {
              style: { scale: { from: 1.8, to: 1, duration: 400 } },
            },
          },
        },
        {
          id: 'mashup-progress-icon',
          type: 'tag',
          initial: {
            tag: 'div',
            className: 'mashup-progress-icon',
            move: { parentId: 'mashup-progress-group' },
          },
          actions: {},
        },
        {
          id: 'mashup-progress-track-wrap',
          type: 'tag',
          initial: {
            tag: 'div',
            className: 'mashup-progress-track-wrap',
            move: { parentId: 'mashup-progress-group' },
          },
          actions: {},
        },
        {
          id: 'mashup-progress-pointer',
          type: 'tag',
          initial: {
            tag: 'div',
            className: 'mashup-progress-pointer',
            move: { parentId: 'mashup-progress-track-wrap' },
            style: { left: '0%' },
          },
          actions: {
            'mashup:progress:pointer': {},
          },
        },
        {
          id: 'mashup-progress-track',
          type: 'tag',
          initial: {
            tag: 'div',
            className: 'mashup-progress-track',
            move: { parentId: 'mashup-progress-track-wrap' },
          },
          actions: {},
        },
        {
          id: 'mashup-progress-fill',
          type: 'tag',
          initial: {
            tag: 'div',
            className: 'mashup-progress-fill',
            move: { parentId: 'mashup-progress-track' },
            style: { width: '0%' },
          },
          actions: {
            'mashup:progress:fill': {},
          },
        },
      ],
      eventimes: [
        { name: 'scene:start', startAt: 0 },
        { name: 'mashup:video:start', startAt: VIDEO_START_DELAY_MS },
        ...filteredRiveEventimes,
        ...toTweenSteps(progressForwardEntries, progressFillTweenEvent).map((step) => ({
          name: step.step.event!.name,
          startAt: step.startAt!,
          data: step.step.event!.data,
        })),
        ...toTweenSteps(progressForwardEntries, progressPointerTweenEvent).map((step) => ({
          name: step.step.event!.name,
          startAt: step.startAt!,
          data: step.step.event!.data,
        })),
        { name: 'mashup:rewind:start', startAt: TRIGGER_OFFSET_MS },
        { name: 'sequence:end', startAt: SEQUENCE_END_MS },
      ],
    },
  },
} as unknown as SceneDoc

export const mashupBackAndForeStraps: StrapCollection = {}
