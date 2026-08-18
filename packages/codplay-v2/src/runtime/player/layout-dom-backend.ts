import type { SolvedPerso, SolvedScene } from './pipeline'
import type { LayoutProjection, LayoutProjectionContext } from './layout-projection'

/** Nodes supplied by the component materializer to the layout projection backend. */
export type LayoutProjectionNodes = Readonly<{
  persoNodes: ReadonlyMap<string, unknown>
  targetNodes: ReadonlyMap<string, unknown>
}>

/** Applies solved logical parentage to already materialized component nodes. */
export class LayoutDomBackend implements LayoutProjection {
  private readonly defaultNodes: LayoutProjectionNodes | undefined
  private mountedPersos = new Set<string>()

  /** Creates a backend with optional fixed nodes for RuntimePlayer integration. */
  constructor(nodes?: LayoutProjectionNodes) {
    this.defaultNodes = nodes
  }

  /** Projects root, outlet and perso targets while preserving each target's child order. */
  project(scene: SolvedScene, context?: LayoutProjectionContext): void

  /** Supports direct node maps for isolated backend tests. */
  project(scene: SolvedScene, nodes: LayoutProjectionNodes): void

  project(scene: SolvedScene, contextOrNodes?: LayoutProjectionContext | LayoutProjectionNodes): void {
    const nodes = isLayoutProjectionNodes(contextOrNodes) ? contextOrNodes : this.defaultNodes
    if (nodes === undefined) throw new Error('Layout DOM backend nodes are not configured.')
    const nextMountedPersos = new Set(
      Object.values(scene.persos)
        .filter((perso) => perso.placement.mounted)
        .map((perso) => perso.key),
    )

    for (const persoKey of this.mountedPersos) {
      if (!nextMountedPersos.has(persoKey)) detachNode(nodes.persoNodes.get(persoKey))
    }

    for (const childKeys of Object.values(scene.childrenByTarget)) {
      for (const childKey of childKeys) {
        const child = scene.persos[childKey]
        if (child === undefined || !child.placement.mounted) continue
        const parent = resolveParentNode(child, nodes)
        if (parent !== undefined) appendNode(parent, nodes.persoNodes.get(childKey))
      }
    }

    this.mountedPersos = nextMountedPersos
  }

  /** Detaches all currently projected perso nodes. */
  destroy(): void {
    if (this.defaultNodes === undefined) return
    for (const persoKey of this.mountedPersos) detachNode(this.defaultNodes.persoNodes.get(persoKey))
    this.mountedPersos.clear()
  }
}

/** Distinguishes the isolated backend node map from a player projection context. */
function isLayoutProjectionNodes(value: LayoutProjectionContext | LayoutProjectionNodes | undefined): value is LayoutProjectionNodes {
  return value !== undefined && 'persoNodes' in value && 'targetNodes' in value
}

/** Resolves one solved child's logical parent to a materialized node. */
function resolveParentNode(perso: SolvedPerso, nodes: LayoutProjectionNodes): unknown {
  const placement = perso.placement
  if (placement.target === undefined) return undefined
  if (placement.target.kind === 'perso') {
    return placement.parentKey === undefined ? undefined : nodes.persoNodes.get(placement.parentKey)
  }
  return nodes.targetNodes.get(placement.target.id)
}

/** Appends one node through either a DOM-like or plain-object backend. */
function appendNode(parent: unknown, child: unknown): void {
  if (parent === undefined || child === undefined || parent === child) return
  if (isAppendable(parent)) {
    parent.appendChild(child)
    return
  }
  if (!isObjectNode(parent) || !isObjectNode(child)) return

  detachNode(child)
  const children = Array.isArray(parent.children) ? parent.children : []
  parent.children = [...children, child]
  child.parentNode = parent
}

/** Detaches one node from its current parent when the backend exposes parentage. */
function detachNode(node: unknown): void {
  if (!isObjectNode(node)) return
  const parent = node.parentNode
  if (parent === null || parent === undefined) return
  if (isRemovable(parent)) {
    parent.removeChild(node)
    return
  }
  if (isObjectNode(parent) && Array.isArray(parent.children)) {
    parent.children = parent.children.filter((child) => child !== node)
  }
  node.parentNode = null
}

/** Checks the minimal append contract supported by a real DOM parent. */
function isAppendable(value: unknown): value is { appendChild: (child: unknown) => void } {
  return isObjectNode(value) && typeof value.appendChild === 'function'
}

/** Checks the minimal remove contract supported by a real DOM parent. */
function isRemovable(value: unknown): value is { removeChild: (child: unknown) => void } {
  return isObjectNode(value) && typeof value.removeChild === 'function'
}

/** Narrows a value to a mutable object node used by the projection adapters. */
function isObjectNode(value: unknown): value is {
  parentNode?: unknown | null
  children?: unknown[]
  appendChild?: (child: unknown) => void
  removeChild?: (child: unknown) => void
} {
  return typeof value === 'object' && value !== null
}
