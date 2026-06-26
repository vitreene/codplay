// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from 'vitest'

import {
  applySlotTextBefore,
  applySlotTextAfter,
  cancelSlotTextSession,
} from '../../src/runtime/modules/replace/apply-slot-text'
import { REPLACE_TRANSITIONS } from '../../src/runtime/config/transitions'
import type { ReplaceCommand } from '../../src/runtime/modules/replace/normalize-replace'

const slotUp = REPLACE_TRANSITIONS['slot-up']

function makeCommand(overrides: Partial<ReplaceCommand> = {}): ReplaceCommand {
  return {
    transition: slotUp,
    duration: 500,
    split: 'letter',
    ...overrides,
  }
}

function mountText(initial: string): { el: HTMLElement; parent: HTMLElement } {
  const parent = document.createElement('div')
  const el = document.createElement('p')
  el.id = 'slot-target'
  el.textContent = initial
  parent.appendChild(el)
  document.body.appendChild(parent)
  return { el, parent }
}

describe('V1 - replace slot-text rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('catalogue exposes slot-up / slot-down with a slot config (regular by default)', () => {
    expect(REPLACE_TRANSITIONS['slot-up'].slot).toEqual({ axis: 'up', bounce: 0, chroma: true })
    expect(REPLACE_TRANSITIONS['slot-up'].ease).toBe('outBack')
    expect(REPLACE_TRANSITIONS['slot-down'].slot?.axis).toBe('down')
  })

  it('builds clipped per-character cells with stacked old/new faces and emits y transitions', () => {
    const { el, parent } = mountText('ab')
    applySlotTextBefore(el, parent, 'letter')
    el.textContent = 'cd'

    const requests = applySlotTextAfter({
      el,
      command: makeCommand(),
      slot: slotUp.slot!,
      eventId: 'e1',
      eventName: 'swap',
      listenerId: 'l1',
      persoId: 'slot-target',
    })

    const overlay = parent.querySelector('#slot-target-slot') as HTMLElement
    expect(overlay).not.toBeNull()

    // 2 changed cells, each clipped.
    const cells = overlay.querySelectorAll(':scope > span')
    expect(cells.length).toBe(2)
    cells.forEach((cell) => {
      expect((cell as HTMLElement).style.overflow).toBe('hidden')
    })

    // Each changed cell has an old face (y: 0 -> -H) and a new face (y: +H -> 0).
    const yRequests = requests.filter((r) => r.property === 'y')
    expect(yRequests.length).toBe(4)

    const oldFaceReq = yRequests.find((r) => r.from === 0)
    expect(oldFaceReq).toBeDefined()
    // axis up -> old exits upward (negative)
    expect(Number(oldFaceReq!.to)).toBeLessThan(0)

    const newFaceReq = yRequests.find((r) => r.to === 0 && Number(r.from) > 0)
    expect(newFaceReq).toBeDefined()

    // group.total counts every emitted request and all share one group id.
    const groupIds = new Set(requests.map((r) => r.group?.id))
    expect(groupIds.size).toBe(1)
    requests.forEach((r) => expect(r.group?.total).toBe(requests.length))
  })

  it('uses a regular uniform timing by default (bounce 0): same duration, synchronized faces', () => {
    const { el, parent } = mountText('hello')
    applySlotTextBefore(el, parent, 'letter')
    el.textContent = 'world'

    const requests = applySlotTextAfter({
      el,
      command: makeCommand(),
      slot: slotUp.slot!,
      eventId: 'e1',
      eventName: 'swap',
      listenerId: 'l1',
      persoId: 'slot-target',
    })

    const yRequests = requests.filter((r) => r.property === 'y')
    // All glyphs share the command duration — no per-character wobble.
    yRequests.forEach((r) => expect(r.duration).toBe(500))

    // faceSpecs are pushed old-then-new per changed column, so consecutive index pairs
    // (2k, 2k+1) belong to the same column and must start together (synchronized roll).
    const delayByIdx = new Map<number, number>()
    yRequests.forEach((r) => {
      const idx = Number(r.transitionId.slice(r.transitionId.lastIndexOf('-') + 1))
      delayByIdx.set(idx, r.delayMs ?? 0)
    })
    for (let k = 0; k * 2 + 1 < delayByIdx.size; k++) {
      expect(delayByIdx.get(k * 2 + 1)).toBe(delayByIdx.get(k * 2))
    }
  })

  it('skips unchanged glyphs (no transition) by default', () => {
    const { el, parent } = mountText('cat')
    applySlotTextBefore(el, parent, 'letter')
    el.textContent = 'cot' // only middle char changes

    const requests = applySlotTextAfter({
      el,
      command: makeCommand(),
      slot: slotUp.slot!,
      eventId: 'e1',
      eventName: 'swap',
      listenerId: 'l1',
      persoId: 'slot-target',
    })

    // Only the single changed column animates: old 'a' + new 'o' = 2 y requests.
    const yRequests = requests.filter((r) => r.property === 'y')
    expect(yRequests.length).toBe(2)
  })

  it('animates unchanged glyphs when skipUnchanged is false', () => {
    const { el, parent } = mountText('cat')
    applySlotTextBefore(el, parent, 'letter')
    el.textContent = 'cot'

    const requests = applySlotTextAfter({
      el,
      command: makeCommand({ skipUnchanged: false }),
      slot: slotUp.slot!,
      eventId: 'e1',
      eventName: 'swap',
      listenerId: 'l1',
      persoId: 'slot-target',
    })

    // All three columns animate: 3 old + 3 new = 6 y requests.
    const yRequests = requests.filter((r) => r.property === 'y')
    expect(yRequests.length).toBe(6)
  })

  it('emits a color transition per incoming face when chroma is enabled', () => {
    const { el, parent } = mountText('ab')
    applySlotTextBefore(el, parent, 'letter')
    el.textContent = 'cd'

    const requests = applySlotTextAfter({
      el,
      command: makeCommand(),
      slot: slotUp.slot!,
      eventId: 'e1',
      eventName: 'swap',
      listenerId: 'l1',
      persoId: 'slot-target',
    })

    const colorRequests = requests.filter((r) => r.property === 'color')
    // one per new face (2 changed cells)
    expect(colorRequests.length).toBe(2)
    colorRequests.forEach((r) => {
      expect(String(r.from)).toMatch(/^hsl\(/)
    })
  })

  it('produces deterministic durations/delays across runs (seek-safe)', () => {
    const collect = () => {
      document.body.innerHTML = ''
      const { el, parent } = mountText('hello')
      applySlotTextBefore(el, parent, 'letter')
      el.textContent = 'world'
      return applySlotTextAfter({
        el,
        command: makeCommand(),
        slot: slotUp.slot!,
        eventId: 'e1',
        eventName: 'swap',
        listenerId: 'l1',
        persoId: 'slot-target',
      }).map((r) => ({ d: r.duration, delay: r.delayMs, to: r.to, from: r.from }))
    }
    expect(collect()).toEqual(collect())
  })

  it('cancel removes the overlay and restores the element', () => {
    const { el, parent } = mountText('ab')
    applySlotTextBefore(el, parent, 'letter')
    el.textContent = 'cd'
    applySlotTextAfter({
      el,
      command: makeCommand(),
      slot: slotUp.slot!,
      eventId: 'e1',
      eventName: 'swap',
      listenerId: 'l1',
      persoId: 'slot-target',
    })
    expect(parent.querySelector('#slot-target-slot')).not.toBeNull()

    cancelSlotTextSession(el)
    expect(parent.querySelector('#slot-target-slot')).toBeNull()
    expect(el.style.visibility).not.toBe('hidden')
  })
})
