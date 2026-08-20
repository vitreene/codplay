import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import type { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner'
import type { CompiledScene } from '../../../src/scene/compiled'
import { SceneBuilder } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'
import type { Ticker } from '../../../src/runtime/engine'

class FakeNode {
  parentNode: FakeNode | null = null
  readonly childNodes: FakeNode[] = []
  readonly nodeType: number = 1
  textContent: string | null = null

  /** Appends a node after detaching it from its former parent. */
  appendChild<T extends FakeNode>(node: T): T {
    node.parentNode?.removeChild(node)
    this.childNodes.push(node)
    node.parentNode = this
    return node
  }

  /** Removes one direct child node. */
  removeChild<T extends FakeNode>(node: T): T {
    const index = this.childNodes.indexOf(node)
    if (index >= 0) this.childNodes.splice(index, 1)
    node.parentNode = null
    return node
  }

  /** Finds marked descendants in the small parser used by this test. */
  querySelectorAll(selector: string): FakeElement[] {
    const matches: FakeElement[] = []
    for (const child of this.childNodes) {
      if (child instanceof FakeElement && selector === '[data-part]' && child.attributes.has('data-part')) matches.push(child)
      matches.push(...child.querySelectorAll(selector))
    }
    return matches
  }
}

class FakeElement extends FakeNode {
  className = ''
  readonly attributes = new Map<string, string>()
  readonly style = Object.assign({ setProperty: (property: string, value: string) => { this.style[property] = value } }, {}) as Record<string, string> & { setProperty: (property: string, value: string) => void }

  /** Reads one fake HTML attribute. */
  hasAttribute(name: string): boolean {
    return this.attributes.has(name)
  }

  /** Reads one fake HTML attribute value. */
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  /** Stores one fake HTML attribute value. */
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  /** Removes one fake HTML attribute. */
  removeAttribute(name: string): void {
    this.attributes.delete(name)
  }
}

class FakeFragment extends FakeNode {
  readonly nodeType = 11
}

class FakeTemplate extends FakeElement {
  readonly content = new FakeFragment()

  /** Parses the restricted templates used by the runner vertical. */
  set innerHTML(markup: string) {
    parseMarkup(markup, this.content)
  }
}

/** Parses nested element tags and data-part attributes for the fake DOM. */
function parseMarkup(markup: string, fragment: FakeFragment): void {
  const stack: FakeNode[] = [fragment]
  for (const token of markup.matchAll(/<\/?([A-Za-z][A-Za-z0-9-]*)([^>]*)>/g)) {
    const closing = token[0].startsWith('</')
    if (closing) {
      stack.pop()
      continue
    }
    const element = new FakeElement()
    for (const attribute of token[2].matchAll(/([A-Za-z-]+)="([^"]*)"/g)) element.setAttribute(attribute[1], attribute[2])
    stack.at(-1)!.appendChild(element)
    if (!token[0].endsWith('/>')) stack.push(element)
  }
}

/** Installs the minimal DOM globals required by the HTML template materializer. */
function installFakeDom(): void {
  vi.stubGlobal('Element', FakeElement)
  vi.stubGlobal('DocumentFragment', FakeFragment)
  vi.stubGlobal('document', {
    createElement: (tag: string) => tag === 'template' ? new FakeTemplate() : new FakeElement(),
  })
}

/** Creates one deterministic ticker double for runner playback tests. */
function ticker(): Ticker {
  return {
    start: () => undefined,
    stop: () => undefined,
    isRunning: () => false,
  }
}

/** Creates runtime component definitions for the first HTML runner vertical. */
function runtimeCatalog(): RuntimeCapabilityCatalog {
  return createCoreRuntimeCatalog()
}

/** Declares one scene with a logical root-to-outlet move. */
function sceneDoc(): SceneDoc {
  return {
    id: 'html-runner',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'layout',
          type: 'layout',
          initial: { move: '@root', markup: '<section><main data-part="outlet"></main></section>' },
          actions: {},
        }, {
          id: 'item',
          type: 'tag',
          initial: { tag: 'article', move: { target: 'outlet' }, content: 'item' },
          actions: { moveToRoot: { move: { target: 'root-host' } } },
        }],
        listen: [],
        eventimes: [{ name: 'moveToRoot', startAt: 100 }],
      },
    },
  }
}

/** Builds the declared scene through the normative SceneDoc compiler boundary. */
function compiledScene(): CompiledScene {
  const build = new SceneBuilder(runtimeCatalog().validationSnapshot(), { createdAt: '2026-08-18T00:00:00.000Z' }).build(sceneDoc())
  if (!build.ok) throw new Error(build.diagnostics.errors.map((entry) => entry.message).join('\n'))
  return build.compiledScene
}

/** Builds a compiled scene whose only timeline change is continuous style state. */
function continuousCompiledScene(): CompiledScene {
  const scene: SceneDoc = {
    id: 'html-runner-continuous',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'item',
          type: 'tag',
          initial: {
            tag: 'article',
            move: '@root',
            style: { x: 0, y: 0, opacity: 0, backgroundColor: '#000000' },
          },
          actions: {
            animate: {
              style: {
                x: { from: 0, to: 100, duration: 1000, ease: 'linear' },
                y: { from: 0, to: 40, duration: 1000, ease: 'linear' },
                opacity: { from: 0, to: 1, duration: 1000, ease: 'linear' },
                backgroundColor: { from: '#000000', to: '#ffffff', duration: 1000, ease: 'linear' },
              },
            },
          },
        }],
        listen: [],
        eventimes: [{ name: 'animate', startAt: 100 }],
      },
    },
  }
  const build = new SceneBuilder(runtimeCatalog().validationSnapshot(), { createdAt: '2026-08-18T00:00:00.000Z' }).build(scene)
  if (!build.ok) throw new Error(build.diagnostics.errors.map((entry) => entry.message).join('\n'))
  return build.compiledScene
}

/** Declares one perso that is detached and reattached without being recreated. */
function persistentDetachSceneDoc(): SceneDoc {
  return {
    id: 'html-runner-persistent-detach',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'item',
          type: 'tag',
          initial: { tag: 'article', move: '@root', content: 'persistent' },
          actions: {
            detach: { move: '@off' },
            attach: { move: '@root' },
          },
        }],
        listen: [],
        eventimes: [
          { name: 'detach', startAt: 100 },
          { name: 'attach', startAt: 200 },
        ],
      },
    },
  }
}

/** Builds the persistent-detach runner fixture through the SceneDoc compiler boundary. */
function persistentDetachCompiledScene(): CompiledScene {
  const build = new SceneBuilder(runtimeCatalog().validationSnapshot(), { createdAt: '2026-08-18T00:00:00.000Z' }).build(persistentDetachSceneDoc())
  if (!build.ok) throw new Error(build.diagnostics.errors.map((entry) => entry.message).join('\n'))
  return build.compiledScene
}

/** Declares one list transfer whose explicit first mode must reach the DOM order. */
function listSceneDoc(): SceneDoc {
  return {
    id: 'html-runner-list-order',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'list',
          type: 'list',
          initial: { move: '@root', tag: 'section' },
          actions: {},
        }, {
          id: 'first',
          type: 'tag',
          initial: { tag: 'article', move: '@root', content: 'first' },
          actions: {
            transfer: { move: { target: 'list', mode: 'first', transition: { duration: 100, ease: 'linear' } } },
          },
        }, {
          id: 'second',
          type: 'tag',
          initial: { tag: 'article', move: { target: 'list' }, content: 'second' },
          actions: {},
        }],
        listen: [],
        eventimes: [{ name: 'transfer', startAt: 100 }],
      },
    },
  }
}

/** Builds the list-order runner fixture through the SceneDoc compiler boundary. */
function listCompiledScene(): CompiledScene {
  const build = new SceneBuilder(runtimeCatalog().validationSnapshot(), { createdAt: '2026-08-18T00:00:00.000Z' }).build(listSceneDoc())
  if (!build.ok) throw new Error(build.diagnostics.errors.map((entry) => entry.message).join('\n'))
  return build.compiledScene
}

/** Declares a first-mode transfer into a list nested below a markup outlet. */
function nestedListSceneDoc(): SceneDoc {
  return {
    id: 'html-runner-nested-list-order',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'source-layout',
          type: 'layout',
          initial: { move: '@root', markup: '<section><div data-part="source-outlet"></div></section>' },
          actions: {},
        }, {
          id: 'target-layout',
          type: 'layout',
          initial: { move: '@root', markup: '<section><div data-part="target-outlet"></div></section>' },
          actions: {},
        }, {
          id: 'list',
          type: 'list',
          initial: { tag: 'section', move: { target: 'target-outlet' } },
          actions: {},
        }, {
          id: 'first',
          type: 'tag',
          initial: { tag: 'article', move: { target: 'source-outlet' }, content: 'first' },
          actions: {
            transfer: { move: { target: 'list', mode: 'first', transition: { duration: 100, ease: 'linear' } } },
          },
        }, {
          id: 'second',
          type: 'tag',
          initial: { tag: 'article', move: { target: 'list' }, content: 'second' },
          actions: {},
        }, {
          id: 'third',
          type: 'tag',
          initial: { tag: 'article', move: { target: 'list' }, content: 'third' },
          actions: {},
        }],
        listen: [],
        eventimes: [{ name: 'transfer', startAt: 100 }],
      },
    },
  }
}

/** Builds the nested-list regression fixture through the SceneDoc compiler. */
function nestedListCompiledScene(): CompiledScene {
  const build = new SceneBuilder(runtimeCatalog().validationSnapshot(), { createdAt: '2026-08-18T00:00:00.000Z' }).build(nestedListSceneDoc())
  if (!build.ok) throw new Error(build.diagnostics.errors.map((entry) => entry.message).join('\n'))
  return build.compiledScene
}

/** Returns the child tag names currently mounted under one fake node. */
function childTags(node: FakeNode): readonly string[] {
  return node.childNodes.map((child) => child instanceof FakeElement ? child.getAttribute('data-part') ?? 'element' : 'fragment')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HtmlPlayerRunner', () => {
  it('preserves a detached perso node and component across seek until final destroy', () => {
    installFakeDom()
    const root = new FakeElement()
    const runner = new HtmlPlayerRunner({
      id: 'persistent-detach-runner',
      compiledScene: persistentDetachCompiledScene(),
      root: root as unknown as HTMLElement,
      rootTargets: [{ id: 'root-host', storyId: 'main' }],
      catalog: runtimeCatalog(),
    })

    expect(runner.init().ok).toBe(true)
    const item = runner.getPersoNode('main:item') as FakeElement
    expect(item.parentNode).toBe(root)

    expect(runner.seek(150).ok).toBe(true)
    expect(item.parentNode).toBeNull()
    expect(runner.getPersoNode('main:item')).toBe(item)

    expect(runner.seek(250).ok).toBe(true)
    expect(item.parentNode).toBe(root)
    expect(runner.getPersoNode('main:item')).toBe(item)

    runner.destroy()
    expect(runner.getPersoNode('main:item')).toBeUndefined()
  })

  it('materializes, moves, seeks and destroys a declarative HTML scene', () => {
    installFakeDom()
    const root = new FakeElement()
    const runner = new HtmlPlayerRunner({
      id: 'runner',
      compiledScene: compiledScene(),
      root: root as unknown as HTMLElement,
      rootTargets: [{ id: 'root-host', storyId: 'main' }],
      catalog: runtimeCatalog(),
      ticker: ticker(),
    })

    expect(runner.init().ok).toBe(true)
    const layout = runner.getPersoNode('main:layout') as FakeElement
    const item = runner.getPersoNode('main:item') as FakeElement
    const outlet = runner.getTargetNode('outlet') as FakeElement
    expect(root.childNodes).toEqual([layout])
    expect(outlet.childNodes).toEqual([item])

    runner.play(ticker())
    runner.advance(0)
    runner.advance(100)
    expect(root.childNodes).toEqual([layout, item])
    expect(outlet.childNodes).toEqual([])

    runner.pause()
    expect(runner.seek(100).ok).toBe(true)
    expect(root.childNodes).toEqual([layout, item])
    expect(outlet.childNodes).toEqual([])
    expect(runner.seek(0).ok).toBe(true)
    expect(root.childNodes).toEqual([layout])
    expect(outlet.childNodes).toEqual([item])
    expect(runner.getCurrentTimeMs()).toBe(0)
    expect(childTags(root)).toHaveLength(1)

    runner.resize()
    expect(runner.getMaterializationEpoch()).toBe(1)
    runner.destroy()
    expect(root.childNodes).toEqual([])
    expect(runner.getPersoNode('main:item')).toBeUndefined()
    expect(runner.getTargetNode('outlet')).toBeUndefined()
  })

  it('presents continuous color, opacity and translation without changing parentage', () => {
    installFakeDom()
    const root = new FakeElement()
    const runner = new HtmlPlayerRunner({
      id: 'continuous-runner',
      compiledScene: continuousCompiledScene(),
      root: root as unknown as HTMLElement,
      rootTargets: [{ id: 'root-host', storyId: 'main' }],
      catalog: runtimeCatalog(),
    })

    expect(runner.init().ok).toBe(true)
    const item = runner.getPersoNode('main:item') as FakeElement
    expect(item.style.transform).toBe('translate(0px, 0px)')
    expect(item.style.opacity).toBe('0')

    expect(runner.seek(600).ok).toBe(true)
    expect(item.style.transform).toBe('translate(50px, 20px)')
    expect(item.style.opacity).toBe('0.5')
    expect(item.style.backgroundColor).toBe('rgba(128, 128, 128, 1)')
    expect(item.parentNode).toBe(root)

    expect(runner.seek(1100).ok).toBe(true)
    expect(item.style.transform).toBe('translate(100px, 40px)')
    expect(item.style.backgroundColor).toBe('rgba(255, 255, 255, 1)')
    expect(item.parentNode).toBe(root)

    expect(runner.seek(0).ok).toBe(true)
    runner.play(ticker())
    runner.advance(0)
    runner.advance(600)
    expect(item.style.transform).toBe('translate(50px, 20px)')
    expect(item.style.opacity).toBe('0.5')
    expect(item.style.backgroundColor).toBe('rgba(128, 128, 128, 1)')

    runner.resize(2)
    expect(item.style.transform).toBe('translate(100px, 40px)')

    runner.pause()
    runner.destroy()
  })

  it('commits the list capability order before a first-mode FLIP transfer', () => {
    installFakeDom()
    const root = new FakeElement()
    const runner = new HtmlPlayerRunner({
      id: 'list-order-runner',
      compiledScene: listCompiledScene(),
      root: root as unknown as HTMLElement,
      rootTargets: [{ id: 'root-host', storyId: 'main' }],
      catalog: runtimeCatalog(),
    })

    expect(runner.init().ok).toBe(true)
    const list = runner.getPersoNode('main:list') as FakeElement
    const first = runner.getPersoNode('main:first') as FakeElement
    const second = runner.getPersoNode('main:second') as FakeElement
    expect(list.childNodes).toEqual([second])

    runner.play(ticker())
    runner.advance(0)
    runner.advance(100)

    expect(list.childNodes).toEqual([first, second])
    runner.destroy()
  })

  it('initializes list order after markup outlets are registered', () => {
    installFakeDom()
    const root = new FakeElement()
    const runner = new HtmlPlayerRunner({
      id: 'nested-list-order-runner',
      compiledScene: nestedListCompiledScene(),
      root: root as unknown as HTMLElement,
      rootTargets: [{ id: 'root-host', storyId: 'main' }],
      catalog: runtimeCatalog(),
    })

    expect(runner.init().ok).toBe(true)
    const list = runner.getPersoNode('main:list') as FakeElement
    const first = runner.getPersoNode('main:first') as FakeElement
    const second = runner.getPersoNode('main:second') as FakeElement
    const third = runner.getPersoNode('main:third') as FakeElement
    expect(list.childNodes).toEqual([second, third])

    runner.play(ticker())
    runner.advance(0)
    runner.advance(100)

    expect(list.childNodes).toEqual([first, second, third])
    runner.destroy()
  })
})
