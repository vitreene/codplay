/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodPlay, type SceneDoc } from 'codplay'
import { EDITOR_ENGINE_OPTIONS } from '../../src/item-presentation/engine-options'
import { ITEM_MOTION_REFERENCE_ANGLE, ITEM_MOTION_ROTATION_BASELINE } from '../../src/item-presentation/item-motion-reference'
import {
  ITEM_PREVIEW_HEIGHT_PROPERTY,
  ITEM_PREVIEW_TRANSFORM_PROPERTY,
  ITEM_PREVIEW_WIDTH_PROPERTY,
  itemPreviewTransform,
} from '../../src/item-presentation/item-preview'
import {
  captureItemTransformProjection,
  composeItemPresentationPose,
  projectItemStyle,
} from '../../src/item-presentation/item-style-projection'

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

  it('keeps motion-frame scale independent of changing visual rotation', () => {
    const source = projectItemStyle({
      rotate: 15,
      scaleX: 1,
      scaleY: 1,
      [ITEM_MOTION_REFERENCE_ANGLE]: 15,
      [ITEM_MOTION_ROTATION_BASELINE]: 15,
    }, 1)
    const middle = projectItemStyle({
      rotate: 56,
      scaleX: 0.9,
      scaleY: 0.85,
      [ITEM_MOTION_REFERENCE_ANGLE]: 15,
      [ITEM_MOTION_ROTATION_BASELINE]: 15,
    }, 1)

    expect(source.frameStyle.rotate).toBe(15)
    expect(middle.frameStyle.rotate).toBe(15)
    expect(middle.frameStyle).not.toHaveProperty('scaleX')
    expect(middle.frameStyle).not.toHaveProperty('scaleY')
    expect(source.motionTransformStyle.transform).toBe('rotate(0deg) scale(1, 1)')
    expect(middle.motionTransformStyle.transform).toBe('rotate(41deg) scale(0.9, 0.85)')
  })

  it('projects CSS transform-origin keywords as frame-axis fractions', () => {
    expect(projectItemStyle({ 'transform-origin': 'left bottom' }, 1).rotationOrigin).toEqual({
      fx: 0,
      fy: 1,
    })
  })

  it('composes the runtime pose with a complete local affine matrix, including shear', () => {
    const presented = composeItemPresentationPose({
      origin: { x: 10, y: 20 },
      matrix: { a: 0, b: 1, c: -1, d: 0 },
      localWidth: 100,
      localHeight: 40,
    }, {
      matrix: { a: 1, b: 0.25, c: 0.5, d: 1, e: 12, f: -3 },
      rotationOrigin: { fx: 0.25, fy: 0.75 },
    })

    expect(presented.origin).toEqual({ x: 13, y: 32 })
    expect(presented.matrix).toEqual({ a: -0.25, b: 1, c: -1, d: 0.5 })
  })

  it('projects the displayed affine through the inverse runtime pose', () => {
    const transform = itemPreviewTransform({
      origin: { x: 10, y: 20 },
      matrix: { a: 0, b: 1, c: -1, d: 0 },
      localWidth: 40,
      localHeight: 20,
    }, {
      x: 40,
      y: 60,
      width: 10,
      height: 10,
      rotate: 14,
      rotationOrigin: { fx: 0, fy: 0 },
      affineProjection: {
        origin: { x: 40, y: 60 },
        matrix: { a: 1, b: 0.25, c: 0.5, d: 1 },
      },
    })

    expect(transform?.match(/^matrix\(([^)]+)\)$/)?.[1]?.split(',').map(Number)).toEqual([
      0.25, -1, 1, -0.5, 40, -30,
    ])
  })

  it('captures shear from the same CSS matrix used by the rendered transform anchor', () => {
    const anchor = document.createElement('div')
    anchor.style.width = '100px'
    anchor.style.height = '40px'
    anchor.style.transformOrigin = '0% 100%'
    anchor.style.transform = 'matrix(1, 0.25, 0.5, 1, 12, -3)'
    document.body.append(anchor)

    expect(captureItemTransformProjection(anchor)).toEqual({
      matrix: { a: 1, b: 0.25, c: 0.5, d: 1, e: -8, f: -3 },
      rotationOrigin: { fx: 0, fy: 1 },
    })
  })

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

  it('renders the private preview matrix at its candidate dimensions', async () => {
    const owner = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS })
    owners.push(owner)
    const built = owner.build({ scene: scene() })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const root = document.createElement('div')
    root.style.width = '800px'
    document.body.append(root)
    const instance = owner.instances.create({ instanceId: 'affine-preview', ...built, root })
    await instance.telco.seek(0)

    const result = instance.snapshot.set([{
      target: { storyId: 'main', persoId: 'item' },
      timeMs: 0,
      state: { style: {
        width: 30,
        height: 18,
        [ITEM_PREVIEW_TRANSFORM_PROPERTY]: 'matrix(1, 0.25, 0.5, 1, 24, 32)',
        [ITEM_PREVIEW_WIDTH_PROPERTY]: '30px',
        [ITEM_PREVIEW_HEIGHT_PROPERTY]: '18px',
      } },
    }])
    expect(result.ok).toBe(true)

    const frame = root.querySelector<HTMLElement>('[data-item-id="main:item"]')!
    const transformAnchor = document.getElementById(`${frame.id}-transform`)!
    const native = root.querySelector<HTMLElement>('[data-editor-visual-for="item"]')!
    expect(transformAnchor.style.transform).toBe('matrix(1, 0.25, 0.5, 1, 24, 32)')
    expect(transformAnchor.style.width).toBe('30px')
    expect(transformAnchor.style.height).toBe('18px')
    expect(transformAnchor.style.transformOrigin).toBe('0px 0px')
    expect(native.style.getPropertyValue(ITEM_PREVIEW_TRANSFORM_PROPERTY)).toBe('')
    expect(native.style.getPropertyValue(ITEM_PREVIEW_WIDTH_PROPERTY)).toBe('')
    expect(native.style.getPropertyValue(ITEM_PREVIEW_HEIGHT_PROPERTY)).toBe('')

    instance.snapshot.clear()
    expect(transformAnchor.style.width).toBe('100%')
    expect(transformAnchor.style.height).toBe('100%')
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

  it('isolates author rules across independently loaded component modules', async () => {
    const roots = [document.createElement('div'), document.createElement('div')]
    document.body.append(...roots)
    for (const [index, root] of roots.entries()) {
      vi.resetModules()
      const { createItemComponent } = await import('../../src/item-presentation/item-component')
      const { CodPlay: FreshCodPlay } = await import('codplay')
      const { TagComponent } = await import('codplay/runtime/components')
      const { EDITOR_ENGINE_OPTIONS: freshOptions } = await import('../../src/item-presentation/engine-options')
      const owner = new FreshCodPlay({ engine: { components: { override: freshOptions.components.override.map(entry =>
        entry.type === 'tag' ? { ...entry, component: createItemComponent(TagComponent) } : entry,
      ) } } })
      owners.push(owner)
      const built = owner.build({ scene: scene() })
      expect(built.ok).toBe(true)
      if (!built.ok) return
      owner.instances.create({ instanceId: `module-${index}`, ...built, root })
    }
    const ids = roots.flatMap(root => [...root.querySelectorAll('[id]')].map(node => node.id))
    expect(new Set(ids).size).toBe(ids.length)
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
