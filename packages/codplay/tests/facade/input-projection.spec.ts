/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'

import { CodPlay } from '../../src'
import type { SceneDoc } from '../../src/scene/types'

/** Builds one scene with an input whose value can be projected live. */
function inputScene(): SceneDoc {
  return {
    id: 'input-projection-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'progress-control',
          type: 'input',
          initial: {
            inputType: 'range',
            value: 0,
            min: 0,
            max: 10_000,
            step: 10,
            label: 'Progression',
            move: '@root',
          },
          actions: {},
        }, {
          // The tag gives the projection boundary a non-input target regression.
          // It is intentionally not used by the live control path.
          id: 'status-label',
          type: 'tag',
          initial: {
            tag: 'span',
            content: 'Ready',
            move: '@root',
          },
          actions: {},
        }],
      },
    },
  }
}

/** Creates one materialized input instance on the public HTML facade. */
function createInputInstance(codplay: CodPlay): {
  instance: ReturnType<CodPlay['instances']['create']>
  control: HTMLInputElement
} {
  const build = codplay.build({ scene: inputScene() })
  if (!build.ok) throw new Error('Input projection scene did not compile.')
  const root = document.createElement('div')
  document.body.append(root)
  const instance = codplay.instances.create({
    instanceId: 'input-projection-instance',
    compiledScene: build.compiledScene,
    functions: build.functions,
    root,
  })
  const control = root.querySelector<HTMLInputElement>('#progress-control__control')
  if (control === null) throw new Error('Input projection control is missing.')
  return { instance, control }
}

describe('CodPlay live input projection', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('updates a mounted input without changing logical state or journal events', () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const { instance, control } = createInputInstance(codplay)
    const events: string[] = []
    instance.events.onEvent((event) => events.push(event.name))
    const revision = instance.telco.getState().runtimeRevision

    expect(instance.projection.setInputValue({
      storyId: 'main',
      persoId: 'progress-control',
    }, 2_500)).toEqual({ ok: true })

    expect(control.value).toBe('2500')
    expect(instance.snapshot.get()?.states[0]?.state.value).toBe(0)
    expect(instance.telco.getState().runtimeRevision).toBe(revision)
    expect(events).toEqual([])
  })

  it('lets the next normal presentation replace a transient projection', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const { instance, control } = createInputInstance(codplay)

    expect(instance.projection.setInputValue({
      storyId: 'main',
      persoId: 'progress-control',
    }, 2_500)).toEqual({ ok: true })

    await instance.telco.seek(0)

    expect(control.value).toBe('0')
  })

  it('reports invalid and non-input projection targets', () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const { instance } = createInputInstance(codplay)

    expect(instance.projection.setInputValue({
      storyId: 'missing',
      persoId: 'progress-control',
    }, 2_500)).toEqual({ ok: false, code: 'TARGET_NOT_PRESENT' })
    expect(instance.projection.setInputValue({
      storyId: 'main',
      persoId: 'progress-control',
    }, Number.NaN)).toEqual({ ok: false, code: 'INVALID_VALUE' })
    expect(instance.projection.setInputValue({
      storyId: 'main',
      persoId: 'status-label',
    }, 2_500)).toEqual({ ok: false, code: 'TARGET_NOT_INPUT' })
  })

  it('does not project through a destroyed instance', () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const { instance } = createInputInstance(codplay)

    codplay.instances.destroy(instance.instanceId)

    expect(instance.projection.setInputValue({
      storyId: 'main',
      persoId: 'progress-control',
    }, 2_500)).toEqual({ ok: false, code: 'INSTANCE_DESTROYED' })
  })
})
