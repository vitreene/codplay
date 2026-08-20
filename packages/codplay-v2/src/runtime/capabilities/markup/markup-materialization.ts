import type { MaterializedPart, BaseComponent } from '../../components'
import type { MarkupModuleServiceInstance } from './markup-capability'

/** Identity required to register one materialized component with the markup module. */
export type MaterializedComponentIdentity = Readonly<{
  componentId: string
  storyId: string
  componentType: string
}>

/** Input required to connect one already materialized component to markup. */
export type MarkupMaterializationInput<Initial extends Record<string, unknown>> = Readonly<{
  component: BaseComponent<Initial>
  identity: MaterializedComponentIdentity
  rootNode: unknown
  parts: readonly MaterializedPart[]
  publicParts: readonly MaterializedPart[]
}>

/**
 * Registers the public parts selected by the materialization boundary.
 *
 * The boundary, not the component or the markup module, decides which parts are
 * public. Private component parts must not be included in `publicParts`.
 */
export function registerMaterializedComponent(
  markup: MarkupModuleServiceInstance,
  identity: MaterializedComponentIdentity,
  publicParts: readonly MaterializedPart[],
): void {
  markup.registerComponent({
    ...identity,
    parts: publicParts.map((part) => ({
      id: part.partId,
      ownerId: identity.componentId,
      storyId: identity.storyId,
      componentType: identity.componentType,
      partId: part.partId,
      kind: 'outlet' as const,
    })),
  })
}

/** Materializes one component boundary and returns its deterministic cleanup action. */
export function materializeComponentWithMarkup<Initial extends Record<string, unknown>>(
  markup: MarkupModuleServiceInstance,
  input: MarkupMaterializationInput<Initial>,
): () => void {
  input.component._materialize(input.rootNode, input.parts)
  registerMaterializedComponent(markup, input.identity, input.publicParts)
  return () => unregisterMaterializedComponent(markup, input.identity.componentId)
}

/** Removes one component registration when its materialized instance disappears. */
export function unregisterMaterializedComponent(
  markup: MarkupModuleServiceInstance,
  componentId: string,
): void {
  markup.unregisterComponent(componentId)
}
