import { describe, expect, it, vi } from 'vitest'
import { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import type { RuntimeComponentDefinition } from '../../../src/runtime/catalog'
import { BaseHTMLComponent } from '../../../src/runtime/components'
import type { ComponentUpdateInput } from '../../../src/runtime/components'
import type { RuntimeMaterializer } from '../../../src/runtime/materializer'

class ProbeComponent extends BaseHTMLComponent<Record<string, unknown>> {
  static readonly declaredServices = ['probe'] as const

  constructor(input: ConstructorParameters<typeof BaseHTMLComponent<Record<string, unknown>>>[0]) {
    super(input)
    this.services.declare(ProbeComponent.declaredServices)
  }

  render(): string {
    return '<section></section>'
  }

  update(input: ComponentUpdateInput): void {
    this.services.apply(this.node, input.state)
  }
}

class NoServiceProbeComponent extends BaseHTMLComponent<Record<string, unknown>> {
  static readonly declaredServices = [] as const

  render(): string {
    return '<section></section>'
  }

  update(_input: ComponentUpdateInput): void {}
}

function materializer(id = 'test'): RuntimeMaterializer {
  return {
    id,
    context: {},
    materializeComponent: () => ({ destroy: () => undefined }),
    materializeScene: () => undefined,
  }
}

function componentDefinition(component: RuntimeComponentDefinition['component'] = ProbeComponent) {
  return {
    type: 'probe',
    component,
    modules: [],
    validateInitial: () => undefined,
  }
}

describe('RuntimeCapabilityCatalog', () => {
  it('creates only the services declared by a component and applies their patch', () => {
    const catalog = new RuntimeCapabilityCatalog()
    const applied: unknown[] = []
    const unusedFactory = vi.fn(() => ({ apply: () => undefined }))

    catalog.registerService({
      name: 'probe',
      materializers: ['test'],
      create: (context) => ({
        apply: (_node, value) => applied.push([context.componentId, value]),
      }),
    })
    catalog.registerService({
      name: 'unused',
      materializers: ['test'],
      create: unusedFactory,
    })
    catalog.registerComponent(componentDefinition())

    const component = catalog.createComponent(
      'probe',
      { perso: { id: 'item', storyId: 'main', initial: {} } },
      { componentId: 'main:item', storyId: 'main', componentType: 'probe' },
      materializer(),
      new Map(),
    )

    component.update({ state: { probe: 42 }, timeMs: 0 })

    expect(applied).toEqual([['main:item', 42]])
    expect(unusedFactory).not.toHaveBeenCalled()
  })

  it('rejects a service that is not available for the selected materializer', () => {
    const catalog = new RuntimeCapabilityCatalog()
    catalog.registerService({ name: 'probe', materializers: ['html'], create: () => ({ apply: () => undefined }) })
    catalog.registerComponent(componentDefinition())

    expect(() => catalog.createComponent(
      'probe',
      { perso: { id: 'item', storyId: 'main', initial: {} } },
      { componentId: 'main:item', storyId: 'main', componentType: 'probe' },
      materializer(),
      new Map(),
    )).toThrow('Runtime service "probe" is not available for materializer "test"')
  })

  it('derives the validation snapshot from the same registrations used at runtime', () => {
    const catalog = new RuntimeCapabilityCatalog()
    const validateInitial = vi.fn()
    catalog.registerService({ name: 'probe', materializers: ['test'], create: () => ({ apply: () => undefined }) })
    catalog.registerComponent({ ...componentDefinition(), validateInitial })

    const snapshot = catalog.validationSnapshot()

    expect(snapshot.components.get('probe')).toMatchObject({ type: 'probe', services: ['probe'] })
    expect(snapshot.services.get('probe')).toMatchObject({ name: 'probe' })
    expect(snapshot.components.get('probe')?.validateInitial).toBe(validateInitial)
  })

  it('supports explicit overrides before locking the CodPlay instance', () => {
    const catalog = new RuntimeCapabilityCatalog()
    catalog.registerComponent(componentDefinition())
    catalog.overrideComponent(componentDefinition(NoServiceProbeComponent))

    expect(catalog.getComponent('probe')?.component).toBe(NoServiceProbeComponent)
    catalog.lock()
    expect(() => catalog.overrideComponent(componentDefinition())).toThrow('Runtime capability catalog is locked.')
  })
})
