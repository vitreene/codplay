import {
  materializeComponentWithMarkup,
  MARKUP_MODULE_SERVICE_ID,
  type MarkupModuleServiceInstance,
} from '../capabilities/markup'
import type { RuntimeModuleServiceInstance } from '../engine'
import type {
  BaseComponent,
  MaterializedPart,
  RuntimeComponentHandle,
  RuntimeComponentIdentity,
} from '../components'
import { materializeTemplateString } from '../components'

/** Mutable DOM maps owned by one HTML player host. */
export type HtmlComponentMaterializerNodes = Readonly<{
  persoNodes: Map<string, unknown>
  targetNodes: Map<string, unknown>
}>

/** Materializes V2 components and exposes their selected outlet parts. */
export class HtmlComponentMaterializer {
  private readonly nodes: HtmlComponentMaterializerNodes

  /** Creates one materializer attached to the host-owned node registries. */
  constructor(nodes: HtmlComponentMaterializerNodes) {
    this.nodes = nodes
  }

  /** Creates one DOM component instance and its deterministic cleanup action. */
  materialize(
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
          detachNode(rootNode)
          this.nodes.persoNodes.delete(identity.componentId)
          for (const part of publicParts) {
            if (this.nodes.targetNodes.get(part.partId) === part.nodeRef) this.nodes.targetNodes.delete(part.partId)
          }
        },
      }
    } catch (error) {
      this.nodes.persoNodes.delete(identity.componentId)
      detachNode(rootNode)
      throw error
    }
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
function detachNode(node: unknown): void {
  if (!isDetachableNode(node) || node.parentNode === null) return
  node.parentNode.removeChild(node)
}

/** Narrows a DOM-like node to the teardown operations used by this host. */
function isDetachableNode(value: unknown): value is {
  parentNode: { removeChild: (child: unknown) => void } | null
}
{
  if (typeof value !== 'object' || value === null || !('parentNode' in value)) return false
  const parent = (value as { parentNode?: unknown }).parentNode
  return parent === null
    || (typeof parent === 'object' && parent !== null && 'removeChild' in parent && typeof parent.removeChild === 'function')
}
