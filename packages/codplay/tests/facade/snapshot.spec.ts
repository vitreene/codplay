/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'

import { CodPlay, type CodPlayInstance } from '../../src'
import { SCENE_BUILD_CONFIG } from '../../src/scene/config/scene-build'
import type { SceneDoc } from '../../src/scene/types'

/** Builds one scene whose item exposes two independent style properties. */
function snapshotScene(): SceneDoc {
  return {
    id: 'snapshot-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'item',
          type: 'tag',
          initial: {
            tag: 'article',
            move: '@root',
            style: { opacity: 0, color: 'red', x: 10, width: 25 },
          },
          actions: {
            reveal: { style: { opacity: 1, color: 'blue' } },
          },
        }],
        eventimes: [{ name: 'reveal', startAt: 100 }],
      },
    },
  }
}

/** Creates and initializes one public instance on the HTML path. */
function createSnapshotInstance(codplay: CodPlay, rootWidth?: number): CodPlayInstance {
  const build = codplay.build({ scene: snapshotScene() })
  if (!build.ok) throw new Error('Snapshot test scene did not compile.')
  const root = document.createElement('div')
  if (rootWidth !== undefined) {
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: rootWidth }),
    })
  }
  document.body.append(root)
  return codplay.instances.create({
    instanceId: 'snapshot-instance',
    compiledScene: build.compiledScene,
    functions: build.functions,
    root,
  })
}

describe('CodPlay instance snapshot', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('reads the base logical frame and applies a partial style preview without DOM reads', () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const instance = createSnapshotInstance(codplay)
    const node = document.body.querySelector<HTMLElement>('article')
    if (node === null) throw new Error('Snapshot test node is missing.')

    expect(node.style.opacity).toBe('0')
    expect(node.style.transform).toBe('translateX(10px)')
    const base = instance.snapshot.get()
    expect(base).not.toBeNull()
    expect(base?.timeMs).toBe(0)
    expect(base?.states).toHaveLength(1)
    expect(base?.states[0]?.target).toEqual({ storyId: 'main', persoId: 'item' })
    expect(base?.states[0]?.state.style).toMatchObject({ opacity: 0 })

    expect(instance.snapshot.set([{
      target: { storyId: 'main', persoId: 'item' },
      timeMs: 0,
      state: { style: { opacity: 0.5 } },
    }])).toEqual({ ok: true })
    expect(node.style.opacity).toBe('0.5')
    expect(node.style.color).not.toBe('')
    expect(instance.snapshot.get()?.states[0]?.state.style).toMatchObject({ opacity: 0 })

    instance.snapshot.clear()
    expect(node.style.opacity).toBe('0')
  })

  it('qualifies geometry in snapshot previews and keeps the base frame logical', () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const instance = createSnapshotInstance(codplay, 800)
    const node = document.body.querySelector<HTMLElement>('article')
    if (node === null) throw new Error('Snapshot test node is missing.')

    const base = instance.snapshot.get()
    expect(base?.states[0]?.state.style).toMatchObject({
      x: { kind: 'length', unit: SCENE_BUILD_CONFIG.logicalLengthUnit, value: 10 },
      width: { kind: 'length', unit: SCENE_BUILD_CONFIG.logicalLengthUnit, value: 25 },
    })
    expect(node.style.transform).toBe('translateX(80px)')
    expect(node.style.width).toBe('200px')

    expect(instance.snapshot.set([{
      target: { storyId: 'main', persoId: 'item' },
      timeMs: 0,
      state: { style: { x: 14, width: 30 } },
    }])).toEqual({ ok: true })
    expect(node.style.transform).toBe('translateX(112px)')
    expect(node.style.width).toBe('240px')
    expect(instance.snapshot.get()?.states[0]?.state.style).toMatchObject({
      x: { kind: 'length', unit: SCENE_BUILD_CONFIG.logicalLengthUnit, value: 10 },
      width: { kind: 'length', unit: SCENE_BUILD_CONFIG.logicalLengthUnit, value: 25 },
    })

    instance.snapshot.clear()
    expect(node.style.transform).toBe('translateX(80px)')
    expect(node.style.width).toBe('200px')
  })

  it('replaces the preview atomically and reports rejected patches without changing it', () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const instance = createSnapshotInstance(codplay)
    const diagnostics: string[] = []
    instance.diagnostic.onDiagnostic((diagnostic) => diagnostics.push(diagnostic.code))
    const node = document.body.querySelector<HTMLElement>('article')
    if (node === null) throw new Error('Snapshot test node is missing.')

    expect(instance.snapshot.set([{
      target: { storyId: 'main', persoId: 'item' },
      timeMs: 0,
      state: { style: { opacity: 0.25 } },
    }])).toEqual({ ok: true })
    expect(node.style.opacity).toBe('0.25')

    expect(instance.snapshot.set([{
      target: { storyId: 'main', persoId: 'item' },
      timeMs: 10,
      state: { style: { opacity: 0.75 } },
    }])).toEqual({ ok: false, code: 'TIME_NOT_PRESENTED' })
    expect(node.style.opacity).toBe('0.25')

    expect(instance.snapshot.set([{
      target: { storyId: 'missing', persoId: 'item' },
      timeMs: 0,
      state: { style: { opacity: 0.75 } },
    }])).toEqual({ ok: false, code: 'TARGET_NOT_PRESENT' })
    expect(node.style.opacity).toBe('0.25')

    expect(instance.snapshot.set([{
      target: { storyId: 'main', persoId: 'item' },
      timeMs: 0,
      state: { style: { opacity: 0.75 }, data: 'rejected' },
    }])).toEqual({ ok: false, code: 'INVALID_PATCH' })
    expect(node.style.opacity).toBe('0.25')
    expect(diagnostics).toEqual([
      'CODPLAY_SNAPSHOT_TIME_NOT_PRESENTED',
      'CODPLAY_SNAPSHOT_TARGET_NOT_PRESENT',
      'CODPLAY_SNAPSHOT_INVALID_PATCH',
    ])
  })

  it('returns the destroyed result without reopening the player', () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const instance = createSnapshotInstance(codplay)
    codplay.instances.destroy(instance.instanceId)

    expect(instance.snapshot.get()).toBeNull()
    expect(instance.snapshot.set([])).toEqual({ ok: false, code: 'INSTANCE_DESTROYED' })
    expect(() => instance.snapshot.clear()).not.toThrow()
  })

  it('keeps a preview until clear while presenting the base frame at another time', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const instance = createSnapshotInstance(codplay)
    const node = document.body.querySelector<HTMLElement>('article')
    if (node === null) throw new Error('Snapshot test node is missing.')

    expect(instance.snapshot.set([{
      target: { storyId: 'main', persoId: 'item' },
      timeMs: 0,
      state: { style: { opacity: 0.25 } },
    }])).toEqual({ ok: true })
    expect(node.style.opacity).toBe('0.25')

    await instance.telco.seek(100)
    expect(node.style.opacity).toBe('1')
    expect(instance.snapshot.get()?.states[0]?.state.style).toMatchObject({ opacity: 1 })

    await instance.telco.seek(0)
    expect(node.style.opacity).toBe('0.25')
    expect(instance.snapshot.get()?.states[0]?.state.style).toMatchObject({ opacity: 0 })
  })
})
