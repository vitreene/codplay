import { describe, expect, it } from 'vitest'
import {
  createComponentServices,
  RuntimeComponentServiceCatalog,
} from '../../../src/runtime/components'
import type { RuntimeModuleServiceInstance } from '../../../src/runtime/engine'

describe('component runtime services', () => {
  it('resolves declared services and player modules without applying modules as properties', () => {
    const catalog = new RuntimeComponentServiceCatalog()
    const applied: unknown[] = []
    catalog.register({
      id: 'probe',
      create: (context) => ({
        apply: (_node, value) => applied.push([context.componentId, value]),
      }),
    })
    const markup = {} as RuntimeModuleServiceInstance
    const services = createComponentServices(
      catalog,
      { componentId: 'main:item', storyId: 'main', componentType: 'test' },
      new Map([['markup', markup]]),
    )

    services.declare(['probe', 'markup'])
    services.apply({}, { probe: 42, markup: 'not-a-property-patch' })

    expect(applied).toEqual([['main:item', 42]])
  })

  it('rejects a component dependency that is neither a service nor a module', () => {
    const services = createComponentServices(
      new RuntimeComponentServiceCatalog(),
      { componentId: 'main:item', storyId: 'main', componentType: 'test' },
      new Map(),
    )

    expect(() => services.declare(['missing'])).toThrow(
      'Runtime component dependency is unavailable: missing',
    )
  })

  it('exposes content through the same service catalog', () => {
    const catalog = new RuntimeComponentServiceCatalog()
    const values: unknown[] = []
    catalog.register({
      id: 'content',
      create: () => ({ apply: (_node, value) => values.push(value) }),
    })
    const services = createComponentServices(
      catalog,
      { componentId: 'main:item', storyId: 'main', componentType: 'tag' },
      new Map(),
    )

    services.declare(['content'])
    services.content?.apply({}, 'hello')

    expect(values).toEqual(['hello'])
  })
})
