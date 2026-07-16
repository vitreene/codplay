// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { applyStyleProps, readNodePose } from '../../src/runtime/components/lib/dom'

/**
 * readNodePose reads back the pose from anime.js's own resolution (utils.get),
 * the symmetric counterpart of applyStyleProps's utils.set — never from
 * getComputedStyle, which only sees whatever discrete CSS representation
 * anime chose (or didn't choose) for a given property.
 */
describe('V1 - readNodePose reads back anime.js pose (symmetric to applyStyleProps)', () => {
  it('reads x/y/rotate/scaleX/scaleY/width/height applied via applyStyleProps', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    applyStyleProps(el, { x: 10, y: 20, rotate: 45, scaleX: 1.5, scaleY: 2, width: '100px', height: '50px' })

    expect(readNodePose(el)).toEqual({ x: 10, y: 20, rotate: 45, scaleX: 1.5, scaleY: 2, width: 100, height: 50 })
  })

  it('defaults to identity pose on an untouched element', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    expect(readNodePose(el)).toEqual({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1, width: 0, height: 0 })
  })

  it('reads rotate correctly on a FRESH element that never carried the previous element\'s state — the exact rebuild-replacement scenario this closes (rotate composed only into `transform`, never mirrored to a discrete CSS property, was silently lost across a node swap before this method existed)', () => {
    const before = document.createElement('div')
    document.body.appendChild(before)
    applyStyleProps(before, { x: 10, y: 20, rotate: 66, scaleX: 1, scaleY: 1, width: '100px', height: '50px' })
    document.body.removeChild(before)

    const after = document.createElement('div')
    document.body.appendChild(after)
    applyStyleProps(after, { x: 10, y: 20, rotate: 66, scaleX: 1, scaleY: 1, width: '100px', height: '50px' })

    expect(readNodePose(after)?.rotate).toBe(66)
  })

  it('returns null for a non-DOM node ref', () => {
    expect(readNodePose(null)).toBeNull()
    expect(readNodePose(undefined)).toBeNull()
    expect(readNodePose({ tagName: 'DIV', style: {} })).toBeNull()
  })
})
