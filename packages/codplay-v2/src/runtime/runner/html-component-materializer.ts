import {
  materializeComponentWithMarkup,
  MARKUP_MODULE_SERVICE_ID,
  type MarkupModuleServiceInstance,
} from '../capabilities/markup'
import { resolvePresentationOrder, type SolvedPerso, type SolvedScene } from '../player/pipeline'
import type { RuntimeModuleServiceInstance } from '../engine'
import type {
  BaseComponent,
  MaterializedPart,
  RuntimeComponentHandle,
  RuntimeComponentIdentity,
} from '../components'
import { materializeTemplateString, type HtmlMaterializedRoot } from './html-template-materializer'
import { HTML_MATERIALIZER_ID } from '../catalog'
import type {
  RuntimeMaterializer,
  RuntimeMaterializerSceneContext,
} from '../materializer'
import type { HtmlMaterializerRuntimeContext } from '../../services/html-materializer-service-types'

export type { HtmlMaterializerRuntimeContext } from '../../services/html-materializer-service-types'

/** Mutable DOM maps owned by one HTML player host. */
export type HtmlComponentMaterializerNodes = Readonly<{
  persoNodes: Map<string, unknown>
  targetNodes: Map<string, unknown>
}>

/** Materializes V2 components and exposes their selected outlet parts. */
export class HtmlComponentMaterializer implements RuntimeMaterializer {
  readonly id = HTML_MATERIALIZER_ID
  readonly context: HtmlMaterializerRuntimeContext
  private readonly nodes: HtmlComponentMaterializerNodes
  private mountedPersos = new Set<string>()

  /** Creates one HTML materializer attached to the host-owned node registries. */
  constructor(
    nodes: HtmlComponentMaterializerNodes,
    context: HtmlMaterializerRuntimeContext = { numericLengthScale: 1 },
  ) {
    this.nodes = nodes
    this.context = context
  }

  /** Creates one DOM component instance and its deterministic cleanup action. */
  materializeComponent(
    component: BaseComponent<Record<string, unknown>>,
    identity: RuntimeComponentIdentity,
    initial: Record<string, unknown>,
    mountablePartIds: readonly string[],
    moduleServices: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  ): RuntimeComponentHandle {
    void initial
    const materialization = materializeTemplateString(component.render())
    const rootNode = materialization.rootNode
    const publicParts = selectPublicParts(materialization.parts, mountablePartIds)
    const markup = publicParts.length === 0
      ? undefined
      : requireMarkupService(moduleServices, identity.componentId)

    this.nodes.persoNodes.set(identity.componentId, rootNode)
    markHtmlItem(rootNode, identity.componentId)
    try {
      const cleanupMarkup = markup === undefined
        ? undefined
        : materializeComponentWithMarkup(markup, {
          component,
          identity,
          rootNode,
          parts: materialization.parts,
          publicParts,
        })
      if (cleanupMarkup === undefined) component._materialize(rootNode, materialization.parts)
      for (const part of publicParts) this.nodes.targetNodes.set(part.partId, part.nodeRef)

      let destroyed = false
      return {
        destroy: () => {
          if (destroyed) return
          destroyed = true
          cleanupMarkup?.()
          detachMaterializedRoot(rootNode)
          this.nodes.persoNodes.delete(identity.componentId)
          for (const part of publicParts) {
            if (this.nodes.targetNodes.get(part.partId) === part.nodeRef) this.nodes.targetNodes.delete(part.partId)
          }
        },
      }
    } catch (error) {
      this.nodes.persoNodes.delete(identity.componentId)
      detachMaterializedRoot(rootNode)
      throw error
    }
  }

  /**
   * Materializes solved parentage and child order without destroying detached author nodes.
   * Component cleanup only occurs through the final RuntimeComponentHandle.destroy().
   */
  materializeScene(scene: SolvedScene, _context: RuntimeMaterializerSceneContext = { moveDeltas: [] }): void {
    const childrenByTarget = resolvePresentationOrder(scene)
    const nextMountedPersos = new Set(
      Object.values(scene.persos)
        .filter((perso) => perso.placement.mounted)
        .map((perso) => perso.key),
    )

    for (const persoKey of this.mountedPersos) {
      if (!nextMountedPersos.has(persoKey)) detachStructuredRoot(this.nodes.persoNodes.get(persoKey))
    }

    for (const childKeys of Object.values(childrenByTarget)) {
      for (const childKey of childKeys) {
        const child = scene.persos[childKey]
        if (child === undefined || !child.placement.mounted) continue
        const parent = resolveParentNode(child, this.nodes)
        if (parent !== undefined) appendStructuredRoot(parent, this.nodes.persoNodes.get(childKey))
      }
    }

    this.mountedPersos = nextMountedPersos
  }

  /** Detaches all currently materialized roots from their structural parents. */
  destroy(): void {
    for (const persoKey of this.mountedPersos) detachStructuredRoot(this.nodes.persoNodes.get(persoKey))
    this.mountedPersos.clear()
  }
}

/** Keeps only the component parts explicitly published by its runtime definition. */
function selectPublicParts(parts: readonly MaterializedPart[], mountablePartIds: readonly string[]): readonly MaterializedPart[] {
  const allowed = new Set(mountablePartIds)
  return parts.filter((part) => allowed.has(part.partId))
}

/** Resolves the player-scoped markup capability required by public parts. */
function requireMarkupService(
  moduleServices: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  componentId: string,
): MarkupModuleServiceInstance {
  const markup = moduleServices.get(MARKUP_MODULE_SERVICE_ID)
  if (markup === undefined || !isMarkupModuleService(markup)) {
    throw new Error(`HTML component requires the markup module: ${componentId}`)
  }
  return markup
}

/** Checks the public markup methods needed by the materializer boundary. */
function isMarkupModuleService(value: RuntimeModuleServiceInstance): value is MarkupModuleServiceInstance {
  return 'registerComponent' in value
    && 'unregisterComponent' in value
    && typeof value.registerComponent === 'function'
    && typeof value.unregisterComponent === 'function'
}

/** Detaches one materialized root from its current DOM parent. */
function detachMaterializedRoot(root: HtmlMaterializedRoot): void {
  for (const node of materializedRootNodes(root)) {
    if (!isDetachableNode(node) || node.parentNode === null) continue
    node.parentNode.removeChild(node)
  }
}

/** Resolves one solved child's logical parent to a materialized node. */
function resolveParentNode(perso: SolvedPerso, nodes: HtmlComponentMaterializerNodes): unknown {
  const placement = perso.placement
  if (placement.target === undefined) return undefined
  if (placement.target.kind === 'perso') {
    return placement.parentKey === undefined ? undefined : nodes.persoNodes.get(placement.parentKey)
  }
  return nodes.targetNodes.get(placement.target.id)
}

/** Appends one materialized node through a DOM-like or plain-object parent. */
function appendStructuredRoot(parent: unknown, root: unknown): void {
  for (const child of materializedRootNodes(root)) appendStructuredNode(parent, child)
}

/** Detaches every real root of one persistent component materialization. */
function detachStructuredRoot(root: unknown): void {
  for (const node of materializedRootNodes(root)) detachStructuredNode(node)
}

/** Appends one real node without introducing a wrapper for a fragment. */
function appendStructuredNode(parent: unknown, child: unknown): void {
  if (parent === undefined || child === undefined || parent === child) return
  if (isAppendable(parent)) {
    parent.appendChild(child)
    return
  }
  if (!isObjectNode(parent) || !isObjectNode(child)) return

  detachStructuredNode(child)
  const children = Array.isArray(parent.children) ? parent.children : []
  parent.children = [...children, child]
  child.parentNode = parent
}

/** Detaches one node from its current structural parent. */
function detachStructuredNode(node: unknown): void {
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

/** Returns the persistent real roots represented by one component materialization. */
function materializedRootNodes(root: unknown): readonly unknown[] {
  if (root === undefined || root === null) return []
  return Array.isArray(root) ? root : [root]
}

/** Checks the minimal append contract supported by a real DOM parent. */
function isAppendable(value: unknown): value is { appendChild: (child: unknown) => void } {
  return isObjectNode(value) && typeof value.appendChild === 'function'
}

/** Checks the minimal remove contract supported by a real DOM parent. */
function isRemovable(value: unknown): value is { removeChild: (child: unknown) => void } {
  return isObjectNode(value) && typeof value.removeChild === 'function'
}

/** Narrows a value to the mutable node shape used by structural materialization. */
function isObjectNode(value: unknown): value is {
  parentNode?: unknown | null
  children?: unknown[]
  appendChild?: (child: unknown) => void
  removeChild?: (child: unknown) => void
} {
  return typeof value === 'object' && value !== null
}

/** Adds the stable runtime identity required by local HTML pose restoration. */
function markHtmlItem(root: HtmlMaterializedRoot, itemId: string): void {
  if (typeof HTMLElement === 'undefined') return
  for (const node of materializedRootNodes(root)) {
    if (node instanceof HTMLElement) node.dataset.itemId = itemId
  }
}

/** Narrows a DOM-like node to the teardown operations used by this host. */
function isDetachableNode(value: unknown): value is {
  parentNode: { removeChild: (child: unknown) => void } | null
} {
  if (typeof value !== 'object' || value === null || !('parentNode' in value)) return false
  const parent = (value as { parentNode?: unknown }).parentNode
  return parent === null
    || (typeof parent === 'object' && parent !== null && 'removeChild' in parent && typeof parent.removeChild === 'function')
}
