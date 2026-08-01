import { describe, expect, it } from 'vitest'

import { DiagnosticCollector } from '../../../src/diagnostics'
import { RuntimeEngine, RuntimeModuleServiceCatalog } from '../../../src/runtime/engine'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-01T00:00:00.000Z',
  scene: { id: 'module-scene', stories: {}, listen: [], tracks: {} },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
}

describe('RuntimeModuleServiceCatalog', () => {
  it('creates one independent module-service instance per player', () => {
    const catalog = new RuntimeModuleServiceCatalog()
    const contexts: string[] = []
    catalog.register({
      id: 'list',
      create: ({ playerId }) => {
        contexts.push(playerId)
        return { destroy: () => undefined }
      },
    })
    const engine = new RuntimeEngine(
      { components: [], services: [], modules: ['list'], resources: [] },
      { moduleServiceCatalog: catalog },
    )

    const first = engine.createModuleServiceInstances('first', scene, ['list'])
    const second = engine.createModuleServiceInstances('second', scene, ['list'])

    expect(contexts).toEqual(['first', 'second'])
    expect(first.get('list')).not.toBe(second.get('list'))
  })

  it('reports a declared module unavailable when its definition is not registered', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: ['list'], resources: [] })
    const diagnostics = new DiagnosticCollector({ output: () => undefined })

    engine.validateRequirements({ components: [], services: [], modules: ['list'], resources: [] }, diagnostics)

    expect(diagnostics.report().errors[0]?.code).toBe('RUNTIME_MODULE_UNAVAILABLE')
  })

  it('rejects duplicate module definitions', () => {
    const catalog = new RuntimeModuleServiceCatalog()
    const definition = { id: 'list', create: () => ({}) }
    catalog.register(definition)

    expect(() => catalog.register(definition)).toThrow('Runtime module service already registered: list')
  })
})
