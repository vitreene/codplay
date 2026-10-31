/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodPlay, type SceneDoc } from 'codplay'
import { EDITOR_ENGINE_OPTIONS } from '../../src/item-presentation/engine-options'

/** Owns independent pose and border clocks without any editor/demo fixture. */
function scene(): SceneDoc {
  return {
    id: 'item-presentation-test',
    stories: { main: {
      id: 'main',
      persos: [{
        id: 'item', type: 'tag',
        initial: {
          move: '@root', tag: 'div', content: 'One item',
          attr: { 'data-item-id': 'main:item' },
          style: { x: 10, y: 10, width: 20, height: 12, 'border-width': '0.6cqw', 'border-style': 'solid' },
        },
        actions: {
          pose: { style: { x: { from: 10, to: 50, duration: 5000, ease: 'linear' } } },
          border: { style: { 'border-width': { from: '0.6cqw', to: '2cqw', duration: 2000, ease: 'linear' } } },
        },
      }],
      eventimes: [{ name: 'pose', startAt: 0 }, { name: 'border', startAt: 0 }],
    } },
  }
}

describe('Editor item presentation', () => {
  const owners: CodPlay[] = []
  afterEach(() => { owners.splice(0).forEach((owner) => owner.destroy()); document.body.replaceChildren(); vi.restoreAllMocks() })

  it('keeps one state and composes the current border without moving the untouched axis', async () => {
    const owner = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS })
    owners.push(owner)
    const built = owner.build({ scene: scene() })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const root = document.createElement('div')
    root.style.width = '800px'
    Object.defineProperty(root, 'getBoundingClientRect', { value: () => ({ width: 800, height: 450, left: 0, top: 0 }) })
    document.body.append(root)
    const instance = owner.instances.create({ instanceId: 'one-item', ...built, root })
    await instance.telco.seek(2500)
    const states = instance.snapshot.get()!.states
    expect(states).toHaveLength(1)
    expect(states[0]!.state.style).toMatchObject({
      x: { kind: 'length', value: 30 }, y: { kind: 'length', value: 10 },
      'border-width': '2cqw',
    })
    const frame = root.querySelector<HTMLElement>('[data-item-id="main:item"]')!
    const visual = root.querySelector<HTMLElement>('[data-editor-visual-for="item"]')!
    expect(getComputedStyle(frame).transform).toContain('translate(calc(30cqw - max(')
    expect(frame.querySelector<HTMLStyleElement>('style')!.style.width).toContain('20cqw + max(')
    expect(visual.style.width).toBe('160px')
    expect(visual.style.borderWidth).toBe('2cqw')
    expect(visual.textContent).toBe('One item')
    expect(visual.parentElement!.style.transform).toBe('translate(-50%,-50%)')
  })

  it('does not change another owner using the native tag component', () => {
    const nativeOwner = new CodPlay()
    const editorOwner = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS })
    owners.push(nativeOwner, editorOwner)
    const built = nativeOwner.build({ scene: scene() })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const root = document.createElement('div')
    document.body.append(root)
    nativeOwner.instances.create({ instanceId: 'native-item', ...built, root })
    expect(root.querySelector('[data-editor-visual-for]')).toBeNull()
    expect(root.querySelector('[data-item-id="main:item"]')?.textContent).toBe('One item')
  })
  it('isolates private author rules between two Editor instances with the same item id', async () => {
    const owner = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS })
    owners.push(owner)
    const built = owner.build({ scene: scene() })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const roots = [document.createElement('div'), document.createElement('div')]
    document.body.append(...roots)
    const instances = roots.map((root, index) => owner.instances.create({ instanceId: `editor-${index}`, ...built, root }))
    await instances[0]!.telco.seek(2500)
    await instances[1]!.telco.seek(5000)
    const frames = roots.map((root) => root.querySelector<HTMLElement>('[data-item-id="main:item"]')!)
    expect(frames[0]!.id).not.toBe(frames[1]!.id)
    expect(getComputedStyle(frames[0]!).transform).toContain('translate(calc(30cqw - max(')
    expect(getComputedStyle(frames[1]!).transform).toContain('translate(calc(50cqw - max(')
  })

  it('retains native image sources and child identity across reparent, seek and reset', async () => {
    const owner = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS })
    owners.push(owner)
    const built = owner.build({ scene: {
      id: 'image-parenting', stories: { main: { id: 'main', persos: [
        { id: 'first', type: 'list', initial: { tag: 'div', move: '@root', attr: { id: 'first' } }, actions: { restyle: { style: { opacity: 0.8 } } } },
        { id: 'second', type: 'list', initial: { tag: 'div', move: '@root', attr: { id: 'second' } }, actions: {} },
        { id: 'picture', type: 'img', initial: {
          src: '/image-a.png', move: 'first', style: { x: 10, y: 10, width: 20, height: 12 },
          attr: { 'data-item-id': 'main:picture' }, img: { style: { width: '100%', height: '100%' } },
        }, actions: {
          alternate: { src: '/image-b.png' }, restore: { src: '/image-a.png' }, relocate: { move: 'second' },
        } },
      ], eventimes: [
        { name: 'restyle', startAt: 100 }, { name: 'alternate', startAt: 200 },
        { name: 'restore', startAt: 400 }, { name: 'relocate', startAt: 600 },
      ] } },
    } })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const root = document.createElement('div')
    document.body.append(root)
    owner.resources.register({ loaded: ['/image-a.png', '/image-b.png'], skipped: [], metadata: {
      '/image-a.png': { type: 'image', width: 160, height: 96 },
      '/image-b.png': { type: 'image', width: 160, height: 96 },
    } })
    const instance = owner.instances.create({ instanceId: 'image-parenting', ...built, root })
    const frame = root.querySelector<HTMLElement>('[data-item-id="main:picture"]')!
    const original = frame.querySelector('img')!
    const source = original.src
    await instance.telco.seek(250)
    expect(frame.querySelector('img')).not.toBe(original)
    await instance.telco.seek(650)
    expect(frame.querySelector('img')).toBe(original)
    expect(original.src).toBe(source)
    expect(frame.parentElement).toBe(root.querySelector('#second'))
    await instance.telco.seek(50)
    expect(frame.parentElement).toBe(root.querySelector('#first'))
    expect(frame.querySelector('img')).toBe(original)
    await instance.telco.reset()
    expect(root.querySelector('[data-item-id="main:picture"]')).toBe(frame)
    expect(frame.querySelector('img')).toBe(original)
    owner.destroy()
    expect(root.childElementCount).toBe(0)
  })

  it('publishes the native media surface to the existing module and preserves its source lifecycle', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const owner = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS, frameScheduler: { request: () => 1, cancel: () => undefined } })
    owners.push(owner)
    const built = owner.build({ scene: {
      id: 'media-lifecycle', stories: { main: { id: 'main', listen: [{ on: 'start' }, { on: 'stop' }],
        persos: [{ id: 'movie', type: 'media', initial: {
          src: '/movie.mp4', move: '@root', controls: true, style: { x: 10, y: 10, width: 20, height: 12 },
        }, actions: { start: { broadcast: { type: 'START' } }, stop: { broadcast: { type: 'STOP' } } } }],
      } },
    } })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    owner.resources.register({ loaded: ['/movie.mp4'], skipped: [], metadata: { '/movie.mp4': { type: 'video', durationMs: 10_000 } } })
    const root = document.createElement('div')
    document.body.append(root)
    const instance = owner.instances.create({ instanceId: 'media-lifecycle', ...built, root })
    const video = root.querySelector('video')!
    const source = video.src
    expect(video.controls).toBe(true)
    await instance.telco.play()
    await instance.events.emit({ name: 'start' }, { scope: 'story', storyId: 'main' })
    expect(play).toHaveBeenCalled()
    instance.telco.setRate(2)
    expect(video.playbackRate).toBe(2)
    await instance.telco.seek(500)
    expect(pause).toHaveBeenCalled()
    expect(root.querySelector('video')).toBe(video)
    expect(video.src).toBe(source)
    await instance.telco.reset()
    expect(root.querySelector('video')).toBe(video)
    await instance.events.emit({ name: 'stop' }, { scope: 'story', storyId: 'main' })
    expect(video.currentTime).toBe(0)
    owner.destroy()
    expect(root.querySelector('video')).toBeNull()
  })

})
