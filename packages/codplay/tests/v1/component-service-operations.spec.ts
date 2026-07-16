import { describe, expect, it } from 'vitest'

import type { AnimationAdapter, AnimationHandle, AnimationOperation, AnimationResolvedAction } from '../../src/animation/types'
import { PlayerFacade } from '../../src/player/create-player'
import { RendererFacade } from '../../src/renderer/create-renderer'
import type {
  RuntimeComponent,
  RuntimeComponentClassInput,
  RuntimeComponentUpdateInput,
  ServiceApplyContext,
  ServiceInstance,
} from '../../src/runtime/components'
import type { RuntimePersos } from '../../src/runtime/types'

class ServiceProbeComponent implements RuntimeComponent {
  public node: unknown = { style: {}, attributes: {} }
  readonly modules: RuntimeComponentClassInput['modules']
  private readonly input: RuntimeComponentClassInput

  constructor(input: RuntimeComponentClassInput) {
    this.input = input
    this.modules = input.modules
    input.services.declare(['probe'])
  }

  render(): Node {
    return this.node as Node
  }

  _init(): void {
    this.node = this.render()
  }

  update(input: RuntimeComponentUpdateInput): void {
    this.input.services.apply(this.node, input.action, input.serviceContext)
  }
}

function getOperationId(operation: AnimationOperation): string {
  return 'operationId' in operation ? operation.operationId : operation.transitionId
}

function createRuntimePersos(): RuntimePersos {
  return {
    id: 'runtime-service-probe',
    persos: {
      probe: {
        id: 'probe',
        storyId: 'story-main',
        type: 'service-probe',
        initial: {},
        actions: {},
      },
    },
  }
}

describe('V1 - component service animation operations', () => {
  it('passes service context and routes emitted animation operations to the central adapter', () => {
    const contexts: ServiceApplyContext[] = []
    const recordedBatches: AnimationOperation[][] = []
    const probeService: ServiceInstance = {
      apply(node, value, context) {
        if (value !== true || context === undefined) {
          return
        }

        contexts.push(context)
        context.output.animationOperations.push({
          transitionId: 'probe-transition',
          eventId: context.eventId,
          eventName: context.eventName,
          listenerId: context.listenerId,
          property: 'opacity',
          target: node,
          to: 1,
          duration: 120,
        })
      },
    }
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
      coreServices: [{ name: 'probe', service: probeService }],
    })

    expect(renderer.component.register({ type: 'service-probe', component: ServiceProbeComponent })).toMatchObject({ ok: true })
    expect(renderer.load({ runtimePersos: createRuntimePersos() })).toEqual({ ok: true })
    expect(renderer.enqueueCommit({
      commitSeq: 1,
      applyAtMs: 75,
      target: { itemId: 'probe' },
      causeEventId: 'event-1',
      operations: [{
        eventId: 'event-1',
        eventName: 'probe:run',
        listenerId: 'probe',
        actionKey: 'probe:run',
        action: { probe: true } as unknown as AnimationResolvedAction['action'],
      }],
    })).toEqual({ ok: true })

    expect(renderer.tick(75)).toMatchObject({
      appliedCommitCount: 1,
      appliedActionCount: 1,
      animationAppliedCount: 1,
    })
    expect(contexts[0]).toMatchObject({
      eventId: 'event-1',
      eventName: 'probe:run',
      eventMs: 75,
      eventSeq: 1,
      listenerId: 'probe',
      persoId: 'probe',
      isSeekReplay: false,
    })
    expect(recordedBatches).toHaveLength(1)
    expect(recordedBatches[0]?.[0]).toMatchObject({
      transitionId: 'probe-transition',
      eventId: 'event-1',
      eventName: 'probe:run',
      listenerId: 'probe',
      property: 'opacity',
      to: 1,
      duration: 120,
    })
  })

  it('expands third-party binding services into the player service registry', () => {
    const service: ServiceInstance = { apply: () => undefined }
    const player = new PlayerFacade({
      bindings: [{ components: {}, services: [{ name: 'binding-probe', service }] }],
    })

    expect(player.service.register({ name: 'binding-probe', service })).toMatchObject({
      ok: false,
      error: { code: 'RUNTIME_SERVICE_ALREADY_REGISTERED' },
    })
  })
})
