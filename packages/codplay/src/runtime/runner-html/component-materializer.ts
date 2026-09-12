import {
  MARKUP_MODULE_SERVICE_ID,
  type MarkupModuleServiceInstance,
} from '../capabilities/markup'
import { materializeComponentWithMarkup } from './markup-materialization'
import { resolvePresentationOrder, type SolvedPerso, type SolvedScene } from '../player/pipeline'
import type { RuntimeModuleServiceInstance } from '../engine'
import type {
  BaseComponent,
  ForeignContentSurface,
  MaterializedPart,
  ReplaceComponentSurface,
  RuntimeComponentHandle,
  RuntimeComponentIdentity,
} from '../components'
import { BaseHTMLComponent } from '../components'
import { materializeTemplateString, type HtmlMaterializedRoot } from './template-materializer'
import { MOUNT_TARGET_KIND_ANCHOR, MOUNT_TARGET_KIND_PERSO } from '../config/mount-target'
import { HTML_MATERIALIZER_ID } from '../catalog'
import type {
  RuntimeMaterializer,
  RuntimeMaterializerSceneContext,
} from '../materializer'
import type { HtmlMaterializerRuntimeContext } from '../../services/html-materializer-service-types'
import { isHtmlTransientNode } from './transient-node'
import { createHtmlReplacePresentationSurface } from './replace-presentation-surface'

export type { HtmlMaterializerRuntimeContext } from '../../services/html-materializer-service-types'

/** Mutable DOM maps owned by one HTML player host. */
export type HtmlComponentMaterializerNodes = Readonly<{
  persoNodes: Map<string, unknown>
  /** All rendered parts, including private controls used by V1-compatible refs. */
  persoParts?: Map<string, readonly MaterializedPart[]>
  targetNodes: Map<string, unknown>
}>

/** Materializes V2 components and exposes their selected outlet parts. */
export class HtmlComponentMaterializer implements RuntimeMaterializer {
  readonly id = HTML_MATERIALIZER_ID
  readonly context: HtmlMaterializerRuntimeContext
  private readonly nodes: HtmlComponentMaterializerNodes
  private readonly foreignAttachments = new Map<string, readonly unknown[]>()
  private mountedPersos = new Set<string>()
  private lastStructuralRevision: string | undefined
  private structureDirty = true

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
    mountablePartIds: readonly string[] | 'all',
    moduleServices: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  ): RuntimeComponentHandle {
    void initial
    if (!(component instanceof BaseHTMLComponent)) {
      throw new Error(`${this.id.toUpperCase()} materializer received a non-markup component: ${identity.componentType}`)
    }
    const materialization = materializeTemplateString(component.render(), {
      partMarkerPrefix: this.context.partMarkerPrefix,
    })
    const rootNode = materialization.rootNode
    const publicParts = selectPublicParts(materialization.parts, mountablePartIds)
    const markup = publicParts.length === 0
      ? undefined
      : requireMarkupService(moduleServices, identity.componentId)

    this.nodes.persoNodes.set(identity.componentId, rootNode)
    this.nodes.persoParts?.set(identity.componentId, materialization.parts)
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
          this.detachForeignContent(identity.componentId)
          detachMaterializedRoot(rootNode)
          this.nodes.persoNodes.delete(identity.componentId)
          this.nodes.persoParts?.delete(identity.componentId)
          for (const part of publicParts) {
            if (this.nodes.targetNodes.get(part.partId) === part.nodeRef) this.nodes.targetNodes.delete(part.partId)
          }
        },
      }
    } catch (error) {
      this.detachForeignContent(identity.componentId)
      this.nodes.persoNodes.delete(identity.componentId)
      this.nodes.persoParts?.delete(identity.componentId)
      detachMaterializedRoot(rootNode)
      throw error
    }
  }

  /**
   * Materializes solved parentage and child order without destroying detached author nodes.
   * Component cleanup only occurs through the final RuntimeComponentHandle.destroy().
   */
  materializeScene(scene: SolvedScene, _context: RuntimeMaterializerSceneContext = { moveDeltas: [] }): void {
    if (!this.structureDirty && this.lastStructuralRevision === scene.graph.revision) return
    const childrenByTarget = resolvePresentationOrder(scene)
    const nextMountedPersos = new Set(
      Object.values(scene.persos)
        .filter((perso) => perso.placement.mounted)
        .map((perso) => perso.key),
    )

    for (const persoKey of this.mountedPersos) {
      if (!nextMountedPersos.has(persoKey)) {
        this.detachForeignContent(persoKey)
        detachStructuredRoot(this.nodes.persoNodes.get(persoKey))
      }
    }

    const desiredRootsByDestination = new Map<unknown, {
      parent: unknown
      reference?: unknown
      roots: unknown[]
    }>()
    for (const childKeys of Object.values(childrenByTarget)) {
      for (const childKey of childKeys) {
        const child = scene.persos[childKey]
        if (child === undefined || !child.placement.mounted) continue
        const destination = resolveStructuralDestination(child, this.nodes)
        if (destination === undefined) continue
        const key = destination.reference ?? destination.parent
        const entry = desiredRootsByDestination.get(key) ?? {
          ...destination,
          roots: [],
        }
        for (const root of materializedRootNodes(this.nodes.persoNodes.get(childKey))) {
          if (!isHtmlTransientNode(root)) entry.roots.push(root)
        }
        desiredRootsByDestination.set(key, entry)
      }
    }

    for (const { parent, reference, roots } of desiredRootsByDestination.values()) {
      reconcileStructuredRoots(
        parent,
        roots,
        (node) => isHtmlTransientNode(node) || this.isForeignRoot(node),
        reference,
      )
    }

    this.mountedPersos = nextMountedPersos
    this.lastStructuralRevision = scene.graph.revision
    this.structureDirty = false
  }

  /** Invalidates the structural fast path after an external transient DOM move. */
  invalidateStructure(): void {
    this.structureDirty = true
  }

  /** Returns the host-owned surface used by a content owner to expose foreign roots. */
  getForeignContentSurface(componentId: string): ForeignContentSurface {
    return {
      attach: (roots, referenceRoot) => this.attachForeignContent(componentId, roots, referenceRoot),
      detach: () => this.detachForeignContent(componentId),
    }
  }

  /** Returns the presentation-only surface used by the shared replace module. */
  getReplaceSurface(componentId: string): ReplaceComponentSurface | undefined {
    return createHtmlReplacePresentationSurface(this.nodes.persoNodes.get(componentId))
  }

  /** Detaches all currently materialized roots from their structural parents. */
  destroy(): void {
    for (const componentId of this.foreignAttachments.keys()) this.detachForeignContent(componentId)
    for (const persoKey of this.mountedPersos) detachStructuredRoot(this.nodes.persoNodes.get(persoKey))
    this.mountedPersos.clear()
    this.foreignAttachments.clear()
    this.lastStructuralRevision = undefined
    this.structureDirty = true
  }

  /** Attaches an ordered foreign-root representation into one materialized host. */
  private attachForeignContent(
    componentId: string,
    roots: readonly unknown[],
    referenceRoot?: unknown,
  ): void {
    const host = this.nodes.persoNodes.get(componentId)
    if (!isAppendable(host)) {
      throw new Error(`Foreign content host is not materialized as an appendable node: ${componentId}`)
    }

    this.detachForeignContent(componentId)
    const attached: unknown[] = []
    try {
      const canInsertBefore = referenceRoot !== undefined
        && isInsertable(host)
        && isObjectNode(referenceRoot)
        && referenceRoot.parentNode === host
      for (const root of roots) {
        if (!isObjectNode(root) || root === host || root === referenceRoot) {
          throw new Error(`Foreign content root is not attachable for component: ${componentId}`)
        }
        if (canInsertBefore) host.insertBefore(root, referenceRoot)
        else host.appendChild(root)
        attached.push(root)
      }
      this.foreignAttachments.set(componentId, attached)
    } catch (error) {
      for (const root of attached) {
        if (isObjectNode(root) && root.parentNode === host && isRemovable(host)) host.removeChild(root)
      }
      throw error
    }
  }

  /** Detaches the current foreign representation without destroying its roots. */
  private detachForeignContent(componentId: string): void {
    const roots = this.foreignAttachments.get(componentId)
    if (roots === undefined) return
    const host = this.nodes.persoNodes.get(componentId)
    if (isRemovable(host)) {
      for (const root of roots) {
        if (isObjectNode(root) && root.parentNode === host) host.removeChild(root)
      }
    }
    this.foreignAttachments.delete(componentId)
  }

  /** Reports whether a node is currently owned by a foreign attachment relation. */
  private isForeignRoot(node: unknown): boolean {
    for (const roots of this.foreignAttachments.values()) {
      if (roots.includes(node)) return true
    }
    return false
  }
}

/** Keeps only the template zones made available by the component definition. */
function selectPublicParts(
  parts: readonly MaterializedPart[],
  mountablePartIds: readonly string[] | 'all',
): readonly MaterializedPart[] {
  if (mountablePartIds === 'all') return parts
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

/** Resolves one solved placement to a parent and, for an anchor, an insertion reference. */
function resolveStructuralDestination(
  perso: SolvedPerso,
  nodes: HtmlComponentMaterializerNodes,
): { parent: unknown; reference?: unknown } | undefined {
  const placement = perso.placement
  if (placement.target === undefined) return undefined
  if (placement.target.kind === MOUNT_TARGET_KIND_PERSO) {
    if (placement.parentKey === undefined) return undefined
    const parent = nodes.persoNodes.get(placement.parentKey)
    return parent === undefined ? undefined : { parent }
  }
  const targetNode = nodes.targetNodes.get(placement.target.id)
  if (placement.target.kind === MOUNT_TARGET_KIND_ANCHOR) {
    if (!isObjectNode(targetNode)) return undefined
    const parent = targetNode.parentNode
    return parent === undefined || parent === null
      ? undefined
      : { parent, reference: targetNode }
  }
  return targetNode === undefined ? undefined : { parent: targetNode }
}

/** Reconciles author roots while preserving nodes owned by a transient preview. */
function reconcileStructuredRoots(
  parent: unknown,
  desiredRoots: readonly unknown[],
  isIgnoredNode: (node: unknown) => boolean = isHtmlTransientNode,
  reference?: unknown,
): void {
  if (reference !== undefined) {
    if (!isInsertable(parent) || !isObjectNode(reference) || reference.parentNode !== parent) return
    for (const child of desiredRoots) {
      if (!isObjectNode(child) || child === reference || isIgnoredNode(child)) continue
      parent.insertBefore(child, reference)
    }
    return
  }
  for (const child of desiredRoots) reconcileStructuredNode(parent, child, desiredRoots, isIgnoredNode)
}

/** Detaches every real root of one persistent component materialization. */
function detachStructuredRoot(root: unknown): void {
  for (const node of materializedRootNodes(root)) detachStructuredNode(node)
}

/** Places one real node without introducing a wrapper for a fragment. */
function reconcileStructuredNode(
  parent: unknown,
  child: unknown,
  desiredRoots: readonly unknown[],
  isIgnoredNode: (node: unknown) => boolean = isHtmlTransientNode,
): void {
  if (parent === undefined || child === undefined || parent === child) return
  if (isIgnoredNode(child)) return
  if (isAppendable(parent)) {
    const managedChildren = Array.from(parent.children ?? []).filter((node) => !isIgnoredNode(node))
    const desiredIndex = desiredRoots.indexOf(child)
    const currentIndex = managedChildren.indexOf(child)
    const childNode = isObjectNode(child) ? child : undefined
    if (childNode?.parentNode === parent && desiredIndex >= 0 && currentIndex === desiredIndex) return

    const reference = desiredRoots
      .slice(desiredIndex + 1)
      .find((node) => node !== child
        && isObjectNode(node)
        && node.parentNode === parent
        && !isIgnoredNode(node))
    if (reference !== undefined && isInsertable(parent)) parent.insertBefore(child, reference)
    else parent.appendChild(child)
    return
  }
  if (!isObjectNode(parent) || !isObjectNode(child)) return

  const children = Array.isArray(parent.children) ? parent.children : []
  const managedChildren = children.filter((node) => !isIgnoredNode(node))
  const desiredIndex = desiredRoots.indexOf(child)
  if (child.parentNode === parent && desiredIndex >= 0 && managedChildren.indexOf(child) === desiredIndex) return

  detachStructuredNode(child)
  const referenceIndex = desiredRoots
    .slice(desiredIndex + 1)
    .map((node) => children.indexOf(node))
    .find((index) => index >= 0)
  const nextChildren = [...children]
  if (referenceIndex === undefined) nextChildren.push(child)
  else nextChildren.splice(referenceIndex, 0, child)
  parent.children = nextChildren
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
function isAppendable(value: unknown): value is {
  parentNode?: unknown | null
  children?: unknown[]
  appendChild: (child: unknown) => void
} {
  return isObjectNode(value) && typeof value.appendChild === 'function'
}

/** Checks the optional insertion contract used to preserve an existing sibling. */
function isInsertable(value: unknown): value is {
  insertBefore: (child: unknown, reference: unknown) => void
} {
  return isObjectNode(value) && typeof value.insertBefore === 'function'
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
  insertBefore?: (child: unknown, reference: unknown) => void
  removeChild?: (child: unknown) => void
} {
  return typeof value === 'object' && value !== null
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
