/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import type { ComponentServices } from 'codplay'
import { RiveViewModelComponent, type RiveViewModelInitial } from '../src/rive'
import { createViewModelFixture } from './rive/view-model-fixture'

/** Supplies the real component with a test-owned native target and configuration. */
function createControl(initial: Partial<RiveViewModelInitial> = {}) {
  const fixture = createViewModelFixture()
  const artboard = fixture.file.defaultArtboard()
  const services: ComponentServices = { declare() {}, apply() {}, get() { throw new Error('No component service expected.') } }
  const component = new RiveViewModelComponent({
    services,
    perso: { id: 'control', storyId: 'main', initial: { stateMachine: 'Machine', viewModel: 'Expression', instance: 'Exported pose', ...initial } },
  } as never)
  const target = { getFile: () => fixture.file, getArtboard: () => artboard, getRuntime: () => fixture.runtime, getRevision: () => 0, prepareArtboard() {}, invalidate() {}, onArtboardRelease: () => () => {} }
  return { ...fixture, component, target }
}

describe('Rive ViewModel projection', () => {
  it('shares native transport while still presenting values during pause', () => {
    const { component, target, artboards, machines } = createControl({ values: { turn: 20 } })
    component.update({ target, timeMs: 100, state: { values: { turn: 4 } } })
    component.update({ target, timeMs: 200, state: { values: { turn: 8 } }, activeActions: [
      { name: 'pause', startAt: 200, elapsedMs: 0, action: { broadcast: { type: 'PAUSE' } } },
    ] })
    expect(artboards[0]?.presented.turn).toBe(8)
    expect(machines[0]?.advances.at(-1)).toBe(0)
    component.update({ target, timeMs: 300, state: { values: { turn: 8 } }, activeActions: [
      { name: 'stop', startAt: 300, elapsedMs: 0, action: { broadcast: { type: 'STOP' } } },
    ] })
    expect(machines[0]?.deleted).toBe(true)
    expect(artboards[0]?.presented.turn).toBe(20)
    component.update({ target, timeMs: 400, state: { values: { turn: 6 } }, activeActions: [
      { name: 'start', startAt: 300, elapsedMs: 100, action: { broadcast: { type: 'START' } } },
    ] })
    expect(artboards[0]?.presented.turn).toBe(6)
    expect(machines[1]?.advances.at(-1)).toBe(0.1)
    component.destroy()
  })

  it('applies resolved values at zero delta and restores defaults for removed future contributions', () => {
    const { component, target, artboards, instances } = createControl({ values: { turn: 20 } })
    component.update({ target, timeMs: 800, state: { values: { neutral: 0, vowel: 1, speaking: true } } })
    expect(artboards[0]?.presented).toEqual({ neutral: 0, vowel: 1, turn: 20, headX: 50, speaking: true })
    component.update({ target, timeMs: 100, state: { values: { turn: 4 } } })
    expect(instances[0]?.deleted).toBe(true)
    expect(artboards[0]?.presented).toEqual({ neutral: 1, vowel: 0, turn: 4, headX: 50, speaking: false })
    component.update({ target, timeMs: 100, state: {} })
    expect(artboards[0]?.presented).toEqual({ neutral: 1, vowel: 0, turn: 20, headX: 50, speaking: false })
    component.destroy()
    expect(instances.every((instance) => instance.deleted)).toBe(true)
  })

  it('smooths mouth weights and head values at absolute time while booleans change immediately', () => {
    const { component, target, artboards } = createControl({
      blendSpeed: 18,
      values: { neutral: 1, vowel: 0, turn: 20, headX: 50, speaking: false },
    })
    const actions = [
      { name: 'speak', startAt: 100, elapsedMs: 50, action: { values: { neutral: 0, vowel: 1, turn: 80, headX: 70, speaking: true } } },
    ]
    const resolvedSpeech = { neutral: 0, vowel: 1, turn: 80, headX: 70, speaking: true }
    component.update({ target, timeMs: 150, state: { values: resolvedSpeech }, activeActions: actions })
    const speechProgress = 1 - Math.exp(-18 * 0.05)
    expect(artboards[0]?.presented.neutral).toBeCloseTo(1 - speechProgress)
    expect(artboards[0]?.presented.vowel).toBeCloseTo(speechProgress)
    expect(artboards[0]?.presented.turn).toBeCloseTo(20 + 60 * speechProgress)
    expect(artboards[0]?.presented.headX).toBeCloseTo(50 + 20 * speechProgress)
    expect(artboards[0]?.presented.speaking).toBe(true)

    const actionsWithRest = [
      ...actions,
      { name: 'rest', startAt: 200, elapsedMs: 50, action: { values: { neutral: 1, vowel: 0, turn: 20, headX: 50, speaking: false } } },
    ]
    const resolvedRest = { neutral: 1, vowel: 0, turn: 20, headX: 50, speaking: false }
    component.update({ target, timeMs: 250, state: { values: resolvedRest }, activeActions: actionsWithRest })
    const firstCueRemaining = Math.exp(-18 * 0.1)
    const secondCueRemaining = Math.exp(-18 * 0.05)
    const vowelAtRest = 1 - firstCueRemaining
    expect(artboards[0]?.presented.vowel).toBeCloseTo(vowelAtRest * secondCueRemaining)
    expect(artboards[0]?.presented.headX).toBeCloseTo(
      50 + (70 + (50 - 70) * firstCueRemaining - 50) * secondCueRemaining,
    )
    expect(artboards[0]?.presented.speaking).toBe(false)

    component.update({ target, timeMs: 150, state: { values: resolvedSpeech }, activeActions: actions })
    expect(artboards[0]?.presented.vowel).toBeCloseTo(speechProgress)
    expect(artboards[0]?.presented.headX).toBeCloseTo(50 + 20 * speechProgress)
    component.destroy()
  })

  it('reports an absent native selection before applying a partial binding', () => {
    const control = createControl({ viewModel: 'Missing' })
    expect(() => control.component.update({ target: control.target, timeMs: 0, state: {} })).toThrow('ViewModel "Missing" was not found')
    control.component.destroy()
    const instance = createControl({ instance: 'Missing' })
    expect(() => instance.component.update({ target: instance.target, timeMs: 0, state: {} })).toThrow('Expression/Missing')
    instance.component.destroy()
  })

  it.each([
    [{ missing: 1 }, 'no supported property "missing"'],
    [{ speaking: 1 }, 'requires boolean'],
    [{ turn: true }, 'requires number'],
  ])('diagnoses invalid native values %j', (values, message) => {
    const { component, target } = createControl()
    expect(() => component.update({ target, timeMs: 0, state: { values } })).toThrow(message)
    component.destroy()
  })
})
