import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'
import type { RuntimeNode } from '../../src/runtime/types'

type RuntimeNodeFixture = RuntimeNode & {
  children: RuntimeNodeFixture[]
  childNodes: RuntimeNodeFixture[]
  parentNode: RuntimeNodeFixture | null
  nodeType?: number
  namespaceURI?: string
  appendChild: (childNode: RuntimeNodeFixture) => RuntimeNodeFixture
  removeChild: (childNode: RuntimeNodeFixture) => RuntimeNodeFixture
}

type LayoutDomStub = {
  document: DocumentLike
  node: typeof globalThis.Node
  domParser: typeof globalThis.DOMParser
}

type DocumentLike = {
  createElement: (tagName: string) => RuntimeNodeFixture | TemplateFixture
  createElementNS: (namespaceURI: string, tagName: string) => RuntimeNodeFixture
}

type TemplateFixture = {
  content: {
    childNodes: RuntimeNodeFixture[]
    children: RuntimeNodeFixture[]
  }
  innerHTML: string
}

/**
 * Creates one plain runtime node fixture for one authored perso.
 */
function createRuntimeNodeFixture(tagName: string): RuntimeNodeFixture {
  const node: RuntimeNodeFixture = {
    tagName,
    style: {},
    attributes: {},
    children: [],
    childNodes: [],
    parentNode: null,
    appendChild(childNode) {
      if (childNode.parentNode !== null) {
        childNode.parentNode.removeChild(childNode)
      }

      this.children = this.children.filter((candidate) => candidate !== childNode).concat([childNode])
      this.childNodes = this.children
      childNode.parentNode = this
      return childNode
    },
    removeChild(childNode) {
      this.children = this.children.filter((candidate) => candidate !== childNode)
      this.childNodes = this.children
      if (childNode.parentNode === this) {
        childNode.parentNode = null
      }
      return childNode
    }
  }

  return node
}

/**
 * Parses one tiny markup fragment into fixture nodes.
 */
function parseMarkupFragment(markup: string, namespaceURI?: string): RuntimeNodeFixture[] {
  const rootNodes: RuntimeNodeFixture[] = []
  const stack: RuntimeNodeFixture[] = []
  const tokens = markup.match(/<[^>]+>|[^<]+/g) ?? []

  for (const token of tokens) {
    if (token.startsWith('<!--')) {
      continue
    }

    if (token.startsWith('</')) {
      stack.pop()
      continue
    }

    if (token.startsWith('<')) {
      const selfClosing = token.endsWith('/>')
      const innerToken = token.slice(1, selfClosing ? -2 : -1).trim()
      if (!innerToken) {
        continue
      }

      const firstSpaceIndex = innerToken.search(/\s/)
      const tagName = (firstSpaceIndex >= 0 ? innerToken.slice(0, firstSpaceIndex) : innerToken).toLowerCase()
      const rawAttributes = firstSpaceIndex >= 0 ? innerToken.slice(firstSpaceIndex + 1) : ''
      const node = createRuntimeNodeFixture(tagName)
      node.namespaceURI = namespaceURI

      for (const [attributeName, attributeValue] of Object.entries(parseAttributes(rawAttributes))) {
        if (attributeName === 'id' && typeof attributeValue === 'string') {
          node.id = attributeValue
        }

        if (attributeName === 'class' && typeof attributeValue === 'string') {
          node.className = attributeValue
        }

        node.attributes[attributeName] = attributeValue
      }

      if (stack.length > 0) {
        stack[stack.length - 1]?.appendChild(node)
      } else {
        rootNodes.push(node)
      }

      if (!selfClosing) {
        stack.push(node)
      }

      continue
    }

    const textContent = token.trim()
    if (textContent.length === 0 || stack.length === 0) {
      continue
    }

    const currentNode = stack[stack.length - 1]
    currentNode.textContent = `${currentNode.textContent ?? ''}${textContent}`
  }

  return rootNodes
}

/**
 * Parses one attribute list for the DOM stub.
 */
function parseAttributes(rawAttributes: string): Record<string, string | true> {
  const attributes: Record<string, string | true> = {}
  const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+)))?/g

  let match: RegExpExecArray | null
  while ((match = attributePattern.exec(rawAttributes)) !== null) {
    const name = match[1]
    if (!name) {
      continue
    }

    attributes[name] = match[2] ?? match[3] ?? match[4] ?? true
  }

  return attributes
}

/**
 * Builds a minimal DOM-like environment for layout parsing.
 */
function installLayoutDomStub(): LayoutDomStub {
  class NodeStub {
    static readonly TEXT_NODE = 3
  }

  const document: DocumentLike = {
    createElement(tagName: string) {
      if (tagName === 'template') {
        const template: TemplateFixture = {
          content: {
            childNodes: [],
            children: []
          },
          innerHTML: ''
        }

        Object.defineProperty(template, 'innerHTML', {
          get: () => '',
          set: (markup: string) => {
            const childNodes = parseMarkupFragment(markup)
            template.content.childNodes = childNodes
            template.content.children = childNodes
          }
        })

        return template
      }

      return createRuntimeNodeFixture(tagName)
    },
    createElementNS(namespaceURI: string, tagName: string) {
      return createRuntimeNodeFixture(tagName)
    }
  }

  class DOMParserStub {
    parseFromString(markup: string): { documentElement: RuntimeNodeFixture } {
      const root = createRuntimeNodeFixture('svg')
      root.namespaceURI = 'http://www.w3.org/2000/svg'
      for (const childNode of parseMarkupFragment(markup, 'http://www.w3.org/2000/svg')) {
        root.appendChild(childNode)
      }

      return { documentElement: root }
    }
  }

  return {
    document,
    node: NodeStub as unknown as typeof globalThis.Node,
    domParser: DOMParserStub as unknown as typeof globalThis.DOMParser
  }
}

/**
 * Installs the DOM stub used by the layout tests.
 */
function withLayoutDomStub(): () => void {
  const previousDocument = globalThis.document
  const previousNode = globalThis.Node
  const previousDOMParser = globalThis.DOMParser
  const stub = installLayoutDomStub()

  globalThis.document = stub.document as unknown as Document
  globalThis.Node = stub.node
  globalThis.DOMParser = stub.domParser

  return () => {
    globalThis.document = previousDocument
    globalThis.Node = previousNode
    globalThis.DOMParser = previousDOMParser
  }
}

/**
 * Creates one layout scene used to verify outlet mounting.
 */
function createLayoutSceneFixture(input: { format?: 'html' | 'svg'; includeMissingOutlet?: boolean } = {}): SceneDoc {
  const layoutMarkup =
    input.format === 'svg'
      ? '<g id="scene-layout:header"></g><g id="scene-layout:slot"></g>'
      : '<section class="layout-shell"><header id="scene-layout:header"></header><main id="scene-layout:slot"></main></section>'

  return {
    id: 'scene-layout',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        entries: ['scene-layout', 'story-main__title'],
        initial: undefined,
        persos: [
          {
            id: 'scene-layout',
            name: 'layout',
            type: 'layout',
            initial: {
              format: input.format,
              markup: layoutMarkup,
              outlets: input.includeMissingOutlet
                ? [
                    { id: 'scene-layout:header' },
                    { id: 'scene-layout:slot' },
                    { id: 'scene-layout:missing' }
                  ]
                : [
                    { id: 'scene-layout:header' },
                    { id: 'scene-layout:slot' }
                  ]
            },
            actions: {
              'scene-layout': null
            }
          },
          {
            id: 'story-main__title',
            name: 'title',
            type: 'text',
            initial: {
              move: {
                parentId: 'scene-layout:slot',
                mode: 'append'
              },
              content: 'hello'
            },
            actions: {
              'story-main__title': null
            }
          }
        ],
        straps: undefined,
        listen: []
      }
    },
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    tracks: {}
  }
}

describe('V1 - layout runtime', () => {
  let restoreDom: (() => void) | null = null

  beforeEach(() => {
    restoreDom = withLayoutDomStub()
  })

  afterEach(() => {
    restoreDom?.()
    restoreDom = null
  })

  it('mounts child persos into declared layout outlets', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    expect(await player.init(createLayoutSceneFixture())).toEqual({ ok: true })

    const registry = player.getRuntimeRegistry()
    expect(registry.getNodeById('scene-layout:header')).not.toBeNull()
    expect(registry.getNodeById('scene-layout:slot')).not.toBeNull()

    const insertedNode = registry.getNodeById('story-main__title') as RuntimeNodeFixture | null
    const slotNode = registry.getNodeById('scene-layout:slot') as RuntimeNodeFixture | null
    expect(insertedNode?.parentNode).toBe(slotNode)

    const layoutRoot = registry.getNodeById('scene-layout') as RuntimeNodeFixture | null
    expect(layoutRoot?.className).toBe('layout-shell')
    expect(layoutRoot?.children.map((child) => child.tagName.toLowerCase())).toEqual([
      'header',
      'main'
    ])
  })

  it('wraps multi-root svg markup in an svg root', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    expect(await player.init(createLayoutSceneFixture({ format: 'svg' }))).toEqual({ ok: true })

    const layoutRoot = player.getRuntimeRegistry().getNodeById('scene-layout') as RuntimeNodeFixture | null
    expect(layoutRoot?.tagName.toLowerCase()).toBe('svg')
    expect(player.getRuntimeRegistry().getNodeById('scene-layout:slot')).not.toBeNull()
  })

  it('warns when one declared outlet is missing from markup', async () => {
    const traces: Array<{ eventName: string; payload?: Record<string, unknown> }> = []
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    player.onTrace((row) => {
      traces.push({
        eventName: row.eventName,
        payload: row.payload
      })
    })

    expect(await player.init(createLayoutSceneFixture({ includeMissingOutlet: true }))).toEqual({ ok: true })

    expect(
      traces.some((trace) => trace.eventName === 'renderer:error' && trace.payload?.code === 'AUTHOR_LAYOUT_OUTLET_NOT_FOUND')
    ).toBe(true)
  })
})
