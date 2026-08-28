// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import type { AnimationAdapter, AnimationHandle, AnimationOperation } from '../../src/animation/types'
import { createAnimeSvgService } from '../../src/runtime/components'
import { RendererFacade } from '../../src/renderer/create-renderer'
import type { RuntimeComponent, RuntimeComponentClassInput, RuntimeComponentUpdateInput } from '../../src/runtime/components'
import type { RuntimePersos } from '../../src/runtime/types'

const SVG_NS = 'http://www.w3.org/2000/svg'

class AnimeSvgProbeComponent implements RuntimeComponent {
  public node: SVGPathElement = document.createElementNS(SVG_NS, 'path')
  private readonly toNode: SVGPathElement = document.createElementNS(SVG_NS, 'path')
  readonly modules: RuntimeComponentClassInput['modules']
  private readonly input: RuntimeComponentClassInput

  constructor(input: RuntimeComponentClassInput) {
    this.input = input
    this.modules = input.modules
    this.node.setAttribute('d', 'M0 0 L10 0')
    this.toNode.setAttribute('d', 'M0 0 L20 20')
  }

  render(): Node {
    return this.node
  }

  _init(): void {
    this.node = this.render() as SVGPathElement
  }

  update(input: RuntimeComponentUpdateInput): void {
    this.input.services.animeSvg?.morphTo({
      target: this.node,
      to: this.toNode,
      duration: 240,
      precision: 0,
    }, input.serviceContext)
  }
}

function createRuntimePersos(): RuntimePersos {
  return {
    id: 'runtime-anime-svg-probe',
    persos: {
      probe: {
        id: 'probe',
        storyId: 'story-main',
        type: 'anime-svg-probe',
        initial: {},
        actions: {},
      },
    },
  }
}

function getOperationId(operation: AnimationOperation): string {
  return 'operationId' in operation ? operation.operationId : operation.transitionId
}

describe('V1 - animeSvg service', () => {
  it('emits morphTo operations through ComponentServices into the central adapter', () => {
    const recordedBatches: AnimationOperation[][] = []
    const animationAdapter: AnimationAdapter = {
      run(operations) {
        recordedBatches.push(operations)
        return operations.map<AnimationHandle>((operation) => ({
          transitionId: getOperationId(operation),
          target: operation.target,
          stop: () => undefined,
        }))
      },
      stop: () => undefined,
    }
    const renderer = new RendererFacade({
      animationAdapter,
      coreServices: [{ name: 'animeSvg', service: createAnimeSvgService() }],
    })

    expect(renderer.component.register({ type: 'anime-svg-probe', component: AnimeSvgProbeComponent })).toMatchObject({ ok: true })
    expect(renderer.load({ runtimePersos: createRuntimePersos() })).toEqual({ ok: true })
    expect(renderer.enqueueCommit({
      commitSeq: 1,
      applyAtMs: 0,
      target: { itemId: 'probe' },
      operations: [{
        eventId: 'event-1',
        eventName: 'probe:morph',
        listenerId: 'probe',
        actionKey: 'probe:morph',
        action: { morph: true },
      }],
    })).toEqual({ ok: true })

    expect(renderer.tick(0)).toMatchObject({
      appliedCommitCount: 1,
      appliedActionCount: 1,
      animationAppliedCount: 1,
    })
    expect(recordedBatches).toHaveLength(1)
    expect(recordedBatches[0]?.[0]).toMatchObject({
      kind: 'anime-svg:morphTo',
      operationId: 'anime-svg:morphTo:event-1:probe:probe:0',
      eventId: 'event-1',
      eventName: 'probe:morph',
      listenerId: 'probe',
      property: 'd',
      duration: 240,
      precision: 0,
      finalValue: 'M0 0 L20 20',
    })
  })
})
