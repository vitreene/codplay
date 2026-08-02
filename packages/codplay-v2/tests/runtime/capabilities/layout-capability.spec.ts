import { describe, expect, it } from 'vitest'
import {
  createLayoutModuleServiceDefinition,
  LayoutCapabilityState,
  registerMaterializedComponent,
  unregisterMaterializedComponent,
} from '../../../src/runtime/capabilities/layout'
import type { LayoutModuleServiceInstance } from '../../../src/runtime/capabilities/layout'
import { RuntimeModuleServiceCatalog } from '../../../src/runtime/engine'
import type { CompiledScene } from '../../../src/scene/compiled'

function registration(componentId: string, componentType: string, partId: string) {
  return {
    componentId,
    storyId: 'story',
    componentType,
    parts: [{
      id: partId,
      ownerId: componentId,
      storyId: 'story',
      componentType,
      partId,
      kind: 'outlet' as const,
    }],
  }
}

describe('LayoutCapabilityState', () => {
  it('registers and resolves opaque mount target identifiers without interpreting their names', () => {
    const state = new LayoutCapabilityState()
    state.registerComponent(registration('layout', 'layout', 'page-layout:content'))

    expect(state.resolveTarget('page-layout:content')).toMatchObject({
      id: 'page-layout:content',
      ownerId: 'layout',
    })
    expect(state.resolveTarget('content')).toBeUndefined()
  })

  it('keeps registrations independent between player-scoped module instances', () => {
    const catalog = new RuntimeModuleServiceCatalog()
    catalog.register(createLayoutModuleServiceDefinition())

    const compiledScene = {} as CompiledScene
    const first = catalog.create('layout', { playerId: 'first', compiledScene }) as LayoutModuleServiceInstance
    const second = catalog.create('layout', { playerId: 'second', compiledScene }) as LayoutModuleServiceInstance

    first.registerComponent(registration('layout-first', 'layout', 'content'))

    expect(first.resolveTarget('content')).toBeDefined()
    expect(second.resolveTarget('content')).toBeUndefined()
  })

  it('rejects duplicate mount target IDs and removes all targets with their component', () => {
    const state = new LayoutCapabilityState()
    state.registerComponent(registration('layout-a', 'layout', 'content'))

    expect(() => state.registerComponent(registration('input-b', 'input', 'content'))).toThrow(
      'Layout mount target ID is already registered: content',
    )

    state.unregisterComponent('layout-a')
    expect(state.resolveTarget('content')).toBeUndefined()
  })

  it('exposes registered targets through the player mount-target contract', () => {
    const definition = createLayoutModuleServiceDefinition()
    const service = definition.create({ playerId: 'player', compiledScene: {} as CompiledScene }) as LayoutModuleServiceInstance
    service.registerComponent(registration('layout', 'layout', 'content'))

    expect(service.getMountTargets()).toEqual([{
      id: 'content',
      kind: 'outlet',
      storyId: 'story',
      ownerId: 'layout',
    }])
  })

  it('registers only public materialized parts and removes them with the component', () => {
    const definition = createLayoutModuleServiceDefinition()
    const service = definition.create({ playerId: 'player', compiledScene: {} as CompiledScene }) as LayoutModuleServiceInstance

    registerMaterializedComponent(service, {
      componentId: 'layout',
      storyId: 'story',
      componentType: 'layout',
    }, [{ partId: 'content', nodeRef: {} }])

    expect(service.resolveTarget('content')).toMatchObject({
      ownerId: 'layout',
      partId: 'content',
    })

    unregisterMaterializedComponent(service, 'layout')
    expect(service.resolveTarget('content')).toBeUndefined()
  })
})
