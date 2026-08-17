import { describe, expect, it } from 'vitest'

import { worldDeltaToLocalDelta } from '../../../src/runtime/flip/html-pose'
import type { HtmlMatrix } from '../../../src/runtime/flip/types'

describe('V2 HTML pose host math', () => {
  it('keeps an identity parent delta unchanged', () => {
    const identity: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

    expect(worldDeltaToLocalDelta(identity, -17.5, 117.8)).toEqual({ x: -17.5, y: 117.8 })
  })

  it('converts a world delta into the rotated and scaled parent frame', () => {
    const parent: HtmlMatrix = {
      a: 0.6407,
      b: 0.427,
      c: -0.427,
      d: 0.6407,
      e: 78.6,
      f: -21.2,
    }

    const local = worldDeltaToLocalDelta(parent, -17.57, 117.87)
    const worldX = parent.a * local.x + parent.c * local.y
    const worldY = parent.b * local.x + parent.d * local.y

    expect(worldX).toBeCloseTo(-17.57, 4)
    expect(worldY).toBeCloseTo(117.87, 4)
  })
})
