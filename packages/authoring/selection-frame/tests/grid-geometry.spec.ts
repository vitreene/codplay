import { describe, expect, it } from 'vitest'

import {
  nearestTrackAnchor,
  nearestTrackSpan,
  parseResolvedTrackList,
  trackAnchorPx,
  trackIndexAtPx,
  trackSpanPx,
  uniformTrackGeometry
} from '../src/grid-geometry'

describe('parseResolvedTrackList', () => {
  it('parses a resolved px list', () => {
    expect(parseResolvedTrackList('130px 260px 130px')).toEqual([130, 260, 130])
  })

  it('rejects unresolved templates (fr, repeat, empty)', () => {
    expect(parseResolvedTrackList('1fr 2fr')).toBeNull()
    expect(parseResolvedTrackList('repeat(4, 1fr)')).toBeNull()
    expect(parseResolvedTrackList('')).toBeNull()
    expect(parseResolvedTrackList('none')).toBeNull()
  })
})

describe('track math', () => {
  const tracks = [50, 200, 100, 150]
  const gap = 10

  it('computes anchors with gaps', () => {
    expect(trackAnchorPx(tracks, gap, 1)).toBe(0)
    expect(trackAnchorPx(tracks, gap, 2)).toBe(60)
    expect(trackAnchorPx(tracks, gap, 3)).toBe(270)
    expect(trackAnchorPx(tracks, gap, 4)).toBe(380)
  })

  it('computes span extents with inner gaps', () => {
    expect(trackSpanPx(tracks, gap, 1, 1)).toBe(50)
    expect(trackSpanPx(tracks, gap, 1, 2)).toBe(260)
    expect(trackSpanPx(tracks, gap, 2, 3)).toBe(470)
  })

  it('finds the track containing one position (boundary walk)', () => {
    expect(trackIndexAtPx(tracks, gap, 0)).toBe(1)
    expect(trackIndexAtPx(tracks, gap, 49)).toBe(1)
    expect(trackIndexAtPx(tracks, gap, 61)).toBe(2)
    expect(trackIndexAtPx(tracks, gap, 300)).toBe(3)
    expect(trackIndexAtPx(tracks, gap, 9_999)).toBe(4)
  })

  it('finds the nearest anchor within a max index', () => {
    expect(nearestTrackAnchor(tracks, gap, 55, 4)).toBe(2)
    expect(nearestTrackAnchor(tracks, gap, 300, 4)).toBe(3)
    expect(nearestTrackAnchor(tracks, gap, 300, 2)).toBe(2)
  })

  it('finds the nearest span extent', () => {
    expect(nearestTrackSpan(tracks, gap, 2, 200)).toBe(1)
    expect(nearestTrackSpan(tracks, gap, 2, 370)).toBe(2)
    expect(nearestTrackSpan(tracks, gap, 2, 9_999)).toBe(3)
  })
})

describe('uniformTrackGeometry', () => {
  it('splits the local size minus gaps evenly', () => {
    const geometry = uniformTrackGeometry({
      rows: 2,
      cols: 4,
      localWidth: 430,
      localHeight: 210,
      columnGap: 10,
      rowGap: 10
    })
    expect(geometry.cols).toEqual([100, 100, 100, 100])
    expect(geometry.rows).toEqual([100, 100])
  })
})
