import { describe, expect, it, vi } from 'vitest'

import { DiagnosticCollector } from '../../../src/diagnostics'
import { CompiledSceneValidationEngine, validatePersoWithCapabilities } from '../../../src/scene/validation'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import type { RuntimeCapabilityCatalog, RuntimeComponentDefinition } from '../../../src/runtime/catalog'
import { TagComponent } from '../../../src/runtime/components'

function componentDefinition(
  type: string,
  services: readonly string[],
  validateInitial: RuntimeComponentDefinition['validateInitial'] = () => undefined,
  validateAction?: RuntimeComponentDefinition['validateAction'],
): RuntimeComponentDefinition {
  return {
    type,
    services,
    modules: [],
    validateInitial,
    validateAction,
    create: (input) => new TagComponent(input as never),
  }
}

function catalog(): RuntimeCapabilityCatalog {
  return createCoreRuntimeCatalog()
}

describe('RuntimeCapabilityCatalog validation snapshot', () => {
  it('projects runtime-shaped component declarations into one validation catalog', () => {
    const runtimeCatalog = catalog()
    runtimeCatalog.overrideComponent({ ...componentDefinition('tag', ['style'], () => undefined), modules: ['markup'] })

    const snapshot = runtimeCatalog.validationSnapshot()

    expect(snapshot.components.get('tag')).toMatchObject({
      type: 'tag',
      services: ['style'],
      modules: ['markup'],
    })
    expect(snapshot.services.has('style')).toBe(true)
  })

  it('passes the declared service validators to the compiled validation boundary', () => {
    const output = vi.fn()
    const diagnostics = new DiagnosticCollector({ output })
    const runtimeCatalog = catalog()
    runtimeCatalog.overrideComponent(componentDefinition('tag', ['style', 'className', 'attr']))

    const engine = new CompiledSceneValidationEngine(runtimeCatalog.validationSnapshot())
    engine.validate({ persos: [{
      id: 'title',
      type: 'tag',
      initial: {
        style: { opacity: 1 },
        className: { add: 'title' },
        attr: { role: 'heading' },
      },
      actions: {},
    }] }, diagnostics)

    expect(diagnostics.report().errors).toEqual([])
    expect(diagnostics.report().warnings).toHaveLength(0)
    expect(output).not.toHaveBeenCalled()
  })

  it('keeps the core service contracts attached to their service declarations', () => {
    const runtimeCatalog = catalog()

    expect(runtimeCatalog.getService('style')).toMatchObject({
      name: 'style',
      allowUnknownProperties: true,
      materializers: ['html', 'svg'],
    })
    expect(runtimeCatalog.getService('className')).toMatchObject({ name: 'className', materializers: ['html', 'svg'] })
    expect(runtimeCatalog.getService('attr')).toMatchObject({ name: 'attr', materializers: ['html', 'svg'] })
    expect(runtimeCatalog.getService('content')).toMatchObject({ name: 'content', materializers: ['html', 'svg'] })
  })

  it('validates only the declared style color properties with the V2 color contract', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const runtimeCatalog = catalog()

    validatePersoWithCapabilities(runtimeCatalog.validationSnapshot(), {
      id: 'title',
      type: 'tag',
      initial: { style: { color: 'hsl(0, 100%, 50%)', transform: 'rotate(20deg)' } },
      actions: {},
    }, diagnostics)

    expect(diagnostics.report().errors).toHaveLength(1)
    expect(diagnostics.report().errors[0]).toMatchObject({
      code: 'AUTHOR_STYLE_COLOR_INVALID',
      details: { refs: { persoId: 'title' }, context: { path: 'initial.style.color' } },
    })
  })

  it('accepts OKLCH as a declared style color', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const runtimeCatalog = catalog()

    validatePersoWithCapabilities(runtimeCatalog.validationSnapshot(), {
      id: 'oklch-title',
      type: 'tag',
      initial: { style: { color: 'oklch(60% 0.2 30)' } },
      actions: {},
    }, diagnostics)

    expect(diagnostics.report().errors).toEqual([])
  })

  it('reports invalid common service payloads with paths and references', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const runtimeCatalog = catalog()
    runtimeCatalog.overrideComponent(componentDefinition('tag', ['style', 'className', 'attr']))

    validatePersoWithCapabilities(runtimeCatalog.validationSnapshot(), {
      id: 'title',
      type: 'tag',
      initial: {
        style: 'not-an-object',
        className: { add: 42 },
        attr: [],
      },
      actions: {},
    }, diagnostics)

    expect(diagnostics.report().errors.map((entry) => entry.code)).toEqual([
      'AUTHOR_STYLE_INVALID',
      'AUTHOR_CLASS_NAME_INVALID',
      'AUTHOR_ATTR_INVALID',
    ])
    expect(diagnostics.report().errors[0]).toMatchObject({
      details: { refs: { persoId: 'title' }, context: { path: 'initial.style' } },
    })
  })

  it('accepts string and numeric content through the content service at the compiled boundary', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const runtimeCatalog = catalog()

    validatePersoWithCapabilities(runtimeCatalog.validationSnapshot(), {
      id: 'title',
      type: 'tag',
      initial: { tag: 'p', content: 42 },
      actions: {},
    }, diagnostics)

    expect(diagnostics.report().errors).toEqual([])
  })

  it('validates the initial contract owned by each built-in component', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const runtimeCatalog = catalog()
    const snapshot = runtimeCatalog.validationSnapshot()

    validatePersoWithCapabilities(snapshot, {
      id: 'invalid-tag',
      type: 'tag',
      initial: { tag: 'not valid' },
      actions: {},
    }, diagnostics)
    validatePersoWithCapabilities(snapshot, {
      id: 'invalid-layout',
      type: 'layout',
      initial: {},
      actions: {},
    }, diagnostics)
    validatePersoWithCapabilities(snapshot, {
      id: 'invalid-list',
      type: 'list',
      initial: { config: { reorderOnMove: 'yes' } },
      actions: {},
    }, diagnostics)

    expect(diagnostics.report().errors.map((entry) => entry.code)).toEqual([
      'AUTHOR_TAG_NAME_INVALID',
      'AUTHOR_LAYOUT_MARKUP_INVALID',
      'AUTHOR_LIST_CONFIG_INVALID',
    ])
    expect(diagnostics.report().errors.map((entry) => entry.details?.context?.path)).toEqual([
      'initial.tag',
      'initial.markup',
      'initial.config.reorderOnMove',
    ])
  })

  it('keeps the normative defaults for tag and list roots', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const runtimeCatalog = catalog()
    const snapshot = runtimeCatalog.validationSnapshot()

    validatePersoWithCapabilities(snapshot, {
      id: 'default-tag',
      type: 'tag',
      initial: {},
      actions: {},
    }, diagnostics)
    validatePersoWithCapabilities(snapshot, {
      id: 'default-list',
      type: 'list',
      initial: { tag: '  ' },
      actions: {},
    }, diagnostics)

    expect(diagnostics.report().errors).toEqual([])
  })

  it('allows component-specific validation to be added without changing the catalog pipeline', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const runtimeCatalog = catalog()

    runtimeCatalog.registerComponent(componentDefinition('meter', [], (value, context) => {
        if (typeof value !== 'object' || value === null || !('max' in value)) {
          context.diagnostics.error('AUTHOR_METER_INITIAL_INVALID', 'meter.max is required.', {
            refs: context.refs,
            context: { path: context.path },
          })
        }
      }))

    validatePersoWithCapabilities(runtimeCatalog.validationSnapshot(), {
      id: 'meter-1',
      type: 'meter',
      initial: { value: 0 },
      actions: {},
    }, diagnostics)

    expect(diagnostics.report().errors).toHaveLength(1)
    expect(diagnostics.report().errors[0].code).toBe('AUTHOR_METER_INITIAL_INVALID')
  })

  it('does not validate the canonical self-reference as an authored action payload', () => {
    const validateAction = vi.fn()
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const runtimeCatalog = catalog()
    runtimeCatalog.overrideComponent(componentDefinition('tag', [], undefined, validateAction))

    validatePersoWithCapabilities(runtimeCatalog.validationSnapshot(), {
      id: 'title',
      type: 'tag',
      initial: {},
      actions: { title: null },
    }, diagnostics)

    expect(validateAction).not.toHaveBeenCalled()
  })

  it('warns when a declared service has no validator', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const runtimeCatalog = catalog()
    runtimeCatalog.registerService({ name: 'custom', materializers: ['test'], create: () => ({ apply: () => undefined }) })
    runtimeCatalog.registerComponent(componentDefinition('custom', ['custom']))

    validatePersoWithCapabilities(runtimeCatalog.validationSnapshot(), {
      id: 'custom-1',
      type: 'custom',
      initial: { custom: { value: 1 } },
      actions: {},
    }, diagnostics)

    expect(diagnostics.report().warnings.map((entry) => entry.code)).toEqual(['AUTHOR_SERVICE_VALIDATOR_MISSING'])
  })

  it('detaches a catalog snapshot from later registrations', () => {
    const runtimeCatalog = catalog()
    runtimeCatalog.overrideComponent(componentDefinition('tag', ['style']))
    const snapshot = runtimeCatalog.validationSnapshot()

    runtimeCatalog.registerComponent(componentDefinition('later', []))

    expect(snapshot.components.has('later')).toBe(false)
  })
})
