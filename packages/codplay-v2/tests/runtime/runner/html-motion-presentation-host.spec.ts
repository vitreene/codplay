/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { HtmlMotionPresentationHost } from '../../../src/runtime/runner'
import type { HtmlMatrix, HtmlPose } from '../../../src/runtime/motion/html-types'
import { createMotionRootPose } from '../../../src/runtime/motion'
import type { ItemPresentation, PresentationFrame } from '../../../src/runtime/motion'

const IDENTITY: HtmlMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

describe('HtmlMotionPresentationHost overlay resources', () => {
  it('reuses a stable overlay node across presentation frames', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    source.textContent = 'source'
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const frame = createReparentFrame(createPose(0))

    host.commit(frame, () => 'revision-1')
    const firstGhost = root.querySelector<HTMLElement>('[data-codplay-motion-item="item"]')
    expect(firstGhost).not.toBeNull()

    host.prepareNaturalCapture()
    expect(firstGhost?.hasAttribute('data-codplay-motion-hidden')).toBe(true)
    expect(source.hasAttribute('data-codplay-motion-hidden')).toBe(false)
    host.commit(frame, () => 'revision-1')
    const secondGhost = root.querySelector<HTMLElement>('[data-codplay-motion-item="item"]')

    expect(secondGhost).toBe(firstGhost)
    expect(firstGhost?.hasAttribute('data-codplay-motion-hidden')).toBe(false)
    expect(root.querySelectorAll('[data-codplay-motion-item="item"]')).toHaveLength(1)
    host.destroy()
    root.remove()
  })

  it('updates stable template content without creating a replacement node', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    source.textContent = 'before'
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const frame = createReparentFrame(createPose(0))
    host.commit(frame, () => 'revision-1')
    const ghost = root.querySelector<HTMLElement>('[data-codplay-motion-item="item"]')

    source.textContent = 'after'
    host.prepareNaturalCapture()
    host.commit(frame, () => 'revision-2')

    expect(root.querySelector<HTMLElement>('[data-codplay-motion-item="item"]')).toBe(ghost)
    expect(ghost?.textContent).toBe('after')
    host.destroy()
    root.remove()
  })

  it('reapplies host-owned dimensions after synchronizing a stable template', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    source.textContent = 'before'
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const frame = createReparentFrame(createPose(0))
    host.commit(frame, () => 'revision-1')
    const ghost = root.querySelector<HTMLElement>('[data-codplay-motion-item="item"]')

    expect(ghost?.style.width).toBe('20px')
    expect(ghost?.style.height).toBe('20px')

    source.textContent = 'after'
    host.prepareNaturalCapture()
    host.commit(frame, () => 'revision-2')

    expect(root.querySelector<HTMLElement>('[data-codplay-motion-item="item"]')).toBe(ghost)
    expect(ghost?.style.width).toBe('20px')
    expect(ghost?.style.height).toBe('20px')
    host.destroy()
    root.remove()
  })

  it('does not write neutral transform longhands to an overlay ghost', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    host.commit(createReparentFrame(createPose(0)))
    const ghost = root.querySelector<HTMLElement>('[data-codplay-motion-item="item"]')

    expect(ghost?.style.getPropertyValue('translate')).toBe('')
    expect(ghost?.style.getPropertyValue('rotate')).toBe('')
    expect(ghost?.style.getPropertyValue('scale')).toBe('')
    host.destroy()
    root.remove()
  })

  it('gates authored CSS transitions during a logical seek', () => {
    const root = document.createElement('main')
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => undefined)
    host.prepareSeek()

    expect(root.hasAttribute('data-codplay-motion-seek')).toBe(true)
    expect([...document.querySelectorAll('style')]
      .some((style) => style.textContent?.includes('[data-codplay-motion-seek] *'))).toBe(true)

    host.completeSeek()
    expect(root.hasAttribute('data-codplay-motion-seek')).toBe(false)
    host.destroy()
    root.remove()
  })

  it('neutralizes a non-default author transform longhand before applying the pose matrix', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    source.style.rotate = '20deg'
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    host.commit(createReparentFrame(createPose(0)))
    const ghost = root.querySelector<HTMLElement>('[data-codplay-motion-item="item"]')

    expect(ghost?.style.getPropertyValue('rotate')).toBe('none')
    host.destroy()
    root.remove()
  })

  it('recreates only when the author subtree structure changes', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    source.textContent = 'before'
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const frame = createReparentFrame(createPose(0))
    host.commit(frame, () => 'revision-1')
    const firstGhost = root.querySelector<HTMLElement>('[data-codplay-motion-item="item"]')

    source.replaceChildren(document.createElement('span'))
    host.prepareNaturalCapture()
    host.commit(frame, () => 'revision-2')
    const secondGhost = root.querySelector<HTMLElement>('[data-codplay-motion-item="item"]')

    expect(secondGhost).not.toBe(firstGhost)
    expect(root.querySelectorAll('[data-codplay-motion-item="item"]')).toHaveLength(1)
    host.destroy()
    root.remove()
  })

  it('reconciles reused ghost order and clears stale hidden descendant markers', () => {
    const root = document.createElement('main')
    const parent = document.createElement('section')
    parent.dataset.itemId = 'parent'
    const child = document.createElement('article')
    child.dataset.itemId = 'child'
    child.textContent = 'child'
    parent.appendChild(child)
    root.appendChild(parent)
    document.body.appendChild(root)

    const handles = new Map([
      ['parent', parent],
      ['child', child],
    ])
    const host = new HtmlMotionPresentationHost(root, (itemId) => handles.get(itemId))

    host.commit(createFrame([createItem('child')]))
    host.prepareNaturalCapture()
    host.commit(createFrame([
      createItem('child', 'parent'),
      createItem('parent'),
    ]))

    const layer = root.querySelector<HTMLElement>('[data-codplay-motion-overlay]')
    expect(layer).not.toBeNull()
    expect([...layer!.children].map((node) => node.getAttribute('data-codplay-motion-item')))
      .toEqual(['parent', 'child'])
    const parentGhost = layer!.querySelector<HTMLElement>('[data-codplay-motion-item="parent"]')
    expect(parentGhost?.querySelector('[data-codplay-motion-hidden]')).not.toBeNull()

    host.prepareNaturalCapture()
    host.commit(createFrame([createItem('parent')]))

    expect(root.querySelector<HTMLElement>('[data-codplay-motion-item="parent"]')
      ?.querySelector('[data-codplay-motion-hidden]')).toBeNull()
    host.destroy()
    root.remove()
  })

  it('reapplies descendant masking after a natural-capture pass with the same active set', () => {
    const root = document.createElement('main')
    const parent = document.createElement('section')
    parent.dataset.itemId = 'parent'
    const child = document.createElement('article')
    child.dataset.itemId = 'child'
    child.textContent = 'child'
    parent.appendChild(child)
    root.appendChild(parent)
    document.body.appendChild(root)

    const handles = new Map([
      ['parent', parent],
      ['child', child],
    ])
    const host = new HtmlMotionPresentationHost(root, (itemId) => handles.get(itemId))
    const frame = createFrame([
      createItem('child', 'parent'),
      createItem('parent'),
    ])

    host.commit(frame)
    const parentGhost = root.querySelector<HTMLElement>('[data-codplay-motion-item="parent"]')
    expect(parentGhost?.querySelector('[data-item-id="child"]')
      ?.hasAttribute('data-codplay-motion-hidden')).toBe(true)

    host.prepareNaturalCapture()
    host.commit(frame)

    expect(parentGhost?.querySelector('[data-item-id="child"]')
      ?.hasAttribute('data-codplay-motion-hidden')).toBe(true)
    host.destroy()
    root.remove()
  })

  it('keeps a local descendant inside its reparented ancestor ghost', () => {
    const root = document.createElement('main')
    const parent = document.createElement('section')
    const child = document.createElement('article')
    parent.appendChild(child)
    root.appendChild(parent)
    document.body.appendChild(root)

    const handles = new Map([
      ['parent', parent],
      ['child', child],
    ])
    const host = new HtmlMotionPresentationHost(root, (itemId) => handles.get(itemId))
    host.commit(createFrame([
      createItem('parent'),
      { ...createItem('child', 'parent'), representation: 'local' },
    ]))

    const layer = root.querySelector<HTMLElement>('[data-codplay-motion-overlay]')
    const parentGhost = layer?.querySelector<HTMLElement>('[data-codplay-motion-item="parent"]')
    expect(layer?.querySelectorAll(':scope > [data-codplay-motion-item]')).toHaveLength(1)
    expect(parentGhost?.querySelector('[data-codplay-motion-transform]')).not.toBeNull()
    expect(child.hasAttribute('data-codplay-motion-transform')).toBe(false)

    host.destroy()
    root.remove()
  })

  it('uses the parent-relative local pose before writing a local pose', () => {
    const root = document.createElement('main')
    const source = document.createElement('article')
    root.appendChild(source)
    document.body.appendChild(root)

    const host = new HtmlMotionPresentationHost(root, () => source)
    const pose = createPose(40)
    host.commit(
      createFrame([{ ...createItem('item'), representation: 'local', pose }]),
      undefined,
      {
        timeMs: 0,
        revision: 'layout',
        rootPose: createMotionRootPose(),
        items: new Map([[
          'item',
          {
            itemId: 'item',
            targetId: 'root',
            localPose: { origin: [40, 0], matrix: IDENTITY, width: 20, height: 20 },
            rootPose: pose,
          },
        ]]),
      },
    )

    expect(source.style.getPropertyValue('--codplay-motion-transform'))
      .toBe('matrix(1, 0, 0, 1, 0, 0)')
    host.destroy()
    root.remove()
  })
})

/** Creates the smallest reparent frame accepted by the HTML presentation host. */
function createReparentFrame(pose: HtmlPose): PresentationFrame {
  return {
    timeMs: 0,
    graphRevision: 'graph',
    layoutRevision: 'layout',
    items: new Map([[
      'item',
      {
        itemId: 'item',
        pose,
        representation: 'reparent',
        progress: 0.5,
      },
    ]]),
  }
}

/** Creates one compact presentation frame in caller-defined map order. */
function createFrame(items: readonly ItemPresentation[]): PresentationFrame {
  return {
    timeMs: 0,
    graphRevision: 'graph',
    layoutRevision: 'layout',
    items: new Map(items.map((item) => [item.itemId, item])),
  }
}

/** Creates one reparented item for host lifecycle assertions. */
function createItem(itemId: string, parentItemId?: string): ItemPresentation {
  return {
    itemId,
    parentItemId,
    pose: createPose(0),
    representation: 'reparent',
    progress: 0.5,
  }
}

/** Creates one deterministic pose for a jsdom presentation test. */
function createPose(x: number): HtmlPose {
  return {
    rect: { left: x, top: 0, width: 20, height: 20 },
    origin: { x, y: 0 },
    matrix: IDENTITY,
    parentMatrix: IDENTITY,
    rotationMatrix: IDENTITY,
    scaleX: 1,
    scaleY: 1,
    localWidth: 20,
    localHeight: 20,
    frameWidth: 20,
    frameHeight: 20,
  }
}
