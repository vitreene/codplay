export {
  sanitizeMarkupTemplate,
} from './markup-sanitizer'
export {
  createMarkupModuleServiceDefinition,
  MarkupCapabilityState,
  MARKUP_MODULE_SERVICE_ID,
} from './markup-capability'
export {
  materializeComponentWithMarkup,
  materializeTemplateComponentWithMarkup,
  registerMaterializedComponent,
  unregisterMaterializedComponent,
} from './markup-materialization'
export type {
  ComponentMountRegistration,
  MarkupModuleServiceInstance,
  MountablePartDeclaration,
} from './markup-capability'
export type {
  MarkupMaterializationInput,
  MaterializedComponentIdentity,
} from './markup-materialization'
