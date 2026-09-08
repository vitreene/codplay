import type { SolvedScene } from '../player'

/** DOM container and stable identity used by one captured motion boundary. */
export type HtmlMotionContainerResolution = Readonly<{
  element: Element
  key: string
}>

/** Inputs used to resolve the local parent of one motion boundary. */
export type HtmlMotionContainerSceneInput = Readonly<{
  root: Element
  scenes: readonly SolvedScene[]
  itemIds: readonly string[]
  /** Logical story whose items are being captured when the scope is local. */
  storyId?: string
  /** Stories touched by the source and destination sides of the boundary. */
  storyIds?: readonly string[]
}>

/** Resolves local motion containers without adding an author-facing contract. */
export class HtmlMotionContainerResolver {
  private readonly root: Element
  private readonly persoNodes: ReadonlyMap<string, unknown>
  private readonly keys = new WeakMap<Element, string>()
  private nextKey = 1

  /** Creates one resolver bound to the runner's persistent HTML node maps. */
  constructor(
    root: Element,
    persoNodes: ReadonlyMap<string, unknown>,
  ) {
    this.root = root
    this.persoNodes = persoNodes
  }

  /** Resolves the persistent presentation container owned by one story. */
  resolve(input: HtmlMotionContainerSceneInput): HtmlMotionContainerResolution {
    const storyIds = resolveStoryIds(input)
    if (storyIds.length !== 1) {
      return Object.freeze({ element: input.root, key: this.keyFor(input.root) })
    }

    const storyId = storyIds[0]!
    const key = this.storyKey(storyId)
    const storyContainer = resolveStoryContainerElement(
      input.scenes,
      storyId,
      this.persoNodes,
    )
    const element = storyContainer ?? input.root
    this.elementsByKey.set(key, element)
    return Object.freeze({ element, key })
  }

  /** Resolves a captured container identity during the later presentation pass. */
  resolveByKey(key: string | undefined): Element | undefined {
    if (key === undefined) return undefined
    if (this.keyFor(this.root) === key) return this.root
    // WeakMap is intentionally one-way; captured roots are kept in this map so
    // snapshots can select the same local DOM container without inspecting it.
    return this.elementsByKey.get(key)
  }

  /** Releases the resolver's strong references when its runner is destroyed. */
  clear(): void {
    this.elementsByKey.clear()
  }

  private readonly elementsByKey = new Map<string, Element>()

  /** Assigns one stable runner-local key to a DOM element. */
  private keyFor(element: Element): string {
    const existing = this.keys.get(element)
    if (existing !== undefined) return existing
    const key = `motion-container-${this.nextKey}`
    this.nextKey += 1
    this.keys.set(element, key)
    this.elementsByKey.set(key, element)
    return key
  }

  /** Registers the stable runner-local identity of one story container. */
  private storyKey(storyId: string): string {
    return `motion-story-${storyId}`
  }
}

/** Normalizes the stories touched by one boundary without inspecting the DOM. */
function resolveStoryIds(input: HtmlMotionContainerSceneInput): readonly string[] {
  const storyIds = input.storyIds ?? (input.storyId === undefined ? [] : [input.storyId])
  return [...new Set(storyIds.filter((storyId) => storyId.length > 0))]
}

/** Narrows one materializer value to a DOM element across browser realms. */
function isElement(value: unknown): value is Element {
  return typeof value === 'object'
    && value !== null
    && 'nodeType' in value
    && (value as { nodeType?: unknown }).nodeType === 1
    && 'parentElement' in value
}

/** Resolves one story's unique logical root without inspecting DOM ancestry. */
function resolveStoryContainerElement(
  scenes: readonly SolvedScene[],
  storyId: string,
  persoNodes: ReadonlyMap<string, unknown>,
): Element | undefined {
  const mountedRootKeys = new Set<string>()
  for (const scene of scenes) {
    for (const perso of Object.values(scene.persos)) {
      if (perso.storyId !== storyId) continue
      const parentKey = scene.graph.parentByPerso[perso.key]
      const parent = parentKey === undefined ? undefined : scene.persos[parentKey]
      if (parent?.storyId === storyId || perso.placement.mounted !== true) continue
      mountedRootKeys.add(perso.key)
    }
  }

  const roots = [...mountedRootKeys]
    .map((persoKey) => persoNodes.get(persoKey))
    .filter(isElement)
  return roots.length === 1 ? roots[0] : undefined
}
