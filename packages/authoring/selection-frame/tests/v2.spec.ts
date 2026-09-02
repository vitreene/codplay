// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  createSelectionFrameV2,
  type SelectionFrameDelta,
  type SelectionFrameV2Modifier,
  type SelectionFrameValue,
} from '../src/v2'

beforeAll(() => {
  if (typeof HTMLElement.prototype.setPointerCapture !== 'function') {
    const captured = new WeakMap<HTMLElement, Set<number>>()
    HTMLElement.prototype.setPointerCapture = function (pointerId: number): void {
      let ids = captured.get(this)
      if (ids === undefined) {
        ids = new Set()
        captured.set(this, ids)
      }
      ids.add(pointerId)
    }
    HTMLElement.prototype.hasPointerCapture = function (pointerId: number): boolean {
      return captured.get(this)?.has(pointerId) ?? false
    }
    HTMLElement.prototype.releasePointerCapture = function (pointerId: number): void {
      captured.get(this)?.delete(pointerId)
    }
  }
})

function pointerEvent(type: string, clientX: number, clientY: number): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  Object.defineProperty(event, 'buttons', { value: type === 'pointerup' ? 0 : 1 })
  return event
}

function baseValue(): SelectionFrameValue {
  return { x: 80, y: 40, width: 160, height: 96, rotate: 0, scaleX: 1, scaleY: 1 }
}

function candidateFrom(base: SelectionFrameValue, delta: SelectionFrameDelta): SelectionFrameValue {
  if (delta.kind === 'move') return { ...base, x: base.x + delta.dx, y: base.y + delta.dy }
  if (delta.kind === 'rotate') return { ...base, rotate: (base.rotate ?? 0) + delta.dr }
  if (delta.kind === 'pivot') return { ...base, rotationOrigin: { fx: delta.fx, fy: delta.fy } }
  return {
    ...base,
    width: delta.handle.includes('e') ? base.width + delta.dx : base.width,
    height: delta.handle.includes('s') ? base.height + delta.dy : base.height,
  }
}

describe('createSelectionFrameV2', () => {
  let root: HTMLElement

  afterEach(() => {
    root?.remove()
  })

  it('affiche la valeur px fournie par l’éditeur et ne lit aucun node player', () => {
    root = document.createElement('div')
    document.body.append(root)
    const handle = createSelectionFrameV2({
      sceneRoot: root,
      onPreview: () => baseValue(),
      onCommit: () => {},
    })
    handle.setValue(baseValue())

    expect(handle.element.dataset.selectionFrame).toBe('v2')
    expect(handle.element.style.display).toBe('')
    expect(handle.element.style.left).toBe('80px')
    expect(handle.element.style.top).toBe('40px')
    expect(handle.element.style.width).toBe('160px')
    expect(handle.element.style.height).toBe('96px')
    expect(root.querySelectorAll('[data-selection-frame-handle]')).toHaveLength(8)

    handle.setSuspended(true)
    expect(handle.element.style.display).toBe('none')
    handle.setSuspended(false)
    expect(handle.element.style.display).toBe('')
    handle.destroy()
  })

  it('émet un delta px de déplacement puis commit la dernière valeur acceptée', () => {
    root = document.createElement('div')
    document.body.append(root)
    const base = baseValue()
    const deltas: SelectionFrameDelta[] = []
    const commits: SelectionFrameValue[] = []
    const handle = createSelectionFrameV2({
      sceneRoot: root,
      onPreview: (delta) => {
        deltas.push(delta)
        return candidateFrom(base, delta)
      },
      onCommit: (value) => commits.push(value),
    })
    handle.setValue(base)

    handle.element.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    handle.element.dispatchEvent(pointerEvent('pointermove', 124, 108))
    handle.element.dispatchEvent(pointerEvent('pointerup', 124, 108))

    expect(deltas.some((delta) => delta.kind === 'move' && delta.dx === 24 && delta.dy === 8)).toBe(true)
    expect(commits.at(-1)).toMatchObject({ x: 104, y: 48, width: 160, height: 96 })
    expect(handle.isGestureActive()).toBe(false)
    handle.destroy()
  })

  it('émet un delta px de resize depuis la poignée sud-est', () => {
    root = document.createElement('div')
    document.body.append(root)
    const base = baseValue()
    const deltas: SelectionFrameDelta[] = []
    const handle = createSelectionFrameV2({
      sceneRoot: root,
      onPreview: (delta) => {
        deltas.push(delta)
        return candidateFrom(base, delta)
      },
      onCommit: () => {},
    })
    handle.setValue(base)
    const southEast = root.querySelector<HTMLElement>('[data-selection-frame-handle="se"]')!

    southEast.dispatchEvent(pointerEvent('pointerdown', 240, 136))
    southEast.dispatchEvent(pointerEvent('pointermove', 280, 160))
    southEast.dispatchEvent(pointerEvent('pointerup', 280, 160))

    expect(deltas.some((delta) => delta.kind === 'resize' && delta.handle === 'se' && delta.dx === 40 && delta.dy === 24)).toBe(true)
    handle.destroy()
  })

  it('affiche un axe central, une aiguille et émet une rotation en degrés', () => {
    root = document.createElement('div')
    document.body.append(root)
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 10, top: 20, width: 600, height: 400, right: 610, bottom: 420 }),
    })
    const base = baseValue()
    const deltas: SelectionFrameDelta[] = []
    const commits: SelectionFrameValue[] = []
    const handle = createSelectionFrameV2({
      sceneRoot: root,
      onPreview: (delta) => {
        deltas.push(delta)
        return candidateFrom(base, delta)
      },
      onCommit: (value) => commits.push(value),
    })
    handle.setValue(base)

    const pivot = root.querySelector<HTMLElement>('[data-selection-frame-pivot]')!
    const tip = root.querySelector<HTMLElement>('[data-selection-frame-needle-tip]')!
    const line = root.querySelector<HTMLElement>('[data-selection-frame-needle]')!
    expect(pivot.style.left).toBe('80px')
    expect(pivot.style.top).toBe('48px')
    expect(tip.style.top).toBe('12px')
    expect(line.style.width).toBe('36px')
    expect(handle.element.style.transformOrigin).toBe('50% 50%')

    // The resting tip is above the center. Moving it to the right describes +90° around the axis.
    tip.dispatchEvent(pointerEvent('pointerdown', 170, 72))
    tip.dispatchEvent(pointerEvent('pointermove', 242, 108))
    expect(Number.parseFloat(line.style.width)).toBeGreaterThan(36)
    tip.dispatchEvent(pointerEvent('pointerup', 242, 108))

    expect(deltas.some((delta) => delta.kind === 'rotate' && delta.dr === 90)).toBe(true)
    expect(commits.at(-1)).toMatchObject({ rotate: 90 })
    expect(handle.isGestureActive()).toBe(false)
    handle.destroy()
  })

  it('déplace l’axe par fractions locales et magnétise un repère caractéristique', () => {
    root = document.createElement('div')
    document.body.append(root)
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 10, top: 20, width: 600, height: 400, right: 610, bottom: 420 }),
    })
    const base = baseValue()
    const deltas: SelectionFrameDelta[] = []
    const handle = createSelectionFrameV2({
      sceneRoot: root,
      onPreview: (delta) => {
        deltas.push(delta)
        return candidateFrom(base, delta)
      },
      onCommit: () => {},
    })
    handle.setValue(base)
    const pivot = root.querySelector<HTMLElement>('[data-selection-frame-pivot]')!

    pivot.dispatchEvent(pointerEvent('pointerdown', 170, 108))
    // Local (0, 0) is the top-left of the untransformed frame. A point within the 8px
    // magnet radius of it is emitted as the exact characteristic point.
    pivot.dispatchEvent(pointerEvent('pointermove', 91, 61))
    pivot.dispatchEvent(pointerEvent('pointerup', 91, 61))

    expect(deltas.some((delta) => delta.kind === 'pivot' && delta.fx === 0 && delta.fy === 0)).toBe(true)
    expect(root.querySelector<HTMLElement>('[data-selection-frame-handle="nw"]')!.style.display).toBe('none')
    expect(pivot.style.left).toBe('0px')
    expect(pivot.style.top).toBe('0px')
    handle.destroy()
  })

  it('compose un modifieur indépendant sans mélanger ses contrôles au cadre de base', () => {
    root = document.createElement('div')
    document.body.append(root)
    const updates: Array<SelectionFrameValue | null> = []
    const node = document.createElement('div')
    node.setAttribute('data-test-selection-modifier', '')
    const modifier: SelectionFrameV2Modifier = {
      name: 'test-capability',
      mount: (context) => {
        context.frame.append(node)
        return {
          update: (value) => updates.push(value),
          reset: () => updates.push(null),
          isGestureActive: () => false,
          ownsTarget: (target) => target === node,
          destroy: () => node.remove(),
        }
      },
    }
    const previews: SelectionFrameDelta[] = []
    const handle = createSelectionFrameV2({
      sceneRoot: root,
      modifiers: [modifier],
      onPreview: (delta) => {
        previews.push(delta)
        return baseValue()
      },
      onCommit: () => {},
    })
    handle.setValue(baseValue())

    expect(root.querySelector('[data-test-selection-modifier]')).toBe(node)
    expect(root.querySelector('[data-selection-frame-pivot]')).toBeNull()
    expect(updates.at(-1)).toEqual(baseValue())

    node.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    node.dispatchEvent(pointerEvent('pointermove', 120, 100))
    node.dispatchEvent(pointerEvent('pointerup', 120, 100))
    expect(previews).toHaveLength(0)

    handle.setValue(null)
    expect(updates.at(-1)).toBeNull()
    handle.destroy()
  })
})
