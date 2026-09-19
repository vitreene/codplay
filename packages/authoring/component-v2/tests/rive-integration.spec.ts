/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'
import type { ComponentAnimation, ComponentServices } from 'codplay'
import {
  RIVE_COMPONENTS,
  RIVE_ENGINE,
  RiveDocumentComponent,
  RiveStateMachineComponent,
  type RiveArtboard,
  type RiveFile,
  type RiveRuntime,
} from '../src'
import { registerRiveResource } from '../src/rive/rive-preload'

function emptyServices(): ComponentServices {
  return {
    declare: () => undefined,
    get: () => { throw new Error('No service is declared in this test.') },
    apply: () => undefined,
  }
}

describe('Rive V2 integration', () => {
  it('declares separate document and state-machine components', () => {
    expect(RIVE_ENGINE.libraries?.register).toHaveLength(1)
    expect(RIVE_COMPONENTS.map((definition) => definition.type)).toEqual(['rive', 'rive-state-machine'])
    expect(RIVE_COMPONENTS[0]?.libraries).toEqual(['rive'])
  })

  it('plays a prepared document from absolute CodPlay time and redraws on commit', () => {
    const artboard = createArtboard()
    const runtime = createRuntime(artboard)
    registerRiveResource('/demo.riv', { runtime, file: createFile(artboard) })
    const component = createComponent(runtime)
    const animations: ComponentAnimation[] = []
    component.initialize()

    component.update({
      state: {},
      timeMs: 0,
      activeActions: [],
      registerAnimation: (animation) => animations.push(animation),
    })
    animations[0]?.sample(0)?.apply()
    animations[1]?.sample(0)?.apply()
    animations[1]?.sample(1_000)?.apply()
    animations[2]?.sample(1_000)?.apply()

    expect(artboard.advance).toHaveBeenCalledWith(1)
    expect(artboard.draw).toHaveBeenCalledTimes(1)
    expect(runtime.resolveAnimationFrame).toHaveBeenCalledTimes(1)

    component.destroy()
  })

  it('drives a state machine attached to the host target and maps one viseme input', () => {
    const artboard = createArtboard()
    const runtime = createRuntime(artboard)
    registerRiveResource('/state-machine.riv', { runtime, file: createFile(artboard) })
    const document = createComponent(runtime, '/state-machine.riv')
    const stateMachine = new RiveStateMachineComponent({
      services: emptyServices(),
      runtime: { getLibrary: () => runtime },
      perso: {
        id: 'lip-sync',
        storyId: 'main',
        initial: {
          stateMachine: 'Coach machine',
          lipSyncInput: 'lips sync id',
        },
        actions: { start: { broadcast: { type: 'START' } } },
      },
    } as never)
    const animations: ComponentAnimation[] = []
    document.initialize()
    stateMachine.update({
      state: {},
      timeMs: 0,
      target: document.getTarget(),
      activeActions: [
        { name: 'start', startAt: 0, elapsedMs: 0, action: { broadcast: { type: 'START' } } },
        { name: 'viseme', startAt: 0, elapsedMs: 0, action: { viseme: 'PP' } },
      ],
      registerAnimation: (animation) => animations.push(animation),
    })
    animations[0]?.sample(0)?.apply()
    animations[0]?.sample(1_000)?.apply()

    expect(artboard.stateMachineByName).toHaveBeenCalledWith('Coach machine')
    expect(artboard.lastStateMachineInput?.value).toBe(2)
    expect(artboard.lastStateMachineAdvance).toHaveBeenCalledWith(1)

    stateMachine.destroy()
    document.destroy()
  })

  it('keeps the document target stable while a seek rebuilds the artboard', () => {
    const firstArtboard = createArtboard()
    const secondArtboard = createArtboard()
    const artboards = [firstArtboard, secondArtboard]
    const runtime = createRuntime(firstArtboard)
    const file: RiveFile = {
      defaultArtboard: () => artboards.shift() ?? secondArtboard,
      artboardByName: () => artboards.shift() ?? secondArtboard,
    }
    registerRiveResource('/seek.riv', { runtime, file })
    const component = createComponent(runtime, '/seek.riv')
    component.initialize()
    const target = component.getTarget()
    component.update({ state: {}, timeMs: 1_000, activeActions: [] })
    component.update({ state: {}, timeMs: 250, activeActions: [] })

    expect(target).toBe(component.getTarget())
    expect(target.getRevision()).toBe(2)
    expect(target.getArtboard()).toBe(secondArtboard)
    component.destroy()
  })

  it('projects START, PAUSE, and STOP broadcasts without owning a clock', () => {
    const artboard = createArtboard()
    const runtime = createRuntime(artboard)
    registerRiveResource('/actions.riv', { runtime, file: createFile(artboard) })
    const component = createComponent(runtime, '/actions.riv')
    component.initialize()

    component.update({
      state: {},
      timeMs: 0,
      activeActions: [{ name: 'pause', startAt: 0, elapsedMs: 0, action: { broadcast: { type: 'PAUSE' } } }],
    })
    component.update({ state: {}, timeMs: 1_000, activeActions: [] })
    expect(artboard.advance).not.toHaveBeenCalled()

    component.update({
      state: {},
      timeMs: 1_000,
      activeActions: [{ name: 'start', startAt: 1_000, elapsedMs: 0, action: { broadcast: { type: 'START' } } }],
    })
    component.update({ state: {}, timeMs: 2_000, activeActions: [] })
    expect(artboard.advance).toHaveBeenCalledWith(1)

    component.update({
      state: {},
      timeMs: 2_000,
      activeActions: [{ name: 'stop', startAt: 2_000, elapsedMs: 0, action: { broadcast: { type: 'STOP' } } }],
    })
    expect(component.getTarget().getRevision()).toBe(2)
    component.destroy()
  })
})

/** Creates a materialized host with the injected fake runtime. */
function createComponent(runtime: RiveRuntime, src = '/demo.riv'): RiveDocumentComponent {
  const component = new RiveDocumentComponent({
    services: emptyServices(),
    runtime: { getLibrary: () => runtime },
    perso: { id: 'rive', storyId: 'main', initial: { src } },
  } as never)
  component._materialize(document.createElement('canvas'), [])
  return component
}

/** Creates the fake file boundary used by the component tests. */
function createFile(artboard: RiveArtboard): RiveFile {
  return {
    defaultArtboard: () => artboard,
    artboardByName: () => artboard,
  }
}

/** Creates one observable artboard without imposing Rive internals on CodPlay. */
type TestRiveArtboard = RiveArtboard & {
  lastStateMachineInput: {
    name: string
    value: number | boolean | undefined
    asNumber(): TestRiveArtboard['lastStateMachineInput']
  }
  lastStateMachineAdvance: (seconds: number) => unknown
}

function createArtboard(): TestRiveArtboard {
  const stateMachineByName = vi.fn(() => ({ id: 'state-machine' }))
  const lastStateMachineInput = {
    name: 'lips sync id',
    value: 0 as number | boolean | undefined,
    asNumber: vi.fn(function () { return lastStateMachineInput }),
  }
  const lastStateMachineAdvance = vi.fn(() => true)
  return {
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    advance: vi.fn(() => true),
    draw: vi.fn(),
    animationCount: () => 0,
    animationByIndex: () => undefined,
    animationByName: () => undefined,
    stateMachineByName,
    delete: vi.fn(),
    lastStateMachineInput,
    lastStateMachineAdvance,
  }
}

/** Creates the minimal injected runtime needed by the component contract. */
function createRuntime(artboard: TestRiveArtboard): RiveRuntime {
  class AnimationInstance {
    advance(): boolean { return true }
    apply(): void {}
    delete(): void {}
  }

  class StateMachineInstance {
    private readonly inputValue = artboard.lastStateMachineInput

    advance(seconds: number): boolean {
      artboard.lastStateMachineAdvance(seconds)
      return true
    }

    inputCount(): number { return 1 }
    input(): typeof this.inputValue { return this.inputValue }
    delete(): void {}
  }

  return {
    load: vi.fn(async () => createFile(artboard)),
    makeRenderer: vi.fn(() => ({
      clear: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      align: vi.fn(),
      delete: vi.fn(),
    })),
    LinearAnimationInstance: AnimationInstance,
    StateMachineInstance,
    Fit: {
      fill: 'fill', contain: 'contain', cover: 'cover', fitWidth: 'fitWidth',
      fitHeight: 'fitHeight', none: 'none', scaleDown: 'scaleDown', layout: 'layout',
    },
    Alignment: {
      topLeft: 'topLeft', topCenter: 'topCenter', topRight: 'topRight',
      centerLeft: 'centerLeft', center: 'center', centerRight: 'centerRight',
      bottomLeft: 'bottomLeft', bottomCenter: 'bottomCenter', bottomRight: 'bottomRight',
    },
    resolveAnimationFrame: vi.fn(),
  }
}
