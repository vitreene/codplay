import { createActor } from 'xstate'
import {
  sequenceEditorMachine,
  type MachineContext,
  type MachineViewport,
  type MachineSelection,
  type PlayRange,
} from './machine'
import type {
  EditorScene, TrackNode, TextCue,
  AudioTrack, WaveformDataV1, TransitionDef, LayoutProfile, DisplayConfig,
} from './types'
import { applySnapToMs } from './machine'
import { flattenTracks } from './utils'

// ─── Public snapshot type ────────────────────────────────────────────────────

export type SequenceEditorSnapshot = {
  context: MachineContext
  value: string
}

// ─── ID generator ────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`
}

// ─── Default empty scene ─────────────────────────────────────────────────────

function emptyScene(): EditorScene {
  return {
    id: genId('scene'),
    title: 'Untitled',
    durationMs: 10000,
    durationSource: 'arbitrary',
    tracks: [],
    decors: {},
    cues: [],
    markers: [],
  }
}

// ─── Controller ──────────────────────────────────────────────────────────────

export class SequenceEditorController {
  private actor: ReturnType<typeof createActor<typeof sequenceEditorMachine>>

  constructor(initialScene?: EditorScene) {
    const scene = initialScene ?? emptyScene()
    this.actor = createActor(sequenceEditorMachine, { input: { scene } })
    this.actor.start()
  }

  destroy(): void {
    this.actor.stop()
  }

  // ── Subscription ────────────────────────────────────────────────────────────

  subscribe(callback: (snapshot: SequenceEditorSnapshot) => void): () => void {
    callback(this.getSnapshot())
    const sub = this.actor.subscribe(s => {
      callback({ context: s.context, value: String(s.value) })
    })
    return () => sub.unsubscribe()
  }

  getSnapshot(): SequenceEditorSnapshot {
    const s = this.actor.getSnapshot()
    return { context: s.context, value: String(s.value) }
  }

  // ── Context accessors ───────────────────────────────────────────────────────

  getScene(): EditorScene        { return this.actor.getSnapshot().context.scene }
  getViewport(): MachineViewport { return this.actor.getSnapshot().context.viewport }
  getPlayheadMs(): number        { return this.actor.getSnapshot().context.playheadMs }
  getSelection(): MachineSelection { return this.actor.getSnapshot().context.selection }

  private send(event: Parameters<typeof this.actor.send>[0]): void {
    this.actor.send(event)
  }

  // ── Viewport ────────────────────────────────────────────────────────────────

  zoom(factor: number, focusPx?: number): void {
    const vp = this.getViewport()
    const ppm = vp.pixelsPerMs > 0 ? vp.pixelsPerMs : 0.001
    const focusMs = focusPx !== undefined
      ? vp.startMs + focusPx / ppm
      : vp.startMs + vp.viewWidthPx / (2 * ppm)
    this.send({ type: 'VIEWPORT.ZOOM', factor, focusMs })
  }

  /**
   * Fixe le zoom à une valeur absolue (px/s) en ancrant sur le bord gauche du
   * viewport (`focusPx = 0`). À utiliser pour les sliders — évite la dérive
   * du `startMs` quand le centre calculé dépasse la durée de la scène.
   */
  setZoom(pxPerSec: number): void {
    const currentPxPerSec = this.getViewport().pixelsPerMs * 1000
    if (Math.abs(currentPxPerSec - pxPerSec) < 0.01) return
    this.zoom(pxPerSec / currentPxPerSec, 0)
  }

  /** Positionne le viewport sur un startMs absolu — utilisé par la scrollbar. */
  scrollToMs(startMs: number): void {
    this.send({ type: 'VIEWPORT.SCROLL', startMs })
  }

  /** Démarre un pan pointer-driven. pointerPx = clientX au moment du pointerdown. */
  panStart(pointerPx: number): void {
    this.send({ type: 'VIEWPORT.PAN_START', pointerPx })
  }

  /** Continue le pan. pointerPx = clientX courant. */
  panMove(pointerPx: number): void {
    this.send({ type: 'VIEWPORT.PAN_MOVE', pointerPx })
  }

  /** Termine le pan. */
  panEnd(): void {
    this.send({ type: 'VIEWPORT.PAN_END' })
  }

  /** deltaPx > 0 → avance dans le temps (scroll vers la droite) */
  pan(deltaPx: number): void {
    this.send({ type: 'VIEWPORT.PAN_START', pointerPx: 0 })
    this.send({ type: 'VIEWPORT.PAN_MOVE', pointerPx: -deltaPx })
    this.send({ type: 'VIEWPORT.PAN_END' })
  }

  setViewMode(mode: 'full-sequence' | 'text-priority'): void {
    this.send({ type: 'VIEWPORT.SET_MODE', mode })
  }

  notifyResize(widthPx: number, heightPx: number): void {
    this.send({ type: 'VIEWPORT.RESIZE', widthPx, heightPx })
  }

  setLayoutProfile(profile: LayoutProfile): void {
    this.send({ type: 'VIEWPORT.SET_LAYOUT_PROFILE', profile })
  }

  setDisplayConfig(config: Partial<DisplayConfig>): void {
    const current = this.actor.getSnapshot().context.displayConfig
    this.send({ type: 'VIEWPORT.SET_DISPLAY_CONFIG', config: { ...current, ...config } })
  }

  // ── Playhead ────────────────────────────────────────────────────────────────

  play(): void  { this.send({ type: 'PLAYHEAD.START_PLAY' }) }
  pause(): void { this.send({ type: 'PLAYHEAD.PAUSE' }) }
  stop(): void  { this.send({ type: 'PLAYHEAD.STOP' }) }
  seek(timeMs: number): void { this.send({ type: 'PLAYHEAD.SET', timeMs }) }

  /** Appelé par la boucle RAF externe — avance le playhead si isPlaying */
  tick(deltaMs: number): void { this.send({ type: 'PLAYHEAD.TICK', deltaMs }) }

  isPlaying(): boolean { return this.actor.getSnapshot().context.isPlaying }

  // ── Play range ───────────────────────────────────────────────────────────────

  setPlayRange(inMs: number, outMs: number): void {
    const clamped = {
      inMs: Math.max(0, Math.min(inMs, outMs)),
      outMs: Math.min(outMs, this.getScene().durationMs),
    }
    if (clamped.outMs - clamped.inMs < 100) return  // ignore ranges under 100ms
    this.send({ type: 'PLAYRANGE.SET', inMs: clamped.inMs, outMs: clamped.outMs })
  }

  clearPlayRange(): void {
    this.send({ type: 'PLAYRANGE.CLEAR' })
  }

  getPlayRange(): PlayRange | null {
    return this.actor.getSnapshot().context.playRange
  }

  // ── Follow playhead ──────────────────────────────────────────────────────────

  toggleFollowPlayhead(): void {
    this.send({ type: 'FOLLOW.TOGGLE' })
  }

  isFollowingPlayhead(): boolean {
    return this.actor.getSnapshot().context.followPlayhead
  }

  // ── Zoom to range ────────────────────────────────────────────────────────────

  zoomToRange(): void {
    const range = this.getPlayRange()
    if (!range) return
    const { viewWidthPx } = this.getViewport()
    const durationMs = range.outMs - range.inMs
    if (durationMs <= 0) return
    const newPixelsPerMs = viewWidthPx / durationMs
    this.send({ type: 'VIEWPORT.ZOOM', factor: newPixelsPerMs / this.getViewport().pixelsPerMs, focusMs: range.inMs })
    this.send({ type: 'VIEWPORT.SCROLL', startMs: range.inMs })
  }

  // ── Clip draw ────────────────────────────────────────────────────────────────

  clipPlace(trackId: string, pointerMs: number): void {
    this.send({ type: 'CLIP.PLACE', trackId, pointerMs })
  }

  clipStartDraw(trackId: string, pointerMs: number): void {
    const track = flattenTracks(this.getSnapshot().context.scene.tracks).find(t => t.id === trackId)
    const introId = track?.keyframes.find(k => k.name === 'intro')?.id ?? ''
    const outroId = track?.keyframes.find(k => k.name === 'outro')?.id ?? ''
    this.send({ type: 'CLIP.START_DRAW', trackId, pointerMs, introId, outroId })
  }

  clipDrawMove(pointerMs: number): void {
    this.send({ type: 'CLIP.DRAW_MOVE', pointerMs })
  }

  clipDrawEnd(): void {
    this.send({ type: 'CLIP.DRAW_END' })
  }

  // ── Drag (incremental, for pointer events) ──────────────────────────────────

  dragStartKeyframe(trackId: string, keyframeId: string): void {
    this.send({ type: 'DRAG.START_KEYFRAME', trackId, keyframeId })
  }

  dragMove(pointerMs: number): void {
    this.send({ type: 'DRAG.MOVE', pointerMs })
  }

  dragEnd(): void {
    this.send({ type: 'DRAG.END' })
  }

  // ── Selection ───────────────────────────────────────────────────────────────

  selectTrack(trackId: string | null): void {
    this.send({ type: 'TRACK.SELECT', trackId })
  }

  selectKeyframe(trackId: string, keyframeId: string | null): void {
    this.send({ type: 'KEYFRAME.SELECT', trackId, keyframeId })
  }

  // ── Keyframes ───────────────────────────────────────────────────────────────

  addKeyframe(trackId: string, timeMs: number): string {
    const id = genId('kf')
    this.send({ type: 'KEYFRAME.ADD', trackId, timeMs, id })
    return id
  }

  removeKeyframe(trackId: string, keyframeId: string): void {
    this.send({ type: 'KEYFRAME.REMOVE', trackId, keyframeId })
  }

  clearTrack(trackId: string): void {
    this.send({ type: 'KEYFRAME.CLEAR_TRACK', trackId })
  }

  clearCapsule(trackId: string): void {
    this.send({ type: 'KEYFRAME.CLEAR_CAPSULE', trackId })
  }

  moveKeyframe(trackId: string, keyframeId: string, timeMs: number): void {
    const snapped = this.snapToGrid(timeMs)
    this.send({ type: 'DRAG.START_KEYFRAME', trackId, keyframeId })
    this.send({ type: 'DRAG.MOVE', pointerMs: snapped })
    this.send({ type: 'DRAG.END' })
  }

  renameKeyframe(trackId: string, keyframeId: string, name: string | null): void {
    this.send({ type: 'KEYFRAME.RENAME', trackId, keyframeId, name })
  }

  assignDecor(trackId: string, keyframeId: string, decorId: string | null): void {
    this.send({ type: 'KEYFRAME.ASSIGN_DECOR', trackId, keyframeId, decorId })
  }

  setTransitionIn(trackId: string, keyframeId: string, def: TransitionDef | null): void {
    this.send({ type: 'KEYFRAME.SET_TRANSITION_IN', trackId, keyframeId, def })
  }

  setTransitionOut(trackId: string, keyframeId: string, def: TransitionDef | null): void {
    this.send({ type: 'KEYFRAME.SET_TRANSITION_OUT', trackId, keyframeId, def })
  }

  // ── Decor registry ──────────────────────────────────────────────────────────

  registerDecor(decorId: string, data: Record<string, unknown>): void {
    this.send({ type: 'DECOR.REGISTER', decorId, data })
  }

  getDecorData(decorId: string): Record<string, unknown> | null {
    return this.getScene().decors[decorId]?.data ?? null
  }

  // ── Track tree ──────────────────────────────────────────────────────────────

  addTrack(node: Omit<TrackNode, 'id' | 'keyframes'>, afterId?: string): string {
    const id = genId('track')
    this.send({ type: 'TRACK.ADD', node: { ...node, id }, afterId })
    return id
  }

  removeTrack(trackId: string): void {
    this.send({ type: 'TRACK.REMOVE', trackId })
  }

  moveTrack(trackId: string, afterId: string | null, parentId?: string): void {
    this.send({ type: 'TRACK.MOVE', trackId, afterId, parentId })
  }

  nestTrack(trackId: string, capsuleId: string): void {
    this.send({ type: 'TRACK.NEST_IN_CAPSULE', trackId, capsuleId })
  }

  toggleVisibility(trackId: string): void {
    this.send({ type: 'TRACK.TOGGLE_VISIBILITY', trackId })
  }

  resetKeyframes(trackId: string): void {
    this.send({ type: 'TRACK.RESET_KEYFRAMES', trackId })
  }

  // ── Cues / Markers ──────────────────────────────────────────────────────────

  addCue(cue: Omit<TextCue, 'id'>): string {
    const id = genId('cue')
    this.send({ type: 'CUE.ADD', cue: { ...cue, id } })
    return id
  }

  removeCue(cueId: string): void {
    this.send({ type: 'CUE.REMOVE', cueId })
  }

  addMarker(timeMs: number, label?: string): string {
    const id = genId('marker')
    this.send({ type: 'MARKER.ADD', marker: { id, timeMs, label: label ?? '' } })
    return id
  }

  moveMarker(markerId: string, timeMs: number): void {
    this.send({ type: 'MARKER.MOVE', markerId, timeMs })
  }

  removeMarker(markerId: string): void {
    this.send({ type: 'MARKER.REMOVE', markerId })
  }

  attachMarker(trackId: string, keyframeId: string, markerId: string): void {
    this.send({ type: 'KEYFRAME.ATTACH_MARKER', trackId, keyframeId, markerId })
  }

  detachMarker(trackId: string, keyframeId: string): void {
    this.send({ type: 'KEYFRAME.DETACH_MARKER', trackId, keyframeId })
  }

  // ── Audio ───────────────────────────────────────────────────────────────────

  setAudio(track: Omit<AudioTrack, 'waveform'>): void {
    this.send({ type: 'AUDIO.SET', track: { ...track } })
  }

  clearAudio(): void {
    this.send({ type: 'AUDIO.CLEAR' })
  }

  setAudioWaveform(waveform: WaveformDataV1): void {
    this.send({ type: 'AUDIO.SET_WAVEFORM', waveform })
  }

  // ── Duration ─────────────────────────────────────────────────────────────────

  setDuration(durationMs: number, source?: EditorScene['durationSource']): void {
    this.send({ type: 'SCENE.SET_DURATION', durationMs, source })
  }

  // ── Serialization ────────────────────────────────────────────────────────────

  serialize(): EditorScene {
    return structuredClone(this.getScene())
  }

  deserialize(scene: EditorScene): void {
    this.send({ type: 'SCENE.LOAD', scene })
  }

  // ── Coordinate utilities ─────────────────────────────────────────────────────

  msToPixel(timeMs: number): number {
    const { startMs, pixelsPerMs } = this.getViewport()
    return (timeMs - startMs) * pixelsPerMs
  }

  pixelToMs(px: number): number {
    const { startMs, pixelsPerMs } = this.getViewport()
    return startMs + px / pixelsPerMs
  }

  clampToViewport(timeMs: number): number {
    const { startMs, endMs } = this.getViewport()
    return Math.max(startMs, Math.min(timeMs, endMs))
  }

  snapToGrid(timeMs: number): number {
    const ctx = this.actor.getSnapshot().context
    const thresholdMs = ctx.layoutProfile.snapThresholdPx / ctx.viewport.pixelsPerMs
    return applySnapToMs(timeMs, ctx.snapGrid, thresholdMs)
  }
}
