import { applyAttrProps, applyClassNameProps, applyStyleProps, setTextContent } from './dom'
import type { AnimationOperation } from '../../../animation/types'
import type { AnimeSvgService } from './anime-svg-service'

/**
 * Collects operations emitted while services apply one component update.
 */
export type RuntimeServiceOutput = {
  animationOperations: AnimationOperation[]
}

/**
 * Describes the runtime metadata available to services during an update.
 */
export type ServiceApplyContext = {
  eventId: string
  eventName: string
  eventSeq: number
  listenerId: string
  persoId: string
  isSeekReplay: boolean
  output: RuntimeServiceOutput
}

/**
 * Describes the minimal contract of one injectable component service.
 */
export type ServiceInstance = {
  apply: (node: unknown, value: unknown, context?: ServiceApplyContext) => void
}

/**
 * Describes the services object injected into every component.
 */
export type ComponentServices = {
  declare(names: readonly string[]): void
  apply(node: unknown, patch: Record<string, unknown>, context?: ServiceApplyContext): void
  readonly className?: ServiceInstance
  readonly style?: ServiceInstance
  readonly attr?: ServiceInstance
  readonly content?: ServiceInstance
  readonly animeSvg?: AnimeSvgService
  readonly [name: string]: unknown
}

/**
 * Default ordered list of services applied by most components.
 */
export const COMPONENT_DEFAULT_SERVICES = ['className', 'style', 'attr'] as const

export const CORE_SERVICES: Record<string, ServiceInstance> = {
  className: {
    apply: (node, value) => applyClassNameProps(node, value as Parameters<typeof applyClassNameProps>[1])
  },
  style: {
    apply: (node, value) => applyStyleProps(node, value as Parameters<typeof applyStyleProps>[1], { skipTransitionValues: true })
  },
  attr: {
    apply: (node, value) => applyAttrProps(node, value as Parameters<typeof applyAttrProps>[1])
  },
  content: {
    apply: (node, value) => {
      if (typeof value === 'string' || typeof value === 'number') {
        setTextContent(node, String(value))
      }
    }
  }
}

/**
 * Creates one ComponentServices instance for one component from one shared service registry.
 * Each component gets its own instance with an independent declared service order.
 */
export function createComponentServices(serviceRegistry: Map<string, ServiceInstance>): ComponentServices {
  const registry = new Map<string, ServiceInstance>(serviceRegistry)
  const declaredOrder: string[] = []

  const services: ComponentServices = {
    declare(names: readonly string[]): void {
      declaredOrder.length = 0
      for (const name of names) {
        if (registry.has(name)) {
          declaredOrder.push(name)
        }
      }
    },

    apply(node: unknown, patch: Record<string, unknown>, context?: ServiceApplyContext): void {
      for (const name of declaredOrder) {
        const value = patch[name]
        if (value !== undefined) {
          registry.get(name)?.apply(node, value, context)
        }
      }
    },

    get className() { return registry.get('className') },
    get style() { return registry.get('style') },
    get attr() { return registry.get('attr') },
    get content() { return registry.get('content') }
  }

  for (const name of registry.keys()) {
    if (name in services) {
      continue
    }

    Object.defineProperty(services, name, {
      enumerable: true,
      configurable: false,
      get() { return registry.get(name) }
    })
  }

  return services
}
