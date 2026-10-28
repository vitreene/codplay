/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'

import {
  captureHtmlPose,
  createHtmlPoseCaptureContext,
  worldDeltaToLocalDelta,
} from '../../../src/runtime/motion/html-pose'
import type { HtmlMatrix } from '../../../src/runtime/motion/html-types'
import { deriveRelativeMotionPose } from '../../../src/runtime/motion/motion-pose'
import { resolveLocalPresentationMatrix } from '../../../src/runtime/runner-html/motion-presentation/geometry'

describe('V2 HTML pose host math', () => {
  afterEach(() => document.body.replaceChildren())

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
    defineLayout(item, root, 12, 8)
    defineRect(root, { left: 0, top: 0, width: 200, height: 200 })
    forbidItemRect(item)

    const context = createHtmlPoseCaptureContext()
    captureHtmlPose(root, context)
    const pose = captureHtmlPose(item, context)

    expect(pose.layoutOrigin).toEqual({ x: 12, y: 8 })
    expect(pose.origin).toEqual({ x: 92, y: 48 })
  })

  it('does not measure ancestors above an explicit local capture root', () => {
    const outer = document.createElement('section')
    const root = document.createElement('main')
    const item = document.createElement('article')
    outer.append(root)
    root.append(item)
    document.body.append(outer)
    Object.defineProperty(outer, 'getBoundingClientRect', {
      configurable: true,
      value: () => { throw new Error('outside capture root must not be measured') },
    })
    root.style.width = '200px'
    root.style.height = '200px'
    item.style.width = '20px'
    item.style.height = '20px'
    defineRect(root, { left: 100, top: 50, width: 200, height: 200 })
    defineLayout(item, root, 20, 20)
    forbidItemRect(item)

    const context = createHtmlPoseCaptureContext(root)
    captureHtmlPose(root, context)
    const pose = captureHtmlPose(item, context)

    expect(pose.origin).toEqual({ x: 120, y: 70 })
  })

  it.each([
    { boxSizing: 'content-box', pivot: '110px 70px', border: '10px', padding: '0px', x: 492, y: 68 },
    { boxSizing: 'content-box', pivot: '114px 69px', border: '3px 5px 7px 11px', padding: '2px 4px 6px 8px', x: 495, y: 63 },
    { boxSizing: 'border-box', pivot: '100px 60px', border: '3px 5px 7px 11px', padding: '2px 4px 6px 8px', x: 472, y: 68 },
    { boxSizing: 'content-box', pivot: '0px 0px', border: '10px', padding: '0px', x: 312, y: 108 },
  ])('captures a bordered $boxSizing item around $pivot without a DOM rectangle', (fixture) => {
    const root = createRoot()
    const item = document.createElement('article')
    root.append(item)
    item.style.cssText = `width:200px;height:120px;box-sizing:${fixture.boxSizing};padding:${fixture.padding};border-style:solid`
    item.style.borderWidth = fixture.border
    item.style.transformOrigin = fixture.pivot
    item.style.transform = 'matrix(0, 1, -1, 0, 300, 100)'
    defineLayout(item, root, 12, 8)
    forbidItemRect(item)

    const context = createHtmlPoseCaptureContext(root)
    const pose = captureHtmlPose(item, context)
    const matrix = resolveLocalPresentationMatrix([12, 8], pose, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })

    expect(pose.origin).toEqual({ x: fixture.x, y: fixture.y })
    expect(pose.localWidth).toBe(200)
    expect(pose.localHeight).toBe(120)
    expect(matrix).toEqual({ a: 0, b: 1, c: -1, d: 0, e: fixture.x - 12, f: fixture.y - 8 })
  })

  it('composes a fractional root anchor, a transformed parent and a fractional child translation', () => {
    const root = createRoot(10.25, 20.75)
    const parent = document.createElement('section')
    const child = document.createElement('article')
    root.append(parent)
    parent.append(child)
    parent.style.cssText = 'width:200px;height:120px;transform:matrix(0,2,-3,0,0,0);transform-origin:0px 0px'
    child.style.cssText = 'width:20px;height:10px;transform:matrix(1,0,0,1,4.5,6.25);transform-origin:0px 0px'
    defineLayout(parent, root, 30, 40)
    defineLayout(child, parent, 5, 7)
    forbidItemRect(parent)
    forbidItemRect(child)
    const context = createHtmlPoseCaptureContext(root)
    const parentPose = captureHtmlPose(parent, context)
    const childPose = captureHtmlPose(child, context)

    expect(parentPose.origin).toEqual({ x: 40.25, y: 60.75 })
    expect(childPose.origin).toEqual({ x: 0.5, y: 79.75 })
    expect(childPose.layoutOrigin).toEqual({ x: 19.25, y: 70.75 })
    expect(deriveRelativeMotionPose(parentPose, childPose).origin).toEqual([9.5, 13.25])
    expect(childPose.matrix).toMatchObject({ a: 0, b: 2, c: -3, d: 0 })
  })

  it('keeps a non-centred pivot under negative and non-uniform scale', () => {
    const root = createRoot()
    const item = document.createElement('article')
    root.append(item)
    item.style.cssText = 'width:200px;height:120px;border:10px solid;transform:matrix(-2,0,0,1.5,7,11);transform-origin:25px 45px'
    defineLayout(item, root, 12, 8)
    forbidItemRect(item)

    const pose = captureHtmlPose(item, createHtmlPoseCaptureContext(root))

    expect(pose.origin).toEqual({ x: 94, y: -3.5 })
    expect(pose.matrix).toMatchObject({ a: -2, b: 0, c: 0, d: 1.5 })
  })

  it('subtracts parent scroll from the layout slot and keeps the parent border inset', () => {
    const root = createRoot(100.25, 50.75)
    const parent = document.createElement('section')
    const item = document.createElement('article')
    root.append(parent)
    parent.append(item)
    parent.style.cssText = 'width:200px;height:120px'
    item.style.cssText = 'width:20px;height:10px'
    defineLayout(parent, root, 10, 20)
    defineLayout(item, parent, 30, 40)
    Object.defineProperties(parent, {
      clientLeft: { value: 3 },
      clientTop: { value: 4 },
    })
    parent.scrollLeft = 12.5
    parent.scrollTop = 8.25
    forbidItemRect(parent)
    forbidItemRect(item)

    const pose = captureHtmlPose(item, createHtmlPoseCaptureContext(root))

    expect(pose.origin).toEqual({ x: 130.75, y: 106.5 })
    expect(pose.layoutOrigin).toEqual(pose.origin)
  })

  it('uses layout dimensions when CSS dimensions are unavailable without reading an item rectangle', () => {
    const root = createRoot()
    const item = document.createElement('article')
    root.append(item)
    defineLayout(item, root, 0, 0)
    Object.defineProperties(item, {
      offsetWidth: { value: 64 },
      offsetHeight: { value: 32 },
    })
    forbidItemRect(item)

    const pose = captureHtmlPose(item, createHtmlPoseCaptureContext(root))

    expect(pose.localWidth).toBe(64)
    expect(pose.localHeight).toBe(32)
  })

  it('anchors a rotated bordered root once without changing its CSS dimensions', () => {
    const root = document.createElement('main')
    const item = document.createElement('article')
    root.style.cssText = 'width:200px;height:120px;padding:5px;border:10px solid;transform:matrix(0,1,-1,0,0,0);transform-origin:115px 75px'
    item.style.cssText = 'width:20px;height:10px'
    root.append(item)
    document.body.append(root)
    defineLayout(item, root, 0, 0)
    forbidItemRect(item)
    let anchorReads = 0
    Object.defineProperty(root, 'getBoundingClientRect', {
      value: () => {
        anchorReads += 1
        return new DOMRect(100, 50, 150, 230)
      },
    })
    const context = createHtmlPoseCaptureContext(root)

    const pose = captureHtmlPose(root, context)
    captureHtmlPose(item, context)
    captureHtmlPose(root, context)

    expect(pose.origin).toEqual({ x: 250, y: 50 })
    expect(pose.localWidth).toBe(200)
    expect(pose.localHeight).toBe(120)
    expect(anchorReads).toBe(1)
  })
})

/** Creates an explicit capture root whose sole rectangle read anchors the viewport. */
function createRoot(left = 0, top = 0): HTMLElement {
  const root = document.createElement('main')
  root.style.cssText = 'width:800px;height:450px'
  document.body.append(root)
  defineRect(root, { left, top, width: 800, height: 450 })
  return root
}

/** Supplies layout metrics that jsdom cannot obtain from a browser layout engine. */
function defineLayout(node: HTMLElement, parent: HTMLElement, left: number, top: number): void {
  Object.defineProperties(node, {
    offsetParent: { configurable: true, value: parent },
    offsetLeft: { configurable: true, value: left },
    offsetTop: { configurable: true, value: top },
  })
}

/** Makes every item rectangle read a failing contract assertion. */
function forbidItemRect(node: HTMLElement): void {
  Object.defineProperty(node, 'getBoundingClientRect', {
    configurable: true,
    value: () => { throw new Error('item geometry must use layout, computed styles and matrices') },
  })
}

/** Installs only the initial viewport anchor used by a capture root. */
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
