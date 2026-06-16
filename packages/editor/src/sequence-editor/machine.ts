import { setup, assign } from 'xstate'
import type {
  EditorScene, TrackNode, Keyframe, TextCue, AuthorMarker, MarkerTrack, AudioTrack,
  WaveformDataV1, TransitionDef, LayoutProfile, DisplayConfig,
} from './types'
import { CapsuleDistribution } from 'codplay/capsule-distribution'
import type { ChildInput } from 'codplay/capsule-distribution'
import {
  ZOOM_DEFAULT_PX_PER_SEC, ZOOM_MIN_PX_PER_SEC, ZOOM_MAX_PX_PER_SEC,
  TIME_STEP_MS,
} from './constants'
import { LAYOUT_PROFILE_DEFAULT } from './layout-profile'
import { DISPLAY_CONFIG_DEFAULT } from './display-config'
import { flattenTracks, findParentClipBounds } from './utils'

// ─── Machine-specific types (§3.1) ──────────────────────────────────────────

export interface MachineViewport {
  startMs: number
  endMs: number
  pixelsPerMs: number
  viewWidthPx: number
  viewHeightPx: number
}

export interface MachineSelection {
  trackId: string | null
  keyframeId: string | null
  markerId: string | null
}

export type MachineSnapPoint = {
  timeMs: number
  kind: 'cue-start' | 'cue-end' | 'marker' | 'keyframe'
  sourceId: string
}

export type MachineInteraction =
  | { kind: 'dragging-keyframe'; trackId: string; keyframeId: string; originMs: number; currentMs: number }
  | { kind: 'dragging-playhead'; originMs: number; currentMs: number }
  | { kind: 'panning'; originPx: number; originStartMs: number }
  | { kind: 'drawing-clip'; trackId: string; startMs: number; currentMs: number; introId: string; outroId: string }

export type PlayRange = { inMs: number; outMs: number }

export interface VirtualKeyframe {
  trackId: string
  id: string
  timeMs: number
  name: 'intro' | 'outro'
  visible: boolean
}

export interface MachineContext {
  scene: EditorScene
  viewport: MachineViewport
  playheadMs: number
  isPlaying: boolean
  playRange: PlayRange | null
  followPlayhead: boolean
  selection: MachineSelection
  interaction: MachineInteraction | null
  layoutProfile: LayoutProfile
  displayConfig: DisplayConfig
  viewMode: 'full-sequence' | 'text-priority'
  snapGrid: MachineSnapPoint[]
  virtualKeyframes: VirtualKeyframe[]
}

export type MachineInput = {
  scene: EditorScene
  viewWidthPx?: number
  viewHeightPx?: number
}

// ─── Events (§3.4) ──────────────────────────────────────────────────────────

export type SequenceEditorEvent =
  | { type: 'TRACK.SELECT'; trackId: string | null }
  | { type: 'KEYFRAME.SELECT'; trackId: string; keyframeId: string | null }
  | { type: 'MARKER.SELECT'; markerId: string | null }
  | { type: 'KEYFRAME.ADD'; trackId: string; timeMs: number; id?: string }
  | { type: 'KEYFRAME.REMOVE'; trackId: string; keyframeId: string }
  | { type: 'KEYFRAME.CLEAR_TRACK'; trackId: string }
  | { type: 'KEYFRAME.CLEAR_CAPSULE'; trackId: string }
  | { type: 'KEYFRAME.RENAME'; trackId: string; keyframeId: string; name: string | null }
  | { type: 'KEYFRAME.ASSIGN_DECOR'; trackId: string; keyframeId: string; decorId: string | null }
  | { type: 'DECOR.REGISTER'; decorId: string; data: Record<string, unknown> }
  | { type: 'KEYFRAME.SET_TRANSITION_IN'; trackId: string; keyframeId: string; def: TransitionDef | null }
  | { type: 'KEYFRAME.SET_TRANSITION_OUT'; trackId: string; keyframeId: string; def: TransitionDef | null }
  | { type: 'DRAG.START_KEYFRAME'; trackId: string; keyframeId: string }
  | { type: 'DRAG.MOVE'; pointerMs: number }
  | { type: 'DRAG.END' }
  | { type: 'CLIP.PLACE'; trackId: string; pointerMs: number }
  | { type: 'CLIP.START_DRAW'; trackId: string; pointerMs: number; introId: string; outroId: string }
  | { type: 'CLIP.DRAW_MOVE'; pointerMs: number }
  | { type: 'CLIP.DRAW_END' }
  | { type: 'PLAYHEAD.SET'; timeMs: number }
  | { type: 'PLAYHEAD.START_PLAY' }
  | { type: 'PLAYHEAD.PAUSE' }
  | { type: 'PLAYHEAD.STOP' }
  | { type: 'PLAYHEAD.TICK'; deltaMs: number }
  | { type: 'VIEWPORT.PAN_START'; pointerPx: number }
  | { type: 'VIEWPORT.PAN_MOVE'; pointerPx: number }
  | { type: 'VIEWPORT.PAN_END' }
  | { type: 'VIEWPORT.SCROLL'; startMs: number }
  | { type: 'VIEWPORT.ZOOM'; factor: number; focusMs: number }
  | { type: 'PLAYRANGE.SET'; inMs: number; outMs: number }
  | { type: 'PLAYRANGE.CLEAR' }
  | { type: 'FOLLOW.TOGGLE' }
  | { type: 'VIEWPORT.RESIZE'; widthPx: number; heightPx: number }
  | { type: 'VIEWPORT.SET_MODE'; mode: 'full-sequence' | 'text-priority' }
  | { type: 'VIEWPORT.SET_LAYOUT_PROFILE'; profile: LayoutProfile }
  | { type: 'VIEWPORT.SET_DISPLAY_CONFIG'; config: DisplayConfig }
  | { type: 'TRACK.ADD'; node: Omit<TrackNode, 'keyframes'> & { id: string }; afterId?: string }
  | { type: 'TRACK.REMOVE'; trackId: string }
  | { type: 'TRACK.MOVE'; trackId: string; afterId: string | null; parentId?: string }
  | { type: 'TRACK.TOGGLE_VISIBILITY'; trackId: string }
  | { type: 'TRACK.NEST_IN_CAPSULE'; trackId: string; capsuleId: string }
  | { type: 'TRACK.RESET_KEYFRAMES'; trackId: string }
  | { type: 'CUE.ADD'; cue: TextCue & { id: string } }
  | { type: 'CUE.REMOVE'; cueId: string }
  | { type: 'MARKER_TRACK.ADD'; track: MarkerTrack }
  | { type: 'MARKER_TRACK.REMOVE'; markerTrackId: string }
  | { type: 'MARKER_TRACK.RENAME'; markerTrackId: string; label: string }
  | { type: 'MARKER_TRACK.TOGGLE_VISIBILITY'; markerTrackId: string }
  | { type: 'MARKER.ADD'; markerTrackId: string; marker: AuthorMarker & { id: string } }
  | { type: 'MARKER.MOVE'; markerId: string; timeMs: number }
  | { type: 'MARKER.REMOVE'; markerId: string }
  | { type: 'KEYFRAME.ATTACH_MARKER'; trackId: string; keyframeId: string; markerId: string }
  | { type: 'KEYFRAME.DETACH_MARKER'; trackId: string; keyframeId: string }
  | { type: 'AUDIO.SET'; track: AudioTrack }
  | { type: 'AUDIO.CLEAR' }
  | { type: 'AUDIO.SET_WAVEFORM'; waveform: WaveformDataV1 }
  | { type: 'SCENE.LOAD'; scene: EditorScene }
  | { type: 'SCENE.SET_DURATION'; durationMs: number; source?: EditorScene['durationSource'] }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_PX_PER_MS = ZOOM_DEFAULT_PX_PER_SEC / 1000
const MIN_PX_PER_MS = ZOOM_MIN_PX_PER_SEC / 1000
const MAX_PX_PER_MS = ZOOM_MAX_PX_PER_SEC / 1000

function computeEndMs(vp: MachineViewport): number {
  return vp.startMs + vp.viewWidthPx / vp.pixelsPerMs
}

function clampViewportStart(startMs: number, vp: MachineViewport, durationMs: number): number {
  const viewDurationMs = vp.viewWidthPx / vp.pixelsPerMs
  return Math.max(0, Math.min(startMs, durationMs - viewDurationMs))
}

function detachKeyframesByMarkerIds(tracks: TrackNode[], markerIds: ReadonlySet<string>): TrackNode[] {
  return tracks.map(t => ({
    ...t,
    keyframes: t.keyframes.map(k =>
      k.markerId !== undefined && markerIds.has(k.markerId) ? { ...k, markerId: undefined } : k,
    ),
    children: t.children ? detachKeyframesByMarkerIds(t.children, markerIds) : undefined,
  }))
}

function computeSnapGrid(scene: EditorScene): MachineSnapPoint[] {
  const points: MachineSnapPoint[] = []
  for (const cue of scene.cues) {
    points.push({ timeMs: cue.timeMs, kind: 'cue-start', sourceId: cue.id })
  }
  for (const track of scene.markerTracks) {
    for (const marker of track.markers) {
      points.push({ timeMs: marker.timeMs, kind: 'marker', sourceId: marker.id })
    }
  }
  for (const track of flattenTracks(scene.tracks)) {
    for (const kf of track.keyframes) {
      points.push({ timeMs: kf.timeMs, kind: 'keyframe', sourceId: kf.id })
    }
  }
  return points.sort((a, b) => a.timeMs - b.timeMs)
}

function computeVirtualKeyframes(scene: EditorScene, capsuleOrder: 'forward' | 'backward' = 'forward'): VirtualKeyframe[] {
  const result: VirtualKeyframe[] = []
  for (const capsule of flattenTracks(scene.tracks)) {
    if (capsule.kind !== 'capsule' || !capsule.children?.length) continue
    const introKf = capsule.keyframes.find(k => k.name === 'intro')
    const outroKf = capsule.keyframes.find(k => k.name === 'outro')
    if (!introKf || !outroKf) continue
    const clipDurationMs = outroKf.timeMs - introKf.timeMs
    if (clipDurationMs <= 0) continue

    const children: ChildInput[] = capsule.children.map(child => {
      const ci = child.keyframes.find(k => k.name === 'intro')
      const co = child.keyframes.find(k => k.name === 'outro')
      return {
        trackId: child.id,
        lockedIntroMs: ci !== undefined ? ci.timeMs - introKf.timeMs : undefined,
        lockedOutroMs: co !== undefined ? co.timeMs - introKf.timeMs : undefined,
      }
    })

    const dist = capsule.distribution ?? { mode: 'sequential' as const }
    const out = CapsuleDistribution.compute({
      clipDurationMs,
      mode: dist.mode,
      order: capsuleOrder,
      staggerInMs: dist.staggerInMs,
      staggerOutMs: dist.staggerOutMs,
      children,
    })

    for (let i = 0; i < out.children.length; i++) {
      const childOut = out.children[i]!
      const child = capsule.children[i]!
      const hasIntro = child.keyframes.some(k => k.name === 'intro')
      const hasOutro = child.keyframes.some(k => k.name === 'outro')
      if (!hasIntro) {
        result.push({
          trackId: child.id,
          id: `vkf-${child.id}-intro`,
          timeMs: introKf.timeMs + childOut.introMs,
          name: 'intro',
          visible: childOut.visible,
        })
      }
      if (!hasOutro) {
        result.push({
          trackId: child.id,
          id: `vkf-${child.id}-outro`,
          timeMs: introKf.timeMs + childOut.outroMs,
          name: 'outro',
          visible: childOut.visible,
        })
      }
    }
  }
  return result
}

function findNearestSnap(snapGrid: MachineSnapPoint[], timeMs: number): MachineSnapPoint | null {
  let nearest: MachineSnapPoint | null = null
  let minDist = Infinity
  for (const pt of snapGrid) {
    const d = Math.abs(pt.timeMs - timeMs)
    if (d < minDist) { minDist = d; nearest = pt }
  }
  return nearest
}

export function applySnapToMs(
  rawMs: number,
  snapGrid: MachineSnapPoint[],
  thresholdMs: number,
): number {
  const nearest = findNearestSnap(snapGrid, rawMs)
  if (nearest && Math.abs(nearest.timeMs - rawMs) <= thresholdMs) return nearest.timeMs
  return Math.round(rawMs / TIME_STEP_MS) * TIME_STEP_MS
}

function updateTrackInScene(
  scene: EditorScene,
  trackId: string,
  updater: (track: TrackNode) => TrackNode,
): EditorScene {
  function walk(tracks: TrackNode[]): TrackNode[] {
    return tracks.map(t => {
      if (t.id === trackId) return updater(t)
      if (t.children) return { ...t, children: walk(t.children) }
      return t
    })
  }
  return { ...scene, tracks: walk(scene.tracks) }
}

function pruneOrphanDecors(scene: EditorScene): EditorScene {
  const used = new Set(
    flattenTracks(scene.tracks).flatMap(t => t.keyframes).map(k => k.decorId).filter(Boolean) as string[],
  )
  const decors = Object.fromEntries(Object.entries(scene.decors).filter(([id]) => used.has(id)))
  return { ...scene, decors }
}

function insertKeyframeSorted(keyframes: Keyframe[], kf: Keyframe): Keyframe[] {
  return [...keyframes, kf].sort((a, b) => a.timeMs - b.timeMs)
}

function enforceClipOrder(keyframes: Keyframe[]): Keyframe[] {
  const intro = keyframes.find(k => k.name === 'intro')
  const outro = keyframes.find(k => k.name === 'outro')
  if (!intro || !outro || intro.timeMs <= outro.timeMs) return keyframes
  return keyframes.map(k => {
    if (k.id === intro.id) return { ...k, name: 'outro' as const }
    if (k.id === outro.id) return { ...k, name: 'intro' as const }
    return k
  })
}

function adjacentDecorId(keyframes: Keyframe[], timeMs: number): string | null {
  const sorted = [...keyframes].sort((a, b) => a.timeMs - b.timeMs)
  let prev: Keyframe | null = null
  for (const k of sorted) {
    if (k.timeMs <= timeMs) prev = k
    else break
  }
  return prev?.decorId ?? sorted[0]?.decorId ?? null
}

// ─── Machine ─────────────────────────────────────────────────────────────────

export const sequenceEditorMachine = setup({
  types: {} as {
    context: MachineContext
    events: SequenceEditorEvent
    input: MachineInput
  },

  guards: {
    canCommitDrag: ({ context }) => {
      const i = context.interaction
      if (!i || i.kind !== 'dragging-keyframe') return false
      return i.currentMs >= 0 && i.currentMs <= context.scene.durationMs
    },
    snapThresholdReached: ({ context }) => {
      const i = context.interaction
      if (!i || (i.kind !== 'dragging-keyframe' && i.kind !== 'dragging-playhead')) return false
      const nearest = findNearestSnap(context.snapGrid, i.currentMs)
      if (!nearest) return false
      const thresholdMs = context.layoutProfile.snapThresholdPx / context.viewport.pixelsPerMs
      return Math.abs(nearest.timeMs - i.currentMs) <= thresholdMs
    },
  },

  actions: {
    assignSnapGrid: assign(({ context }) => ({
      snapGrid: computeSnapGrid(context.scene),
      virtualKeyframes: computeVirtualKeyframes(context.scene, context.displayConfig.capsuleOrder),
    })),
  },

}).createMachine({
  id: 'sequence-editor',
  initial: 'idle',

  // These events are handled in all states
  on: {
    'PLAYRANGE.SET': {
      actions: assign(({ event }) => ({
        playRange: { inMs: event.inMs, outMs: event.outMs },
      })),
    },
    'PLAYRANGE.CLEAR': {
      actions: assign(() => ({ playRange: null as PlayRange | null })),
    },
    'FOLLOW.TOGGLE': {
      actions: assign(({ context }) => ({ followPlayhead: !context.followPlayhead })),
    },
    'VIEWPORT.SCROLL': {
      actions: assign(({ context, event }) => {
        const startMs = clampViewportStart(event.startMs, context.viewport, context.scene.durationMs)
        return {
          viewport: {
            ...context.viewport,
            startMs,
            endMs: computeEndMs({ ...context.viewport, startMs }),
          },
        }
      }),
    },
    'VIEWPORT.ZOOM': {
      actions: assign(({ context, event }) => {
        const { pixelsPerMs, viewWidthPx, startMs } = context.viewport
        const raw = pixelsPerMs * event.factor
        const newPxPerMs = isFinite(raw) ? Math.max(MIN_PX_PER_MS, Math.min(MAX_PX_PER_MS, raw)) : MIN_PX_PER_MS
        const focusPx = isFinite(event.focusMs) ? (event.focusMs - startMs) * pixelsPerMs : 0
        const rawStartMs = isFinite(event.focusMs) ? event.focusMs - focusPx / newPxPerMs : startMs
        const newStartMs = isFinite(rawStartMs) ? Math.max(0, rawStartMs) : 0
        const viewport: MachineViewport = {
          ...context.viewport,
          pixelsPerMs: newPxPerMs,
          startMs: newStartMs,
          endMs: newStartMs + viewWidthPx / newPxPerMs,
        }
        return { viewport }
      }),
    },
  },

  context: ({ input }) => {
    const viewWidthPx = input.viewWidthPx ?? 800
    const viewHeightPx = input.viewHeightPx ?? 600
    const pixelsPerMs = DEFAULT_PX_PER_MS
    return {
      scene: input.scene,
      viewport: {
        startMs: 0,
        endMs: viewWidthPx / pixelsPerMs,
        pixelsPerMs,
        viewWidthPx,
        viewHeightPx,
      },
      playheadMs: 0,
      isPlaying: false,
      playRange: null,
      followPlayhead: false,
      selection: { trackId: null, keyframeId: null, markerId: null },
      interaction: null,
      layoutProfile: LAYOUT_PROFILE_DEFAULT,
      displayConfig: DISPLAY_CONFIG_DEFAULT,
      viewMode: 'full-sequence',
      snapGrid: computeSnapGrid(input.scene),
      virtualKeyframes: computeVirtualKeyframes(input.scene, DISPLAY_CONFIG_DEFAULT.capsuleOrder),
    }
  },

  states: {

    // ── idle ────────────────────────────────────────────────────────────────
    idle: {
      on: {
        'TRACK.SELECT': {
          actions: assign(({ event }) => ({
            selection: { trackId: event.trackId, keyframeId: null, markerId: null },
          })),
        },
        'KEYFRAME.SELECT': {
          actions: assign(({ event }) => ({
            selection: { trackId: event.trackId, keyframeId: event.keyframeId, markerId: null },
          })),
        },
        'MARKER.SELECT': {
          actions: assign(({ event }) => ({
            selection: { trackId: null, keyframeId: null, markerId: event.markerId },
          })),
        },

        'KEYFRAME.ADD': {
          actions: assign(({ context, event }) => {
            const timeMs = Math.round(
              Math.max(0, Math.min(event.timeMs, context.scene.durationMs)) / TIME_STEP_MS,
            ) * TIME_STEP_MS
            const track = flattenTracks(context.scene.tracks).find(t => t.id === event.trackId)
            const decorId = track ? adjacentDecorId(track.keyframes, timeMs) : null
            const newKf: Keyframe = { id: event.id ?? `kf-${Date.now()}`, timeMs, decorId }
            const scene = updateTrackInScene(context.scene, event.trackId, t => ({
              ...t,
              keyframes: insertKeyframeSorted(t.keyframes, newKf),
            }))
            return { scene, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'KEYFRAME.REMOVE': {
          actions: assign(({ context, event }) => {
            const removedKf = flattenTracks(context.scene.tracks)
              .find(t => t.id === event.trackId)
              ?.keyframes.find(k => k.id === event.keyframeId)
            const removedDecorId = removedKf?.decorId ?? null

            const sceneAfterRemove = updateTrackInScene(context.scene, event.trackId, t => ({
              ...t,
              keyframes: t.keyframes.filter(k => k.id !== event.keyframeId),
            }))

            // Remove orphan decor — only if no other kf still references it
            let decors = sceneAfterRemove.decors
            if (removedDecorId) {
              const stillUsed = flattenTracks(sceneAfterRemove.tracks)
                .flatMap(t => t.keyframes)
                .some(k => k.decorId === removedDecorId)
              if (!stillUsed) {
                decors = Object.fromEntries(
                  Object.entries(decors).filter(([id]) => id !== removedDecorId),
                )
              }
            }

            const scene = { ...sceneAfterRemove, decors }
            const selection: MachineSelection =
              context.selection.keyframeId === event.keyframeId
                ? { trackId: null, keyframeId: null, markerId: null }
                : context.selection
            return { scene, selection, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'KEYFRAME.CLEAR_TRACK': {
          actions: assign(({ context, event }) => {
            const cleared = updateTrackInScene(context.scene, event.trackId, t => ({ ...t, keyframes: [] }))
            const scene = pruneOrphanDecors(cleared)
            const selection: MachineSelection =
              context.selection.trackId === event.trackId
                ? { trackId: event.trackId, keyframeId: null, markerId: null }
                : context.selection
            return { scene, selection, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'KEYFRAME.CLEAR_CAPSULE': {
          actions: assign(({ context, event }) => {
            function clearAllKf(t: TrackNode): TrackNode {
              return { ...t, keyframes: [], children: t.children?.map(clearAllKf) }
            }
            function clearSubtree(tracks: TrackNode[]): TrackNode[] {
              return tracks.map(t => {
                if (t.id === event.trackId) return clearAllKf(t)
                if (t.children) return { ...t, children: clearSubtree(t.children) }
                return t
              })
            }
            const capsuleRoot = flattenTracks(context.scene.tracks).find(t => t.id === event.trackId)
            const clearedIds = new Set(capsuleRoot ? flattenTracks([capsuleRoot]).map(t => t.id) : [])
            const cleared = { ...context.scene, tracks: clearSubtree(context.scene.tracks) }
            const scene = pruneOrphanDecors(cleared)
            const sel = context.selection
            const selection: MachineSelection =
              sel.trackId && clearedIds.has(sel.trackId)
                ? { trackId: null, keyframeId: null, markerId: null }
                : sel
            return { scene, selection, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'KEYFRAME.RENAME': {
          actions: assign(({ context, event }) => {
            const scene = updateTrackInScene(context.scene, event.trackId, t => ({
              ...t,
              keyframes: t.keyframes.map(k =>
                k.id === event.keyframeId ? { ...k, name: event.name ?? undefined } : k,
              ),
            }))
            return { scene, virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'KEYFRAME.ASSIGN_DECOR': {
          actions: assign(({ context, event }) => ({
            scene: updateTrackInScene(context.scene, event.trackId, t => ({
              ...t,
              keyframes: t.keyframes.map(k =>
                k.id === event.keyframeId ? { ...k, decorId: event.decorId } : k,
              ),
            })),
          })),
        },

        'DECOR.REGISTER': {
          actions: assign(({ context, event }) => ({
            scene: {
              ...context.scene,
              decors: {
                ...context.scene.decors,
                [event.decorId]: { id: event.decorId, data: event.data },
              },
            },
          })),
        },

        'KEYFRAME.SET_TRANSITION_IN': {
          actions: assign(({ context, event }) => ({
            scene: updateTrackInScene(context.scene, event.trackId, t => ({
              ...t,
              keyframes: t.keyframes.map(k =>
                k.id === event.keyframeId
                  ? { ...k, transitionIn: event.def ?? undefined }
                  : k,
              ),
            })),
          })),
        },

        'KEYFRAME.SET_TRANSITION_OUT': {
          actions: assign(({ context, event }) => ({
            scene: updateTrackInScene(context.scene, event.trackId, t => ({
              ...t,
              keyframes: t.keyframes.map(k =>
                k.id === event.keyframeId
                  ? { ...k, transitionOut: event.def ?? undefined }
                  : k,
              ),
            })),
          })),
        },

        'DRAG.START_KEYFRAME': {
          target: 'dragging-keyframe',
          actions: assign(({ context, event }) => {
            const track = flattenTracks(context.scene.tracks).find(t => t.id === event.trackId)
            const kf = track?.keyframes.find(k => k.id === event.keyframeId)
            return {
              interaction: {
                kind: 'dragging-keyframe' as const,
                trackId: event.trackId,
                keyframeId: event.keyframeId,
                originMs: kf?.timeMs ?? 0,
                currentMs: kf?.timeMs ?? 0,
              },
              selection: { trackId: event.trackId, keyframeId: event.keyframeId, markerId: null },
            }
          }),
        },

        'CLIP.PLACE': {
          actions: assign(({ context, event }) => {
            const pointerMs = Math.max(0, Math.min(event.pointerMs, context.scene.durationMs))
            const bounds = findParentClipBounds(event.trackId, context.scene.tracks, context.scene.durationMs)
            const clampedMs = Math.max(bounds.minMs, Math.min(bounds.maxMs, pointerMs))
            const track = flattenTracks(context.scene.tracks).find(t => t.id === event.trackId)
            if (!track) return {}
            const intro = track.keyframes.find(k => k.name === 'intro')
            const outro = track.keyframes.find(k => k.name === 'outro')
            const scene = updateTrackInScene(context.scene, event.trackId, t => {
              let keyframes = [...t.keyframes]
              if (!intro) {
                keyframes = insertKeyframeSorted(keyframes, { id: `kf-${Date.now()}`, timeMs: clampedMs, name: 'intro', decorId: null })
              } else if (!outro) {
                keyframes = insertKeyframeSorted(keyframes, { id: `kf-${Date.now()}`, timeMs: clampedMs, name: 'outro', decorId: null })
                keyframes = enforceClipOrder(keyframes)
              } else {
                const distIntro = Math.abs(clampedMs - intro.timeMs)
                const distOutro = Math.abs(clampedMs - outro.timeMs)
                const moveId = distIntro <= distOutro ? intro.id : outro.id
                keyframes = keyframes.map(k => k.id === moveId ? { ...k, timeMs: clampedMs } : k)
                keyframes = keyframes.sort((a, b) => a.timeMs - b.timeMs)
              }
              return { ...t, keyframes }
            })
            return { scene, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'CLIP.START_DRAW': {
          target: 'drawing-clip',
          actions: assign(({ event }) => ({
            interaction: {
              kind: 'drawing-clip' as const,
              trackId: event.trackId,
              startMs: event.pointerMs,
              currentMs: event.pointerMs,
              introId: event.introId,
              outroId: event.outroId,
            },
          })),
        },

        'PLAYHEAD.SET': {
          actions: assign(({ context, event }) => ({
            playheadMs: Math.max(0, Math.min(event.timeMs, context.scene.durationMs)),
          })),
        },

        'PLAYHEAD.STOP': {
          actions: assign({ isPlaying: false, playheadMs: 0 }),
        },

        'PLAYHEAD.START_PLAY': {
          target: 'playing',
          actions: assign(({ context }) => ({
            isPlaying: true,
            playheadMs: context.playRange ? context.playRange.inMs : context.playheadMs,
          })),
        },

        'VIEWPORT.PAN_START': {
          target: 'panning',
          actions: assign(({ context, event }) => ({
            interaction: {
              kind: 'panning' as const,
              originPx: event.pointerPx,
              originStartMs: context.viewport.startMs,
            },
          })),
        },

        'VIEWPORT.RESIZE': {
          actions: assign(({ context, event }) => {
            const vp: MachineViewport = {
              ...context.viewport,
              viewWidthPx: event.widthPx,
              viewHeightPx: event.heightPx,
              endMs: context.viewport.startMs + event.widthPx / context.viewport.pixelsPerMs,
            }
            return { viewport: vp }
          }),
        },

        'VIEWPORT.SET_MODE': {
          actions: assign(({ context, event }) => {
            const viewMode = event.mode
            let viewport = context.viewport
            if (viewMode === 'full-sequence') {
              const raw = context.viewport.viewWidthPx / context.scene.durationMs
              const pixelsPerMs = (isFinite(raw) && raw > 0) ? raw : context.viewport.pixelsPerMs
              viewport = { ...viewport, pixelsPerMs, startMs: 0, endMs: context.scene.durationMs }
            }
            return { viewMode, viewport }
          }),
        },

        'VIEWPORT.SET_LAYOUT_PROFILE': {
          actions: assign(({ event }) => ({ layoutProfile: event.profile })),
        },

        'VIEWPORT.SET_DISPLAY_CONFIG': {
          actions: assign(({ event }) => ({ displayConfig: event.config })),
        },

        'TRACK.ADD': {
          actions: assign(({ context, event }) => {
            const newTrack: TrackNode = { ...event.node, keyframes: [] }
            let tracks: TrackNode[]
            if (event.afterId) {
              const idx = context.scene.tracks.findIndex(t => t.id === event.afterId)
              if (idx >= 0) {
                tracks = [...context.scene.tracks]
                tracks.splice(idx + 1, 0, newTrack)
              } else {
                tracks = [...context.scene.tracks, newTrack]
              }
            } else {
              tracks = [...context.scene.tracks, newTrack]
            }
            return { scene: { ...context.scene, tracks } }
          }),
        },

        'TRACK.REMOVE': {
          actions: assign(({ context, event }) => {
            function removeFromList(tracks: TrackNode[]): TrackNode[] {
              return tracks
                .filter(t => t.id !== event.trackId)
                .map(t => t.children ? { ...t, children: removeFromList(t.children) } : t)
            }
            const tracks = removeFromList(context.scene.tracks)
            const scene = { ...context.scene, tracks }
            const snapGrid = computeSnapGrid(scene)
            const virtualKeyframes = computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder)
            const selection: MachineSelection =
              context.selection.trackId === event.trackId
                ? { trackId: null, keyframeId: null, markerId: null }
                : context.selection
            return { scene, snapGrid, virtualKeyframes, selection }
          }),
        },

        'TRACK.TOGGLE_VISIBILITY': {
          actions: assign(({ context, event }) => ({
            scene: updateTrackInScene(context.scene, event.trackId, t => ({
              ...t, visible: !t.visible,
            })),
          })),
        },

        'TRACK.RESET_KEYFRAMES': {
          actions: assign(({ context, event }) => {
            const scene = updateTrackInScene(context.scene, event.trackId, t => ({
              ...t, keyframes: [],
            }))
            return { scene, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'CUE.ADD': {
          actions: assign(({ context, event }) => {
            const scene = { ...context.scene, cues: [...context.scene.cues, event.cue] }
            return { scene, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'CUE.REMOVE': {
          actions: assign(({ context, event }) => {
            const scene = { ...context.scene, cues: context.scene.cues.filter(c => c.id !== event.cueId) }
            return { scene, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'MARKER_TRACK.ADD': {
          actions: assign(({ context, event }) => {
            const scene = { ...context.scene, markerTracks: [...context.scene.markerTracks, event.track] }
            return { scene, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'MARKER_TRACK.REMOVE': {
          actions: assign(({ context, event }) => {
            const removedTrack = context.scene.markerTracks.find(t => t.id === event.markerTrackId)
            const removedMarkerIds = new Set(removedTrack?.markers.map(m => m.id) ?? [])
            const markerTracks = context.scene.markerTracks.filter(t => t.id !== event.markerTrackId)
            const tracks = detachKeyframesByMarkerIds(context.scene.tracks, removedMarkerIds)
            const scene = { ...context.scene, markerTracks, tracks }
            const selection: MachineSelection = context.selection.markerId !== null && removedMarkerIds.has(context.selection.markerId)
              ? { trackId: null, keyframeId: null, markerId: null }
              : context.selection
            return { scene, selection, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'MARKER_TRACK.RENAME': {
          actions: assign(({ context, event }) => {
            const markerTracks = context.scene.markerTracks.map(t =>
              t.id === event.markerTrackId ? { ...t, label: event.label } : t,
            )
            return { scene: { ...context.scene, markerTracks } }
          }),
        },

        'MARKER_TRACK.TOGGLE_VISIBILITY': {
          actions: assign(({ context, event }) => {
            const markerTracks = context.scene.markerTracks.map(t =>
              t.id === event.markerTrackId ? { ...t, visible: !t.visible } : t,
            )
            return { scene: { ...context.scene, markerTracks } }
          }),
        },

        'MARKER.ADD': {
          actions: assign(({ context, event }) => {
            const markerTracks = context.scene.markerTracks.map(t =>
              t.id === event.markerTrackId ? { ...t, markers: [...t.markers, event.marker] } : t,
            )
            const scene = { ...context.scene, markerTracks }
            return { scene, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'MARKER.MOVE': {
          actions: assign(({ context, event }) => {
            // propagate to attached keyframes
            function propagate(tracks: TrackNode[]): TrackNode[] {
              return tracks.map(t => ({
                ...t,
                keyframes: t.keyframes.map(k =>
                  k.markerId === event.markerId ? { ...k, timeMs: event.timeMs } : k,
                ),
                children: t.children ? propagate(t.children) : undefined,
              }))
            }
            const markerTracks = context.scene.markerTracks.map(mt => ({
              ...mt,
              markers: mt.markers.map(m => m.id === event.markerId ? { ...m, timeMs: event.timeMs } : m),
            }))
            const tracks = propagate(context.scene.tracks)
            const scene = { ...context.scene, markerTracks, tracks }
            return { scene, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'MARKER.REMOVE': {
          actions: assign(({ context, event }) => {
            const markerTracks = context.scene.markerTracks.map(mt => ({
              ...mt,
              markers: mt.markers.filter(m => m.id !== event.markerId),
            }))
            const tracks = detachKeyframesByMarkerIds(context.scene.tracks, new Set([event.markerId]))
            const scene = { ...context.scene, markerTracks, tracks }
            const selection: MachineSelection = context.selection.markerId === event.markerId
              ? { trackId: null, keyframeId: null, markerId: null }
              : context.selection
            return { scene, selection, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder) }
          }),
        },

        'KEYFRAME.ATTACH_MARKER': {
          actions: assign(({ context, event }) => ({
            scene: updateTrackInScene(context.scene, event.trackId, t => ({
              ...t,
              keyframes: t.keyframes.map(k =>
                k.id === event.keyframeId ? { ...k, markerId: event.markerId } : k,
              ),
            })),
          })),
        },

        'KEYFRAME.DETACH_MARKER': {
          actions: assign(({ context, event }) => ({
            scene: updateTrackInScene(context.scene, event.trackId, t => ({
              ...t,
              keyframes: t.keyframes.map(k =>
                k.id === event.keyframeId ? { ...k, markerId: undefined } : k,
              ),
            })),
          })),
        },

        'AUDIO.SET': {
          actions: assign(({ context, event }) => ({
            scene: { ...context.scene, audio: event.track },
          })),
        },

        'AUDIO.CLEAR': {
          actions: assign(({ context }) => ({
            scene: { ...context.scene, audio: undefined },
          })),
        },

        'AUDIO.SET_WAVEFORM': {
          actions: assign(({ context, event }) => {
            if (!context.scene.audio) return {}
            return {
              scene: {
                ...context.scene,
                audio: { ...context.scene.audio, waveform: event.waveform },
              },
            }
          }),
        },

        'SCENE.LOAD': {
          actions: assign(({ context, event }) => ({
            scene: event.scene,
            snapGrid: computeSnapGrid(event.scene),
            virtualKeyframes: computeVirtualKeyframes(event.scene, context.displayConfig.capsuleOrder),
            playheadMs: 0,
            selection: { trackId: null, keyframeId: null, markerId: null },
            interaction: null,
          })),
        },

        'SCENE.SET_DURATION': {
          actions: assign(({ context, event }) => ({
            scene: {
              ...context.scene,
              durationMs: event.durationMs,
              durationSource: event.source ?? context.scene.durationSource,
            },
          })),
        },
      },
    },

    // ── playing ─────────────────────────────────────────────────────────────
    playing: {
      on: {
        'PLAYHEAD.TICK': [
          {
            // End of play: transition to idle so START_PLAY becomes available again
            guard: ({ context, event }) => {
              const stopMs = context.playRange?.outMs ?? context.scene.durationMs
              return context.playheadMs + event.deltaMs >= stopMs
            },
            target: 'idle',
            actions: assign(({ context }) => ({
              isPlaying: false,
              playheadMs: context.playRange?.outMs ?? context.scene.durationMs,
            })),
          },
          {
            actions: assign(({ context, event }) => ({
              playheadMs: context.playheadMs + event.deltaMs,
            })),
          },
        ],
        'PLAYHEAD.PAUSE': {
          target: 'idle',
          actions: assign({ isPlaying: false }),
        },
        'PLAYHEAD.STOP': {
          target: 'idle',
          actions: assign({ isPlaying: false, playheadMs: 0 }),
        },
        'PLAYHEAD.SET': {
          actions: assign(({ context, event }) => ({
            playheadMs: Math.max(0, Math.min(event.timeMs, context.scene.durationMs)),
          })),
        },
      },
    },

    // ── panning ──────────────────────────────────────────────────────────────
    panning: {
      on: {
        'VIEWPORT.PAN_MOVE': {
          actions: assign(({ context, event }) => {
            const i = context.interaction
            if (!i || i.kind !== 'panning') return {}
            const deltaPx = event.pointerPx - i.originPx
            const deltaMs = deltaPx / context.viewport.pixelsPerMs
            const startMs = clampViewportStart(
              i.originStartMs - deltaMs,
              context.viewport,
              context.scene.durationMs,
            )
            const viewport: MachineViewport = {
              ...context.viewport,
              startMs,
              endMs: computeEndMs({ ...context.viewport, startMs }),
            }
            return { viewport }
          }),
        },
        'VIEWPORT.PAN_END': {
          target: 'idle',
          actions: assign({ interaction: null }),
        },
      },
    },

    // ── dragging-keyframe ────────────────────────────────────────────────────
    'dragging-keyframe': {
      on: {
        'DRAG.MOVE': {
          actions: assign(({ context, event }) => {
            const i = context.interaction
            if (!i || i.kind !== 'dragging-keyframe') return {}
            const thresholdMs = context.layoutProfile.snapThresholdPx / context.viewport.pixelsPerMs
            const snapped = applySnapToMs(event.pointerMs, context.snapGrid, thresholdMs)
            const currentMs = Math.max(0, Math.min(snapped, context.scene.durationMs))
            return { interaction: { ...i, currentMs } }
          }),
        },
        'DRAG.END': {
          target: 'idle',
          guard: 'canCommitDrag',
          actions: assign(({ context }) => {
            const i = context.interaction
            if (!i || i.kind !== 'dragging-keyframe') return { interaction: null }
            const timeMs = i.currentMs
            const scene = updateTrackInScene(context.scene, i.trackId, t => ({
              ...t,
              keyframes: t.keyframes
                .map(k => k.id === i.keyframeId ? { ...k, timeMs } : k)
                .sort((a, b) => a.timeMs - b.timeMs),
            }))
            return { scene, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder), interaction: null }
          }),
        },
      },
    },

    // ── drawing-clip ─────────────────────────────────────────────────────────
    'drawing-clip': {
      on: {
        'CLIP.DRAW_MOVE': {
          actions: assign(({ context, event }) => {
            const i = context.interaction
            if (!i || i.kind !== 'drawing-clip') return {}
            return { interaction: { ...i, currentMs: event.pointerMs } }
          }),
        },
        'CLIP.DRAW_END': {
          target: 'idle',
          actions: assign(({ context }) => {
            const i = context.interaction
            if (!i || i.kind !== 'drawing-clip') return { interaction: null }

            const rawMinMs = Math.min(i.startMs, i.currentMs)
            const rawMaxMs = Math.max(i.startMs, i.currentMs)

            const bounds = findParentClipBounds(i.trackId, context.scene.tracks, context.scene.durationMs)
            const minMs = Math.max(rawMinMs, bounds.minMs)
            const maxMs = Math.min(rawMaxMs, bounds.maxMs)

            if (minMs >= maxMs) return { interaction: null }

            const scene = updateTrackInScene(context.scene, i.trackId, track => {
              const kept = track.keyframes.filter(k => k.name !== 'intro' && k.name !== 'outro')
              const introKf: Keyframe = {
                id: i.introId || `kf-${Date.now()}`,
                timeMs: minMs,
                name: 'intro',
                decorId: null,
              }
              const outroKf: Keyframe = {
                id: i.outroId || `kf-${Date.now() + 1}`,
                timeMs: maxMs,
                name: 'outro',
                decorId: null,
              }
              const keyframes = [...kept, introKf, outroKf].sort((a, b) => a.timeMs - b.timeMs)
              return { ...track, keyframes }
            })

            return { scene, snapGrid: computeSnapGrid(scene), virtualKeyframes: computeVirtualKeyframes(scene, context.displayConfig.capsuleOrder), interaction: null }
          }),
        },
      },
    },

  },
})
