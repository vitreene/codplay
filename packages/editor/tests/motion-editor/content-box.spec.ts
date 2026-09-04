import { describe, expect, it } from 'vitest'
import {
  contentBoxFrameToPoseFrame,
  poseFrameToContentBoxFrame,
} from '../../src/motion-editor/content-box'
import type { SelectionFrameValue } from '../../src/decor-editor/types'

describe('motion editor content-box projection', () => {
  it('shifts only the origin and preserves the authored content dimensions', () => {
    const frame: SelectionFrameValue = { x: 100, y: 80, width: 200, height: 120, rotate: 0 }

    expect(poseFrameToContentBoxFrame(frame, { top: 5, right: 7, bottom: 9, left: 11 })).toEqual({
      x: 111,
      y: 85,
      width: 200,
      height: 120,
      rotate: 0,
    })
  })

  it('keeps a centred border aligned with CSS layout coordinates under rotation and scale', () => {
    const frame: SelectionFrameValue = {
      x: 100,
      y: 80,
      width: 200,
      height: 120,
      rotate: 90,
      scaleX: 2,
      scaleY: 0.5,
    }

    expect(poseFrameToContentBoxFrame(frame, { top: 3, right: 3, bottom: 3, left: 3 })).toMatchObject({
      x: 103,
      y: 83,
      width: 200,
      height: 120,
    })
  })

  it('accounts for an asymmetric border when the transform origin is not centred', () => {
    const frame: SelectionFrameValue = {
      x: 100,
      y: 80,
      width: 200,
      height: 120,
      rotate: 90,
      scaleX: 2,
      scaleY: 0.5,
      rotationOrigin: { fx: 0.25, fy: 0.75 },
    }

    expect(poseFrameToContentBoxFrame(frame, { top: 3, right: 0, bottom: 0, left: 5 })).toMatchObject({
      x: 100.875,
      y: 89.75,
      width: 200,
      height: 120,
    })
  })

  it('is reversible before an offset is serialized', () => {
    const frame: SelectionFrameValue = {
      x: 140,
      y: 50,
      width: 180,
      height: 90,
      rotate: -27,
      scaleX: 1.25,
      scaleY: 0.8,
      rotationOrigin: { fx: 0.1, fy: 0.9 },
    }
    const insets = { top: 4, right: 8, bottom: 6, left: 12 }

    expect(contentBoxFrameToPoseFrame(poseFrameToContentBoxFrame(frame, insets), insets)).toEqual(frame)
  })
})
