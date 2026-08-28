import { describe, expect, it, vi } from 'vitest'

import { DiagnosticCollector } from '../../../src/diagnostics'
import { GuardPipeline } from '../../../src/scene/validation'

describe('GuardPipeline', () => {
  it('runs rules by phase and keeps registration order within a phase', () => {
    const pipeline = new GuardPipeline<{ value: string }>()
    const order: string[] = []

    pipeline.register({ id: 'semantic-b', phase: 'semantic', run: () => order.push('semantic-b') })
    pipeline.register({ id: 'shape', phase: 'shape', run: () => order.push('shape') })
    pipeline.register({ id: 'semantic-a', phase: 'semantic', run: () => order.push('semantic-a') })

    pipeline.run({ value: 'ok' }, {
      path: 'scene',
      refs: {},
      diagnostics: new DiagnosticCollector({ output: vi.fn() }),
    })

    expect(order).toEqual(['shape', 'semantic-b', 'semantic-a'])
  })

  it('lets a rule report through the shared diagnostics context', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    const pipeline = new GuardPipeline<{ value: string }>()

    pipeline.register({
      id: 'value-required',
      phase: 'shape',
      run: (value, context) => {
        if (value.value === '') {
          context.diagnostics.error('AUTHOR_VALUE_INVALID', 'value must not be empty.', {
            refs: context.refs,
            context: { path: context.path },
          })
        }
      },
    })

    pipeline.run({ value: '' }, { path: 'scene.value', refs: { sceneId: 'scene-a' }, diagnostics })

    expect(diagnostics.report().errors).toMatchObject([
      {
        code: 'AUTHOR_VALUE_INVALID',
        details: { refs: { sceneId: 'scene-a' }, context: { path: 'scene.value' } },
      },
    ])
  })
})
