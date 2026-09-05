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
}>

/** Resolves local motion containers without adding an author-facing contract. */
export class HtmlMotionContainerResolver {
  private readonly root: Element
  private readonly persoNodes: ReadonlyMap<string, unknown>
  private readonly targetNodes: ReadonlyMap<string, unknown>
  private readonly keys = new WeakMap<Element, string>()
  private nextKey = 1

  /** Creates one resolver bound to the runner's persistent HTML node maps. */
  constructor(
    root: Element,
    persoNodes: ReadonlyMap<string, unknown>,
    targetNodes: ReadonlyMap<string, unknown>,
  ) {
    this.root = root
    this.persoNodes = persoNodes
    this.targetNodes = targetNodes
  }

  /** Finds the nearest common DOM ancestor of the endpoints of one boundary. */
  resolve(input: HtmlMotionContainerSceneInput): HtmlMotionContainerResolution {
    const candidates: Element[] = []
    for (const itemId of input.itemIds) {
      addElement(candidates, this.persoNodes.get(itemId))
      for (const scene of input.scenes) {
        const targetId = scene.graph.targetByPerso[itemId]
        addElement(candidates, this.targetNodes.get(targetId ?? '') ?? this.persoNodes.get(targetId ?? ''))
        const parentId = scene.graph.parentByPerso[itemId]
        addElement(candidates, this.persoNodes.get(parentId ?? ''))
      }
    }

    const element = findCommonAncestor(candidates, input.root) ?? input.root
    return Object.freeze({ element, key: this.keyFor(element) })
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
}

/** Adds an HTML element once while ignoring non-DOM materializer handles. */
function addElement(target: Element[], value: unknown): void {
  if (!isElement(value) || target.includes(value)) return
  target.push(value)
}

/** Narrows one materializer value to a DOM element across browser realms. */
function isElement(value: unknown): value is Element {
  return typeof value === 'object'
    && value !== null
    && 'nodeType' in value
    && (value as { nodeType?: unknown }).nodeType === 1
    && 'parentElement' in value
}

/** Finds the nearest common ancestor that remains inside the runner root. */
function findCommonAncestor(candidates: readonly Element[], root: Element): Element | undefined {
  const first = candidates[0]
  if (first === undefined || !root.contains(first)) return undefined
  const ancestors = new Set<Element>()
  let current: Element | null = first
  while (current !== null && root.contains(current)) {
    ancestors.add(current)
    if (current === root) break
    current = current.parentElement
  }

  for (const candidate of candidates.slice(1)) {
    if (!root.contains(candidate)) return undefined
    const candidateAncestors = new Set<Element>()
    current = candidate
    while (current !== null && root.contains(current)) {
      candidateAncestors.add(current)
      if (current === root) break
      current = current.parentElement
    }
    for (const ancestor of [...ancestors]) {
      if (!candidateAncestors.has(ancestor)) ancestors.delete(ancestor)
    }
    if (ancestors.size === 0) return undefined
  }

  return [...ancestors][0]
}
