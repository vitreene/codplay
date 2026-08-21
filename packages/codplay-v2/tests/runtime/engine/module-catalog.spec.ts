import { describe, expect, it } from 'vitest'

import { DiagnosticCollector } from '../../../src/diagnostics'
import { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import { RuntimeEngine } from '../../../src/runtime/engine'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-01T00:00:00.000Z',
  scene: { id: 'module-scene', stories: {}, listen: [], tracks: {} },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
  actionTargetIndex: {},
}

describe('RuntimeCapabilityCatalog modules', () => {
  it('creates one independent module-service instance per player', () => {
    const catalog = new RuntimeCapabilityCatalog()
    const contexts: string[] = []
    catalog.registerModule({
      id: 'list',
      create: ({ playerId }) => {
        contexts.push(playerId)
        return { destroy: () => undefined }
      },
    })
    const engine = new RuntimeEngine(catalog)

    const first = engine.createModuleServiceInstances('first', scene, ['list'])
    const second = engine.createModuleServiceInstances('second', scene, ['list'])

    expect(contexts).toEqual(['first', 'second'])
    expect(first.get('list')).not.toBe(second.get('list'))
  })

  it('reports a declared module unavailable when its definition is not registered', () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const diagnostics = new DiagnosticCollector({ output: () => undefined })

    engine.validateRequirements({ components: [], services: [], modules: ['list'], resources: [] }, diagnostics)

    expect(diagnostics.report().errors[0]?.code).toBe('RUNTIME_MODULE_UNAVAILABLE')
  })

  it('rejects duplicate module definitions', () => {
    const catalog = new RuntimeCapabilityCatalog()
    const definition = { id: 'list', create: () => ({}) }
    catalog.registerModule(definition)

    expect(() => catalog.registerModule(definition)).toThrow('Runtime module already registered: list')
  })
})
