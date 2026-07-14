import { describe, expect, it } from 'vitest'
import { renderMarginPx, timeToPixel, pixelToTime } from '../../src/sequence-editor/render/geometry'
import { LAYOUT_PROFILE_DESKTOP, LAYOUT_PROFILE_TOUCH } from '../../src/sequence-editor/layout-profile'
import type { MachineViewport } from '../../src/sequence-editor/machine'

const viewport: MachineViewport = { startMs: 0, endMs: 10000, pixelsPerMs: 0.1, viewWidthPx: 800, viewHeightPx: 600 }

describe('renderMarginPx', () => {
  it('desktop profile (keyframeHandleSizePx:10) — half (5) is under the 6px floor, floor wins', () => {
    expect(renderMarginPx(LAYOUT_PROFILE_DESKTOP)).toBe(6)
  })

  it('touch profile (keyframeHandleSizePx:20) — half (10) exceeds the floor, half wins', () => {
    expect(renderMarginPx(LAYOUT_PROFILE_TOUCH)).toBe(10)
  })
})

describe('timeToPixel / pixelToTime', () => {
  it('a keyframe at viewport.startMs lands at the margin, not at pixel 0 — stays fully visible', () => {
    expect(timeToPixel(viewport.startMs, viewport, LAYOUT_PROFILE_DESKTOP)).toBe(6)
  })

  it('roundtrips exactly', () => {
    const timeMs = 2500
    const px = timeToPixel(timeMs, viewport, LAYOUT_PROFILE_DESKTOP)
    expect(pixelToTime(px, viewport, LAYOUT_PROFILE_DESKTOP)).toBeCloseTo(timeMs)
  })

  it('pixelToTime at the margin resolves back to viewport.startMs', () => {
    expect(pixelToTime(6, viewport, LAYOUT_PROFILE_DESKTOP)).toBeCloseTo(viewport.startMs)
  })
})
