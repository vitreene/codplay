import { describe, expect, it, vi } from 'vitest'

import { DiagnosticCollector } from '../../../src/diagnostics'
import { CompiledSceneValidationEngine, ValidationCatalog, validatePersoWithCatalog } from '../../../src/scene/validation'

describe('ValidationCatalog', () => {
  it('projects runtime-shaped component declarations into one validation catalog', () => {
    const catalog = ValidationCatalog.fromComponents([{
      type: 'tag',
      services: ['style'],
      modules: ['markup'],
      validateInitial: () => undefined,
    }])

    const snapshot = catalog.snapshot()

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
    const catalog = new ValidationCatalog()

    catalog.registerComponent({
      type: 'tag',
      services: ['style', 'className', 'attr'],
    })

    const engine = new CompiledSceneValidationEngine(catalog.snapshot())
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
    expect(diagnostics.report().warnings).toHaveLength(1)
    expect(diagnostics.report().warnings[0]).toMatchObject({
      code: 'AUTHOR_COMPONENT_VALIDATOR_MISSING',
      details: { refs: { persoId: 'title' } },
    })
    expect(output).toHaveBeenCalledTimes(1)
  })

  it('reports invalid common service payloads with paths and references', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const catalog = new ValidationCatalog()
    catalog.registerComponent({ type: 'tag', services: ['style', 'className', 'attr'] })

    validatePersoWithCatalog(catalog.snapshot(), {
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

  it('allows component-specific validation to be added without changing the catalog pipeline', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const catalog = new ValidationCatalog()

    catalog.registerComponent({
      type: 'meter',
      services: [],
      validateInitial: (value, context) => {
        if (typeof value !== 'object' || value === null || !('max' in value)) {
          context.diagnostics.error('AUTHOR_METER_INITIAL_INVALID', 'meter.max is required.', {
            refs: context.refs,
            context: { path: context.path },
          })
        }
      },
    })

    validatePersoWithCatalog(catalog.snapshot(), {
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
    const catalog = new ValidationCatalog()
    catalog.registerComponent({ type: 'tag', services: [], validateAction })

    validatePersoWithCatalog(catalog.snapshot(), {
      id: 'title',
      type: 'tag',
      initial: {},
      actions: { title: null },
    }, diagnostics)

    expect(validateAction).not.toHaveBeenCalled()
  })

  it('warns when a declared service has no validator', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const catalog = new ValidationCatalog()
    catalog.registerService({ name: 'custom' })
    catalog.registerComponent({ type: 'custom', services: ['custom'] })

    validatePersoWithCatalog(catalog.snapshot(), {
      id: 'custom-1',
      type: 'custom',
      initial: { custom: { value: 1 } },
      actions: {},
    }, diagnostics)

    expect(diagnostics.report().warnings.map((entry) => entry.code)).toEqual([
      'AUTHOR_COMPONENT_VALIDATOR_MISSING',
      'AUTHOR_SERVICE_VALIDATOR_MISSING',
    ])
  })

  it('detaches a catalog snapshot from later registrations', () => {
    const catalog = new ValidationCatalog()
    catalog.registerComponent({ type: 'tag', services: ['style'] })
    const snapshot = catalog.snapshot()

    catalog.registerComponent({ type: 'later', services: [] })

    expect(snapshot.components.has('later')).toBe(false)
  })
})
