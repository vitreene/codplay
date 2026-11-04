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
    expect(RIVE_COMPONENTS.map((definition) => definition.type)).toEqual(['rive', 'rive-state-machine', 'rive-view-model'])
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

  it('drives a state machine attached to the host target and applies named inputs', () => {
    const artboard = createArtboard()
    const runtime = createRuntime(artboard)
    registerRiveResource('/state-machine.riv', { runtime, file: createFile(artboard) })
    const document = createComponent(runtime, '/state-machine.riv')
    const stateMachine = new RiveStateMachineComponent({
      services: emptyServices(),
      runtime: { getLibrary: () => runtime },
      perso: {
        id: 'state-machine',
        storyId: 'main',
        initial: {
          stateMachine: 'Coach machine',
          inputs: { blend: 0 },
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
        { name: 'input', startAt: 0, elapsedMs: 0, action: { inputs: { blend: 2 } } },
      ],
      registerAnimation: (animation) => animations.push(animation),
    })
    animations[0]?.sample(0)?.apply()
    animations[0]?.sample(1_000)?.apply()

    expect(artboard.stateMachineLookups).toContain('Coach machine')
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
      viewModelByName: () => null,
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

  it('keeps native frame deltas when a START occurrence remains active across visemes', () => {
    const artboard = createArtboard()
    const runtime = createRuntime(artboard)
    registerRiveResource('/persistent-start.riv', { runtime, file: createFile(artboard) })
    const document = createComponent(runtime, '/persistent-start.riv')
    const stateMachine = new RiveStateMachineComponent({
      services: emptyServices(),
      runtime: { getLibrary: () => runtime },
      perso: {
        id: 'state-machine',
        storyId: 'main',
        initial: { stateMachine: 'Coach machine' },
        actions: { start: { broadcast: { type: 'START' } } },
      },
    } as never)
    document.initialize()

    const start = {
      name: 'start', startAt: 0, elapsedMs: 0,
      action: { broadcast: { type: 'START' } },
    }
    stateMachine.update({
      state: {}, timeMs: 0, target: document.getTarget(), activeActions: [start],
    })
    stateMachine.update({
      state: {}, timeMs: 100, target: document.getTarget(),
      activeActions: [start, { name: 'viseme', startAt: 100, elapsedMs: 0, action: { inputs: { blend: 1 } } }],
    })
    stateMachine.update({
      state: {}, timeMs: 200, target: document.getTarget(),
      activeActions: [
        start,
        { name: 'viseme', startAt: 100, elapsedMs: 100, action: { inputs: { blend: 1 } } },
        { name: 'viseme', startAt: 200, elapsedMs: 0, action: { inputs: { blend: 2 } } },
      ],
    })

    const advances = vi.mocked(artboard.lastStateMachineAdvance).mock.calls
      .map(([seconds]) => seconds)
    expect(advances).toEqual([0.1, 0.1])
    expect(artboard.lastStateMachineInput.value).toBe(2)

    stateMachine.destroy()
    document.destroy()
  })

  it('recreates a native machine only once while a STOP occurrence remains active', () => {
    const artboard = createArtboard()
    const runtime = createRuntime(artboard)
    registerRiveResource('/persistent-stop.riv', { runtime, file: createFile(artboard) })
    const document = createComponent(runtime, '/persistent-stop.riv')
    const stateMachine = new RiveStateMachineComponent({
      services: emptyServices(),
      runtime: { getLibrary: () => runtime },
      perso: {
        id: 'state-machine',
        storyId: 'main',
        initial: { stateMachine: 'Coach machine' },
        actions: { stop: { broadcast: { type: 'STOP' } } },
      },
    } as never)
    document.initialize()
    const stop = {
      name: 'stop', startAt: 100, elapsedMs: 0,
      action: { broadcast: { type: 'STOP' } },
    }

    stateMachine.update({
      state: {}, timeMs: 100, target: document.getTarget(), activeActions: [stop],
    })
    stateMachine.update({
      state: {}, timeMs: 200, target: document.getTarget(), activeActions: [stop],
    })

    expect(artboard.stateMachineLookups).toHaveLength(2)
    stateMachine.destroy()
    document.destroy()
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
    viewModelByName: () => null,
    defaultArtboard: () => artboard,
    artboardByName: () => artboard,
  }
}

/** Creates one observable artboard without imposing Rive internals on CodPlay. */
type TestRiveArtboard = RiveArtboard & {
  stateMachineLookups: string[]
  lastStateMachineInput: {
    name: string
    value: number | boolean | undefined
  }
  lastStateMachineAdvance: (seconds: number) => unknown
}

function createArtboard(): TestRiveArtboard {
  const stateMachineLookups: string[] = []
  /** Records the native machine requested by the component. */
  const stateMachineByName = (name: string) => {
    stateMachineLookups.push(name)
    return { id: 'state-machine' }
  }
  const lastStateMachineInput = {
    name: 'blend',
    value: 0 as number | boolean | undefined,
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
    stateMachineLookups,
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
    bindViewModelInstance(): void {}
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
