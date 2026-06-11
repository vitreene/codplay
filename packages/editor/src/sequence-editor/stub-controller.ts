import type {
  EditorScene,
  SequenceEditorContext,
  SelectionTarget,
  ViewportState,
  LayoutProfile,
  DisplayConfig,
  Keyframe,
} from './types'
import { LAYOUT_PROFILE_DEFAULT } from './layout-profile'
import { DISPLAY_CONFIG_DEFAULT } from './display-config'
import { ZOOM_DEFAULT_PX_PER_SEC, ZOOM_MIN_PX_PER_SEC, ZOOM_MAX_PX_PER_SEC } from './constants'
import { generateSnapPoints, msToPixel, pixelToMs, snapToGrid } from './utils'

type Listener = (ctx: SequenceEditorContext) => void

export class StubController {
  private ctx: SequenceEditorContext
  private listeners: Set<Listener> = new Set()
  private rafId: number | null = null
  private playStartWallMs: number | null = null
  private playStartTimeMs: number = 0

  constructor(scene: EditorScene) {
    const viewport: ViewportState = {
      pxPerSec: ZOOM_DEFAULT_PX_PER_SEC,
      scrollLeftMs: 0,
      visibleDurationMs: 0,
    }
    this.ctx = {
      scene,
      viewport,
      playheadMs: 0,
      isPlaying: false,
      selection: null,
      interaction: { kind: 'idle' },
      viewMode: 'compact',
      layoutProfile: LAYOUT_PROFILE_DEFAULT,
      displayConfig: DISPLAY_CONFIG_DEFAULT,
      snapGrid: generateSnapPoints(scene.tracks),
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.ctx)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const l of this.listeners) l(this.ctx)
  }

  private update(patch: Partial<SequenceEditorContext>): void {
    this.ctx = { ...this.ctx, ...patch }
    this.emit()
  }

  getContext(): SequenceEditorContext {
    return this.ctx
  }

  // ─── Playhead ─────────────────────────────────────────────────────────────

  seek(timelineMs: number): void {
    const clamped = Math.max(0, Math.min(timelineMs, this.ctx.scene.durationMs))
    console.log('[stub] seek', clamped)
    this.update({ playheadMs: clamped })
  }

  play(): void {
    if (this.ctx.isPlaying) return
    console.log('[stub] play')
    this.playStartWallMs = performance.now()
    this.playStartTimeMs = this.ctx.playheadMs
    this.update({ isPlaying: true })
    this.tick()
  }

  pause(): void {
    if (!this.ctx.isPlaying) return
    console.log('[stub] pause')
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.update({ isPlaying: false })
  }

  stop(): void {
    console.log('[stub] stop')
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.update({ isPlaying: false, playheadMs: 0 })
  }

  private tick(): void {
    this.rafId = requestAnimationFrame(() => {
      if (!this.ctx.isPlaying || this.playStartWallMs === null) return
      const elapsed = performance.now() - this.playStartWallMs
      const timeMs = this.playStartTimeMs + elapsed
      if (timeMs >= this.ctx.scene.durationMs) {
        this.update({ playheadMs: this.ctx.scene.durationMs, isPlaying: false })
        return
      }
      this.update({ playheadMs: timeMs })
      this.tick()
    })
  }

  // ─── Keyframes ────────────────────────────────────────────────────────────

  addKeyframe(trackId: string, rawMs: number): void {
    const snapped = snapToGrid(rawMs, this.ctx.snapGrid, this.ctx.layoutProfile.snapThresholdPx, this.ctx.viewport.pxPerSec)
    console.log('[stub] addKeyframe', trackId, snapped)

    const newKf: Keyframe = {
      id: `kf-${Date.now()}`,
      timeMs: snapped,
      decorId: null,
    }

    const tracks = this.ctx.scene.tracks.map(t =>
      t.id === trackId ? { ...t, keyframes: [...t.keyframes, newKf].sort((a, b) => a.timeMs - b.timeMs) } : t
    )
    const scene = { ...this.ctx.scene, tracks }
    const snapGrid = generateSnapPoints(tracks)
    this.update({ scene, snapGrid })
  }

  removeKeyframe(trackId: string, keyframeId: string): void {
    console.log('[stub] removeKeyframe', trackId, keyframeId)
    const tracks = this.ctx.scene.tracks.map(t =>
      t.id === trackId ? { ...t, keyframes: t.keyframes.filter(k => k.id !== keyframeId) } : t
    )
    const scene = { ...this.ctx.scene, tracks }
    const snapGrid = generateSnapPoints(tracks)
    this.update({ scene, snapGrid })
  }

  moveKeyframe(trackId: string, keyframeId: string, rawMs: number): void {
    const snapped = snapToGrid(rawMs, this.ctx.snapGrid, this.ctx.layoutProfile.snapThresholdPx, this.ctx.viewport.pxPerSec)
    console.log('[stub] moveKeyframe', trackId, keyframeId, snapped)
    const tracks = this.ctx.scene.tracks.map(t => {
      if (t.id !== trackId) return t
      return {
        ...t,
        keyframes: t.keyframes
          .map(k => k.id === keyframeId ? { ...k, timeMs: snapped } : k)
          .sort((a, b) => a.timeMs - b.timeMs),
      }
    })
    const scene = { ...this.ctx.scene, tracks }
    const snapGrid = generateSnapPoints(tracks)
    this.update({ scene, snapGrid })
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  select(target: SelectionTarget): void {
    console.log('[stub] select', target)
    this.update({ selection: target })
  }

  deselect(): void {
    this.update({ selection: null })
  }

  // ─── Viewport ─────────────────────────────────────────────────────────────

  setZoom(pxPerSec: number): void {
    const clamped = Math.max(ZOOM_MIN_PX_PER_SEC, Math.min(ZOOM_MAX_PX_PER_SEC, pxPerSec))
    console.log('[stub] setZoom', clamped)
    this.update({ viewport: { ...this.ctx.viewport, pxPerSec: clamped } })
  }

  setScrollLeft(scrollLeftMs: number): void {
    const clamped = Math.max(0, scrollLeftMs)
    this.update({ viewport: { ...this.ctx.viewport, scrollLeftMs: clamped } })
  }

  setVisibleDuration(visibleDurationMs: number): void {
    this.update({ viewport: { ...this.ctx.viewport, visibleDurationMs } })
  }

  // ─── Config ───────────────────────────────────────────────────────────────

  setLayoutProfile(profile: LayoutProfile): void {
    this.update({ layoutProfile: profile })
  }

  setDisplayConfig(config: DisplayConfig): void {
    this.update({ displayConfig: config })
  }

  // ─── Coordinate helpers ───────────────────────────────────────────────────

  msToPixel(ms: number): number {
    return msToPixel(ms - this.ctx.viewport.scrollLeftMs, this.ctx.viewport.pxPerSec)
  }

  pixelToMs(px: number): number {
    return pixelToMs(px, this.ctx.viewport.pxPerSec) + this.ctx.viewport.scrollLeftMs
  }
}
