import { setup, assign, emit } from 'xstate'
import type {
  EditorScene, Keyframe, LayoutProfile, DisplayConfig, Waveform, Transition, Marker,
} from './types'
import type { Command } from '../app/controller/types'
import { CapsuleDistribution, CapsulePreset, TransitionTiming } from '@codplay/scene-factory'
import type { ChildInput } from '@codplay/scene-factory'
import {
  ZOOM_DEFAULT_PX_PER_SEC, ZOOM_MIN_PX_PER_SEC, ZOOM_MAX_PX_PER_SEC,
  TIME_STEP_MS,
} from './constants'
import { LAYOUT_PROFILE_DEFAULT } from './layout-profile'
import { DISPLAY_CONFIG_DEFAULT } from './display-config'
import { childrenOf, findParentClipBounds } from './utils'

/**
 * §"unicité de la source" (`2026-07-13-controller-islands-bridge-plan.md` §3bis, tranché
 * 2026-07-13) — cette machine NE POSSÈDE PLUS `scene`/`selection` : ce sont des projections en
 * lecture seule, écrites UNIQUEMENT par `SCENE.SYNC`/`SCENE.LOAD` (l'écho du contrôleur central).
 * Aucun handler de geste utilisateur n'assigne plus `scene`/`selection` directement — chacun
 * calcule ce qui a changé et l'ÉMET (`emit`, XState v5) comme commande(s) vers l'extérieur ;
 * `SequenceEditorController.onCommand`/`onSelectionRequest` relaient vers le contrôleur central,
 * qui reste l'unique possesseur qui écrit réellement le document.
 *
 * Un seul écrivain par champ = pas de double possession, pas de risque d'écho/boucle à filtrer
 * (l'ancien mécanisme de filtre par timestamp, `lastMutation`, est retiré : plus nécessaire, plus
 * de deuxième écrivain à distinguer).
 *
 * Champs restés PUREMENT locaux (jamais synchronisés, jamais émis) : `viewport`, `playheadMs`,
 * `playRange`, `followPlayhead`, `interaction`, `layoutProfile`, `displayConfig`, `viewMode` —
 * l'éphémère des gestes, qui n'a jamais été le problème. `isPlaying` a existé ici (drapeau local
 * piloté par une simulation de lecture propre à ce module) puis a été retiré
 * (`2026-07-17-telco-real-transport-plan.md` §Étape C) : le statut de lecture réel vit désormais
 * dans `TelcoApi` (`codplay`), jamais dupliqué ici — `playheadMs` reste, mais reçu depuis `telco`
 * (`TELCO.SYNC_PLAYHEAD`), jamais accumulé localement par un tick.
 *
 * `selection.markerId` fait exception : les marqueurs n'ont pas d'équivalent dans le modèle
 * `Selection` central (`{itemIds, keyframeId}` — pas de notion de marqueur sélectionné), donc
 * `MARKER.SELECT` reste une assignation locale directe, jamais émise. `SCENE.SYNC` l'efface tout
 * de même (toute synchronisation autoritaire prime sur une sélection de marqueur locale).
 */

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
  /** Projection en lecture seule — voir note d'en-tête. Écrit uniquement par SCENE.SYNC/SCENE.LOAD. */
  scene: EditorScene
  viewport: MachineViewport
  playheadMs: number
  playRange: PlayRange | null
  followPlayhead: boolean
  /** trackId/keyframeId : projection en lecture seule (idem `scene`). markerId : possédé localement. */
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

/** Écho du contrôleur central — la forme de `Selection` centrale (`app/controller/types.ts`), pas la forme locale. */
export type CentralSelectionEcho = { itemIds: string[]; keyframeId?: string }

// ─── Emitted events (vers l'extérieur — XState v5 `emit`) ───────────────────

export type SequenceEditorEmitted =
  | { type: 'commandBatch'; commands: Command[] }
  | { type: 'selectionRequested'; itemIds: string[]; keyframeId?: string }

// ─── Events (§3.4) ──────────────────────────────────────────────────────────

export type SequenceEditorEvent =
  | { type: 'TRACK.SELECT'; trackId: string | null }
  | { type: 'KEYFRAME.SELECT'; trackId: string; keyframeId: string | null }
  | { type: 'MARKER.SELECT'; markerId: string | null }
  | { type: 'KEYFRAME.ADD'; trackId: string; timeMs: number; id?: string; decorId?: string }
  | { type: 'KEYFRAME.REMOVE'; trackId: string; keyframeId: string }
  | { type: 'KEYFRAME.CLEAR_TRACK'; trackId: string }
  | { type: 'KEYFRAME.CLEAR_CAPSULE'; trackId: string }
  | { type: 'KEYFRAME.RENAME'; trackId: string; keyframeId: string; name: string | null }
  | { type: 'KEYFRAME.ASSIGN_DECOR'; trackId: string; keyframeId: string; decorId: string }
  | { type: 'KEYFRAME.SET_TRANSITION_IN'; trackId: string; keyframeId: string; def: Transition | null }
  | { type: 'KEYFRAME.SET_TRANSITION_OUT'; trackId: string; keyframeId: string; def: Transition | null }
  | { type: 'DRAG.START_KEYFRAME'; trackId: string; keyframeId: string }
  | { type: 'DRAG.MOVE'; pointerMs: number }
  | { type: 'DRAG.END' }
  | { type: 'CLIP.PLACE'; trackId: string; pointerMs: number }
  | { type: 'CLIP.START_DRAW'; trackId: string; pointerMs: number; introId: string; outroId: string }
  | { type: 'CLIP.DRAW_MOVE'; pointerMs: number }
  | { type: 'CLIP.DRAW_END' }
  | { type: 'PLAYHEAD.SET'; timeMs: number }
  /** Miroir du statut réel de lecture (`TelcoApi.onProgress`/`.onChange`, `attachTelco` dans `mount.ts`)
   * — jamais un tick local, jamais d'accumulation ; `timelineMs` vient toujours de `telco`. */
  | { type: 'TELCO.SYNC_PLAYHEAD'; timelineMs: number }
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
  | { type: 'TRACK.MOVE'; trackId: string; parentId: string | null; order?: string }
  | { type: 'TRACK.REMOVE'; trackId: string }
  | { type: 'TRACK.TOGGLE_VISIBILITY'; trackId: string }
  | { type: 'TRACK.RESET_KEYFRAMES'; trackId: string }
  | { type: 'MARKER_TRACK.ADD'; markerTrackId: string; label: string; color?: string }
  | { type: 'MARKER_TRACK.REMOVE'; markerTrackId: string }
  | { type: 'MARKER_TRACK.RENAME'; markerTrackId: string; label: string }
  | { type: 'MARKER_TRACK.TOGGLE_VISIBILITY'; markerTrackId: string }
  | { type: 'MARKER.ADD'; markerTrackId: string; marker: Marker }
  | { type: 'MARKER.MOVE'; markerId: string; timeMs: number }
  | { type: 'MARKER.REMOVE'; markerId: string }
  | { type: 'KEYFRAME.ATTACH_MARKER'; trackId: string; keyframeId: string; markerId: string }
  | { type: 'KEYFRAME.DETACH_MARKER'; trackId: string; keyframeId: string }
  | { type: 'AUDIO.SET_WAVEFORM'; waveform: Waveform }
  | { type: 'SCENE.SYNC'; scene: EditorScene; selection: CentralSelectionEcho }
  | { type: 'SCENE.LOAD'; scene: EditorScene }
  | { type: 'SCENE.SET_DURATION'; durationMs: number; source?: EditorScene['meta']['durationSource'] }

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

/** Toutes les cues de tous les contents média de la scène (document-model §"Le son master" : les cues vivent dans `Content`, par source). */
function allCues(scene: EditorScene): { timeMs: number; id: string }[] {
  return Object.values(scene.contents).flatMap((content) => content.cues ?? [])
}

function computeSnapGrid(scene: EditorScene): MachineSnapPoint[] {
  const points: MachineSnapPoint[] = []
  for (const cue of allCues(scene)) {
    points.push({ timeMs: cue.timeMs, kind: 'cue-start', sourceId: cue.id })
  }
  for (const track of Object.values(scene.markerTracks)) {
    for (const marker of track.markers) {
      points.push({ timeMs: marker.timeMs, kind: 'marker', sourceId: marker.id })
    }
  }
  for (const item of scene.items) {
    for (const kf of item.keyframes) {
      points.push({ timeMs: kf.timeMs, kind: 'keyframe', sourceId: kf.id })
    }
  }
  return points.sort((a, b) => a.timeMs - b.timeMs)
}

function computeVirtualKeyframes(scene: EditorScene, capsuleOrder: 'forward' | 'backward' = 'forward'): VirtualKeyframe[] {
  const result: VirtualKeyframe[] = []
  for (const capsule of scene.items) {
    if (capsule.type !== 'capsule') continue
    const children = childrenOf(scene.items, capsule.id)
    if (children.length === 0) continue
    const introKf = capsule.keyframes.find((k) => k.name === 'intro')
    const outroKf = capsule.keyframes.find((k) => k.name === 'outro')
    if (!introKf || !outroKf) continue
    const clipDurationMs = outroKf.timeMs - introKf.timeMs
    if (clipDurationMs <= 0) continue
    if (!capsule.capsule) continue

    // Même formule que `build-scene.ts`'s `resolveCapsule()` (`TransitionTiming`, `@codplay/
    // scene-factory`) — sans `preRollMs` (concept Builder/player, invisible ici par conception,
    // l'éditeur reste dans son propre référentiel temporel local). Sans cet appel partagé, cet
    // aperçu divergeait de la construction réelle : il ignorait `transitionIn.durationMs`.
    const childInputs: ChildInput[] = children.map((child) => {
      const ci = child.keyframes.find((k) => k.name === 'intro')
      const co = child.keyframes.find((k) => k.name === 'outro')
      return {
        trackId: child.id,
        lockedIntroMs: TransitionTiming.lockedIntroMs(
          ci !== undefined ? { timeMs: ci.timeMs - introKf.timeMs, transitionInDurationMs: ci.transitionIn?.durationMs } : undefined,
        ),
        lockedOutroMs: TransitionTiming.lockedOutroMs(co !== undefined ? { timeMs: co.timeMs - introKf.timeMs } : undefined),
      }
    })

    let preset: ReturnType<typeof CapsulePreset.resolve>
    try {
      preset = CapsulePreset.resolve({ capsuleType: capsule.capsule.kind, distribution: capsule.capsule.distribution })
    } catch {
      continue
    }
    const out = CapsuleDistribution.compute({
      clipDurationMs,
      ...preset,
      order: capsuleOrder,
      children: childInputs,
    })

    for (let i = 0; i < out.children.length; i++) {
      const childOut = out.children[i]!
      const child = children[i]!
      const hasIntro = child.keyframes.some((k) => k.name === 'intro')
      const hasOutro = child.keyframes.some((k) => k.name === 'outro')
      if (!hasIntro) {
        result.push({ trackId: child.id, id: `vkf-${child.id}-intro`, timeMs: introKf.timeMs + childOut.introMs, name: 'intro', visible: childOut.visible })
      }
      if (!hasOutro) {
        result.push({ trackId: child.id, id: `vkf-${child.id}-outro`, timeMs: introKf.timeMs + childOut.outroMs, name: 'outro', visible: childOut.visible })
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

export function applySnapToMs(rawMs: number, snapGrid: MachineSnapPoint[], thresholdMs: number): number {
  const nearest = findNearestSnap(snapGrid, rawMs)
  if (nearest && Math.abs(nearest.timeMs - rawMs) <= thresholdMs) return nearest.timeMs
  return Math.round(rawMs / TIME_STEP_MS) * TIME_STEP_MS
}

/** Choisit le décor adjacent au point d'insertion (lecture seule sur la projection locale — jamais une écriture). */
function adjacentDecorId(keyframes: Keyframe[], timeMs: number): string | undefined {
  const sorted = [...keyframes].sort((a, b) => a.timeMs - b.timeMs)
  let prev: Keyframe | null = null
  for (const k of sorted) {
    if (k.timeMs <= timeMs) prev = k
    else break
  }
  return prev?.decorId ?? sorted[0]?.decorId
}

function freshId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Machine ─────────────────────────────────────────────────────────────────

export const sequenceEditorMachine = setup({
  types: {} as {
    context: MachineContext
    events: SequenceEditorEvent
    input: MachineInput
    emitted: SequenceEditorEmitted
  },

  guards: {
    canCommitDrag: ({ context }) => {
      const i = context.interaction
      if (!i || i.kind !== 'dragging-keyframe') return false
      return i.currentMs >= 0 && i.currentMs <= context.scene.meta.durationMs
    },
  },

}).createMachine({
  id: 'sequence-editor',
  initial: 'idle',

  on: {
    'PLAYRANGE.SET': {
      actions: assign(({ event }) => ({ playRange: { inMs: event.inMs, outMs: event.outMs } })),
    },
    'PLAYRANGE.CLEAR': {
      actions: assign(() => ({ playRange: null as PlayRange | null })),
    },
    'FOLLOW.TOGGLE': {
      actions: assign(({ context }) => ({ followPlayhead: !context.followPlayhead })),
    },
    // Miroir telco — valide quel que soit le mode de geste courant (un pan/drag en cours ne doit
    // pas bloquer la synchronisation du curseur avec la lecture réelle).
    'TELCO.SYNC_PLAYHEAD': {
      actions: assign(({ event }) => ({ playheadMs: event.timelineMs })),
    },
    'VIEWPORT.SCROLL': {
      actions: assign(({ context, event }) => {
        const startMs = clampViewportStart(event.startMs, context.viewport, context.scene.meta.durationMs)
        return { viewport: { ...context.viewport, startMs, endMs: computeEndMs({ ...context.viewport, startMs }) } }
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
        return { viewport: { ...context.viewport, pixelsPerMs: newPxPerMs, startMs: newStartMs, endMs: newStartMs + viewWidthPx / newPxPerMs } }
      }),
    },

    // ── Synchronisation autoritaire — seul point d'écriture de scene/selection ──────────────
    'SCENE.SYNC': {
      actions: assign(({ context, event }) => ({
        scene: event.scene,
        snapGrid: computeSnapGrid(event.scene),
        virtualKeyframes: computeVirtualKeyframes(event.scene, context.displayConfig.capsuleOrder),
        selection: {
          trackId: event.selection.itemIds[0] ?? null,
          keyframeId: event.selection.keyframeId ?? null,
          markerId: null,
        },
        // playheadMs, playRange, followPlayhead, interaction, viewport : jamais touchés — c'est tout
        // l'objet de la distinction avec SCENE.LOAD (§ note d'en-tête).
      })),
    },
    // ── Chargement d'un NOUVEAU document — réinitialise tout, y compris playhead/sélection/geste.
    // Réservé au vrai changement de scène (sélecteur multi-scènes, étape 5) — jamais appelé dans
    // la boucle de commit. Voir note d'en-tête.
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
  },

  context: ({ input }) => {
    const viewWidthPx = input.viewWidthPx ?? 800
    const viewHeightPx = input.viewHeightPx ?? 600
    const pixelsPerMs = DEFAULT_PX_PER_MS
    return {
      scene: input.scene,
      viewport: { startMs: 0, endMs: viewWidthPx / pixelsPerMs, pixelsPerMs, viewWidthPx, viewHeightPx },
      playheadMs: 0,
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
    idle: {
      on: {
        // ── Sélection — TRACK/KEYFRAME émettent vers le centre (Selection y a un slot) ;
        // MARKER reste local (pas de notion de marqueur sélectionné côté central), mais efface la
        // sélection centrale par une VRAIE émission (jamais en écrivant trackId/keyframeId
        // localement — ces deux champs n'ont qu'un seul écrivain légitime : l'écho du centre.
        // Écrire `null` localement sans émettre laisserait la timeline afficher "rien sélectionné"
        // pendant que le centre/dedit pensent encore qu'un item l'est — un vrai risque
        // d'incohérence visuelle, pas juste une question de pureté). `markerId` lui-même reste un
        // assign local direct : c'est le seul champ dont cette machine est l'unique écrivain. ────
        'TRACK.SELECT': {
          actions: [
            emit(({ event }) => ({ type: 'selectionRequested' as const, itemIds: event.trackId ? [event.trackId] : [] })),
            assign(({ context }) => ({ selection: { ...context.selection, markerId: null } })),
          ],
        },
        'KEYFRAME.SELECT': {
          actions: [
            emit(({ event }) => ({ type: 'selectionRequested' as const, itemIds: [event.trackId], keyframeId: event.keyframeId ?? undefined })),
            // Sélectionner un kf amène aussi la tête de lecture à son `timeMs` — même logique que
            // pour éditer le décor : il faut voir l'item dans son aspect au moment où il est fixé,
            // pas dans un état de lecture arbitraire. `playheadMs` est purement local (jamais émis
            // ici en tant que tel) mais la boucle de rendu de `mount.ts` détecte tout changement de
            // `ctx.playheadMs` et déclenche `onPlayheadChange` → le pont `seek` existant s'en charge.
            assign(({ context, event }) => {
              const kf = event.keyframeId
                ? context.scene.items.find((i) => i.id === event.trackId)?.keyframes.find((k) => k.id === event.keyframeId)
                : undefined
              return {
                selection: { ...context.selection, markerId: null },
                playheadMs: kf ? Math.max(0, Math.min(kf.timeMs, context.scene.meta.durationMs)) : context.playheadMs,
              }
            }),
          ],
        },
        'MARKER.SELECT': {
          actions: [
            emit(() => ({ type: 'selectionRequested' as const, itemIds: [] })),
            assign(({ context, event }) => ({ selection: { ...context.selection, markerId: event.markerId } })),
          ],
        },

        'KEYFRAME.ADD': {
          actions: emit(({ context, event }) => {
            const timeMs = Math.round(Math.max(0, Math.min(event.timeMs, context.scene.meta.durationMs)) / TIME_STEP_MS) * TIME_STEP_MS
            const item = context.scene.items.find((i) => i.id === event.trackId)
            const decorId = event.decorId ?? (item ? adjacentDecorId(item.keyframes, timeMs) : undefined)
            return {
              type: 'commandBatch' as const,
              commands: [{ name: 'createNamedKeyframe', args: { itemId: event.trackId, keyframeId: event.id ?? freshId('kf'), timeMs, decorId } }],
            }
          }),
        },

        'KEYFRAME.REMOVE': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'deleteKeyframe', args: { itemId: event.trackId, keyframeId: event.keyframeId } }],
          })),
        },

        'KEYFRAME.CLEAR_TRACK': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'clearItemKeyframes', args: { itemId: event.trackId } }],
          })),
        },

        'KEYFRAME.CLEAR_CAPSULE': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'clearCapsuleKeyframes', args: { itemId: event.trackId } }],
          })),
        },

        'KEYFRAME.RENAME': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'renameKeyframe', args: { itemId: event.trackId, keyframeId: event.keyframeId, name: event.name } }],
          })),
        },

        'KEYFRAME.ASSIGN_DECOR': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'assignKeyframeDecor', args: { itemId: event.trackId, keyframeId: event.keyframeId, decorId: event.decorId } }],
          })),
        },

        'KEYFRAME.SET_TRANSITION_IN': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'setKeyframeTransitionIn', args: { itemId: event.trackId, keyframeId: event.keyframeId, transition: event.def } }],
          })),
        },

        'KEYFRAME.SET_TRANSITION_OUT': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'setKeyframeTransitionOut', args: { itemId: event.trackId, keyframeId: event.keyframeId, transition: event.def } }],
          })),
        },

        'DRAG.START_KEYFRAME': {
          target: 'dragging-keyframe',
          actions: [
            // Le vrai chemin de sélection au clic (`track-row.ts` route toujours ici via
            // `onDragStart`, jamais vers `KEYFRAME.SELECT` — un clic simple ET un drag démarrent
            // tous les deux par un pointerdown). La tête de lecture suit le kf sélectionné : même
            // logique que pour éditer le décor, il faut voir l'item dans son aspect au moment où
            // il est fixé, pas dans un état de lecture arbitraire.
            assign(({ context, event }) => {
              const item = context.scene.items.find((i) => i.id === event.trackId)
              const kf = item?.keyframes.find((k) => k.id === event.keyframeId)
              return {
                interaction: {
                  kind: 'dragging-keyframe' as const,
                  trackId: event.trackId,
                  keyframeId: event.keyframeId,
                  originMs: kf?.timeMs ?? 0,
                  currentMs: kf?.timeMs ?? 0,
                },
                selection: { ...context.selection, markerId: null },
                playheadMs: kf ? Math.max(0, Math.min(kf.timeMs, context.scene.meta.durationMs)) : context.playheadMs,
              }
            }),
            emit(({ event }) => ({ type: 'selectionRequested' as const, itemIds: [event.trackId], keyframeId: event.keyframeId })),
          ],
        },

        'CLIP.PLACE': {
          actions: emit(({ context, event }) => {
            const pointerMs = Math.max(0, Math.min(event.pointerMs, context.scene.meta.durationMs))
            const bounds = findParentClipBounds(event.trackId, context.scene.items, context.scene.meta.durationMs)
            const clampedMs = Math.max(bounds.minMs, Math.min(bounds.maxMs, pointerMs))
            const item = context.scene.items.find((i) => i.id === event.trackId)
            const intro = item?.keyframes.find((k) => k.name === 'intro')
            const outro = item?.keyframes.find((k) => k.name === 'outro')

            let commands: Command[]
            if (!intro) {
              commands = [{ name: 'createNamedKeyframe', args: { itemId: event.trackId, keyframeId: freshId('kf'), timeMs: clampedMs, name: 'intro' } }]
            } else if (!outro) {
              commands = [{ name: 'createNamedKeyframe', args: { itemId: event.trackId, keyframeId: freshId('kf'), timeMs: clampedMs, name: 'outro' } }]
            } else {
              const moveId = Math.abs(clampedMs - intro.timeMs) <= Math.abs(clampedMs - outro.timeMs) ? intro.id : outro.id
              commands = [{ name: 'moveKeyframe', args: { itemId: event.trackId, keyframeId: moveId, timeMs: clampedMs } }]
            }
            return { type: 'commandBatch' as const, commands }
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
          actions: assign(({ context, event }) => ({ playheadMs: Math.max(0, Math.min(event.timeMs, context.scene.meta.durationMs)) })),
        },

        'VIEWPORT.PAN_START': {
          target: 'panning',
          actions: assign(({ context, event }) => ({
            interaction: { kind: 'panning' as const, originPx: event.pointerPx, originStartMs: context.viewport.startMs },
          })),
        },
        'VIEWPORT.RESIZE': {
          actions: assign(({ context, event }) => ({
            viewport: {
              ...context.viewport,
              viewWidthPx: event.widthPx,
              viewHeightPx: event.heightPx,
              endMs: context.viewport.startMs + event.widthPx / context.viewport.pixelsPerMs,
            },
          })),
        },
        'VIEWPORT.SET_MODE': {
          actions: assign(({ context, event }) => {
            const viewMode = event.mode
            let viewport = context.viewport
            if (viewMode === 'full-sequence') {
              const raw = context.viewport.viewWidthPx / context.scene.meta.durationMs
              const pixelsPerMs = (isFinite(raw) && raw > 0) ? raw : context.viewport.pixelsPerMs
              viewport = { ...viewport, pixelsPerMs, startMs: 0, endMs: context.scene.meta.durationMs }
            }
            return { viewMode, viewport }
          }),
        },
        'VIEWPORT.SET_LAYOUT_PROFILE': { actions: assign(({ event }) => ({ layoutProfile: event.profile })) },
        'VIEWPORT.SET_DISPLAY_CONFIG': { actions: assign(({ event }) => ({ displayConfig: event.config })) },

        // ── Track (item) — structure du document, commandes CENTRALES réutilisées telles quelles ──
        'TRACK.MOVE': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'attachItem', args: { itemId: event.trackId, parentId: event.parentId, order: event.order } }],
          })),
        },
        'TRACK.REMOVE': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'deleteItem', args: { itemId: event.trackId } }],
          })),
        },
        'TRACK.TOGGLE_VISIBILITY': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'toggleItemVisibility', args: { itemId: event.trackId } }],
          })),
        },
        'TRACK.RESET_KEYFRAMES': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'clearItemKeyframes', args: { itemId: event.trackId } }],
          })),
        },

        'MARKER_TRACK.ADD': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'addMarkerTrack', args: { markerTrackId: event.markerTrackId, label: event.label, color: event.color } }],
          })),
        },
        'MARKER_TRACK.REMOVE': {
          // `selection.markerId` est purement local (jamais synchronisé depuis le centre, §"MARKER.SELECT
          // reste local" en tête de fichier) — l'effacer ici s'il appartenait à la piste retirée ne viole
          // pas "unicité de la source" (rien à réconcilier avec un écho), contrairement à trackId/keyframeId.
          actions: [
            emit(({ event }) => ({
              type: 'commandBatch' as const,
              commands: [{ name: 'removeMarkerTrack', args: { markerTrackId: event.markerTrackId } }],
            })),
            assign(({ context, event }) => {
              const removedIds = new Set(context.scene.markerTracks[event.markerTrackId]?.markers.map((m) => m.id) ?? [])
              if (context.selection.markerId === null || !removedIds.has(context.selection.markerId)) return {}
              return { selection: { ...context.selection, markerId: null } }
            }),
          ],
        },
        'MARKER_TRACK.RENAME': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'renameMarkerTrack', args: { markerTrackId: event.markerTrackId, label: event.label } }],
          })),
        },
        'MARKER_TRACK.TOGGLE_VISIBILITY': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'toggleMarkerTrackVisibility', args: { markerTrackId: event.markerTrackId } }],
          })),
        },

        'MARKER.ADD': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'addMarker', args: { markerTrackId: event.markerTrackId, marker: event.marker } }],
          })),
        },
        'MARKER.MOVE': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'moveMarker', args: { markerId: event.markerId, timeMs: event.timeMs } }],
          })),
        },
        'MARKER.REMOVE': {
          actions: [
            emit(({ event }) => ({
              type: 'commandBatch' as const,
              commands: [{ name: 'removeMarker', args: { markerId: event.markerId } }],
            })),
            assign(({ context, event }) =>
              context.selection.markerId === event.markerId ? { selection: { ...context.selection, markerId: null } } : {},
            ),
          ],
        },

        'KEYFRAME.ATTACH_MARKER': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'attachMarkerToKeyframe', args: { itemId: event.trackId, keyframeId: event.keyframeId, markerId: event.markerId } }],
          })),
        },
        'KEYFRAME.DETACH_MARKER': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'detachMarkerFromKeyframe', args: { itemId: event.trackId, keyframeId: event.keyframeId } }],
          })),
        },

        'AUDIO.SET_WAVEFORM': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'setMasterWaveform', args: { waveform: event.waveform } }],
          })),
        },

        'SCENE.SET_DURATION': {
          actions: emit(({ event }) => ({
            type: 'commandBatch' as const,
            commands: [{ name: 'setSceneDuration', args: { durationMs: event.durationMs, source: event.source } }],
          })),
        },
      },
    },

    panning: {
      on: {
        'VIEWPORT.PAN_MOVE': {
          actions: assign(({ context, event }) => {
            const i = context.interaction
            if (!i || i.kind !== 'panning') return {}
            const deltaPx = event.pointerPx - i.originPx
            const deltaMs = deltaPx / context.viewport.pixelsPerMs
            const startMs = clampViewportStart(i.originStartMs - deltaMs, context.viewport, context.scene.meta.durationMs)
            return { viewport: { ...context.viewport, startMs, endMs: computeEndMs({ ...context.viewport, startMs }) } }
          }),
        },
        'VIEWPORT.PAN_END': { target: 'idle', actions: assign({ interaction: null }) },
      },
    },

    'dragging-keyframe': {
      on: {
        'DRAG.MOVE': {
          actions: assign(({ context, event }) => {
            const i = context.interaction
            if (!i || i.kind !== 'dragging-keyframe') return {}
            const thresholdMs = context.layoutProfile.snapThresholdPx / context.viewport.pixelsPerMs
            const snapped = applySnapToMs(event.pointerMs, context.snapGrid, thresholdMs)
            const currentMs = Math.max(0, Math.min(snapped, context.scene.meta.durationMs))
            return { interaction: { ...i, currentMs } }
          }),
        },
        'DRAG.END': {
          target: 'idle',
          guard: 'canCommitDrag',
          actions: [
            emit(({ context }) => {
              const i = context.interaction
              if (!i || i.kind !== 'dragging-keyframe') return { type: 'commandBatch' as const, commands: [] }
              return {
                type: 'commandBatch' as const,
                commands: [{ name: 'moveKeyframe', args: { itemId: i.trackId, keyframeId: i.keyframeId, timeMs: i.currentMs } }],
              }
            }),
            assign({ interaction: null }),
          ],
        },
      },
    },

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
          actions: [
            emit(({ context }) => {
              const i = context.interaction
              if (!i || i.kind !== 'drawing-clip') return { type: 'commandBatch' as const, commands: [] }

              const rawMinMs = Math.min(i.startMs, i.currentMs)
              const rawMaxMs = Math.max(i.startMs, i.currentMs)
              const bounds = findParentClipBounds(i.trackId, context.scene.items, context.scene.meta.durationMs)
              const minMs = Math.max(rawMinMs, bounds.minMs)
              const maxMs = Math.min(rawMaxMs, bounds.maxMs)
              if (minMs >= maxMs) return { type: 'commandBatch' as const, commands: [] }

              const item = context.scene.items.find((it) => it.id === i.trackId)
              const existingIntro = item?.keyframes.find((k) => k.name === 'intro')
              const existingOutro = item?.keyframes.find((k) => k.name === 'outro')

              // Remplace tout intro/outro existant — DEUX commandes explicites (delete puis create),
              // pas un filtre implicite sur un tableau local comme avant : `deleteKeyframe` purge
              // aussi le décor orphelin (l'ancien code ne le faisait pas — fuite corrigée ici).
              const commands: Command[] = []
              if (existingIntro) commands.push({ name: 'deleteKeyframe', args: { itemId: i.trackId, keyframeId: existingIntro.id } })
              if (existingOutro) commands.push({ name: 'deleteKeyframe', args: { itemId: i.trackId, keyframeId: existingOutro.id } })
              commands.push({ name: 'createNamedKeyframe', args: { itemId: i.trackId, keyframeId: i.introId || freshId('kf'), timeMs: minMs, name: 'intro' } })
              commands.push({ name: 'createNamedKeyframe', args: { itemId: i.trackId, keyframeId: i.outroId || freshId('kf'), timeMs: maxMs, name: 'outro' } })
              return { type: 'commandBatch' as const, commands }
            }),
            assign({ interaction: null }),
          ],
        },
      },
    },
  },
})
