// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createSelectionFrameV2, type SelectionFrameDelta, type SelectionFrameValue } from '../src/v2'

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
})
