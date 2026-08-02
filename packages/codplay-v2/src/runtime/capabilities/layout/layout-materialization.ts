import { materializeTemplateString } from '../../components'
import type { MaterializedPart, BaseComponent } from '../../components'
import type { LayoutModuleServiceInstance } from './layout-capability'

/** Identity required to register one materialized component with the layout module. */
export type MaterializedComponentIdentity = Readonly<{
  componentId: string
  storyId: string
  componentType: string
}>

/** Input required to connect one already materialized component to layout. */
export type LayoutMaterializationInput<Initial extends Record<string, unknown>> = Readonly<{
  component: BaseComponent<Initial>
  identity: MaterializedComponentIdentity
  rootNode: unknown
  parts: readonly MaterializedPart[]
  publicParts: readonly MaterializedPart[]
}>

/**
 * Registers the public parts selected by the materialization boundary.
 *
 * The boundary, not the component or the layout service, decides which parts are
 * public. Private component parts must not be included in `publicParts`.
 */
export function registerMaterializedComponent(
  layout: LayoutModuleServiceInstance,
  identity: MaterializedComponentIdentity,
  publicParts: readonly MaterializedPart[],
): void {
  layout.registerComponent({
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
export function materializeComponentWithLayout<Initial extends Record<string, unknown>>(
  layout: LayoutModuleServiceInstance,
  input: LayoutMaterializationInput<Initial>,
): () => void {
  input.component._materialize(input.rootNode, input.parts)
  registerMaterializedComponent(layout, input.identity, input.publicParts)
  return () => unregisterMaterializedComponent(layout, input.identity.componentId)
}

/** Materializes a template-string component and registers all of its data-part nodes. */
export function materializeTemplateComponentWithLayout<Initial extends Record<string, unknown>>(
  layout: LayoutModuleServiceInstance,
  component: BaseComponent<Initial>,
  identity: MaterializedComponentIdentity,
): () => void {
  const materialization = materializeTemplateString(component.render())
  return materializeComponentWithLayout(layout, {
    component,
    identity,
    rootNode: materialization.rootNode,
    parts: materialization.parts,
    publicParts: materialization.parts,
  })
}

/** Removes one component registration when its materialized instance disappears. */
export function unregisterMaterializedComponent(
  layout: LayoutModuleServiceInstance,
  componentId: string,
): void {
  layout.unregisterComponent(componentId)
}
