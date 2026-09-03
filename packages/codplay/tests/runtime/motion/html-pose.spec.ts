/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'

import {
  captureHtmlPose,
  createHtmlPoseCaptureContext,
  worldDeltaToLocalDelta,
} from '../../../src/runtime/motion/html-pose'
import type { HtmlMatrix } from '../../../src/runtime/motion/html-types'

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

  it('keeps the untransformed slot separate from an authored transform translation', () => {
    const root = document.createElement('main')
    const item = document.createElement('article')
    root.appendChild(item)
    root.style.width = '200px'
    root.style.height = '200px'
    item.style.width = '20px'
    item.style.height = '20px'
    item.style.transform = 'matrix(1, 0, 0, 1, 80, 40)'
    Object.defineProperties(item, {
      offsetLeft: { configurable: true, value: 12 },
      offsetTop: { configurable: true, value: 8 },
    })
    defineRect(root, { left: 0, top: 0, width: 200, height: 200 })
    defineRect(item, { left: 92, top: 48, width: 20, height: 20 })

    const context = createHtmlPoseCaptureContext()
    captureHtmlPose(root, context)
    const pose = captureHtmlPose(item, context)

    expect(pose.layoutOrigin).toEqual({ x: 12, y: 8 })
    expect(pose.origin).toEqual({ x: 92, y: 48 })
  })
})

/** Installs the measured rectangle used by the explicit geometry transaction. */
function defineRect(node: HTMLElement, rect: Readonly<{ left: number; top: number; width: number; height: number }>): void {
  Object.defineProperty(node, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({ ...rect }),
    }),
  })
}
