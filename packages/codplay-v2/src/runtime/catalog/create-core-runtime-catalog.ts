import {
  ImageComponent,
  InputComponent,
  ListComponent,
  LayoutComponent,
  MediaComponent,
  PolygonComponent,
  sanitizeInputAction,
  sanitizeInputInitial,
  sanitizeListInitial,
  sanitizePolygonAction,
  sanitizePolygonInitial,
  sanitizeTagInitial,
  validateImageAction,
  validateImageInitial,
  validateInputAction,
  validateInputInitial,
  validateLayoutInitial,
  validateListInitial,
  validateMediaAction,
  validateMediaInitial,
  validatePolygonAction,
  validatePolygonInitial,
  TagComponent,
  validateTagInitial,
} from '../components'
import { correctionIconPartId, selectionIconPartId } from '../components/input'
import {
  RuntimeCapabilityCatalog,
  type RuntimeComponentDefinition,
} from './runtime-capability-catalog'
import { createMarkupModuleServiceDefinition } from '../capabilities/markup'
import { createListModuleServiceDefinition } from '../capabilities/list'
import { createMediaSyncModuleServiceDefinition } from '../capabilities/media-sync'
import {
  HTML_ATTR_SERVICE,
  HTML_CLASS_NAME_SERVICE,
  HTML_CONTENT_SERVICE,
  HTML_STYLE_SERVICE,
} from '../runner/html-service-definitions'

/** Creates the single built-in catalog used by CodPlay V2 HTML instances. */
export function createCoreRuntimeCatalog(): RuntimeCapabilityCatalog {
  const catalog = new RuntimeCapabilityCatalog()
  catalog.registerService(HTML_ATTR_SERVICE, 'core')
  catalog.registerService(HTML_CLASS_NAME_SERVICE, 'core')
  catalog.registerService(HTML_CONTENT_SERVICE, 'core')
  catalog.registerService(HTML_STYLE_SERVICE, 'core')

  catalog.registerModule({ ...createMarkupModuleServiceDefinition(), origin: 'core' }, 'core')
  catalog.registerModule({ ...createListModuleServiceDefinition(), origin: 'core' }, 'core')
  catalog.registerModule({ ...createMediaSyncModuleServiceDefinition(), origin: 'core' }, 'core')

  catalog.registerComponent(coreTagDefinition, 'core')
  catalog.registerComponent(coreImageDefinition, 'core')
  catalog.registerComponent(coreInputDefinition, 'core')
  catalog.registerComponent(coreLayoutDefinition, 'core')
  catalog.registerComponent(coreMediaDefinition, 'core')
  catalog.registerComponent(coreListDefinition, 'core')
  catalog.registerComponent(corePolygonDefinition, 'core')
  return catalog
}

/** Creates the built-in generic tag component declaration. */
const coreTagDefinition: RuntimeComponentDefinition = {
  type: 'tag',
  services: ['className', 'style', 'attr', 'content'],
  modules: [],
  validateInitial: validateTagInitial,
  sanitizeInitial: sanitizeTagInitial,
  create: (input) => new TagComponent(input as never),
}

/** Creates the core V2 image declaration under the V1-compatible `img` type. */
const coreImageDefinition: RuntimeComponentDefinition = {
  type: 'img',
  services: ['className', 'style', 'attr'],
  modules: [],
  validateInitial: validateImageInitial,
  validateAction: validateImageAction,
  create: (input) => new ImageComponent(input as never),
}

/** Creates the core V2 quiz input declaration and publishes only icon slots. */
const coreInputDefinition: RuntimeComponentDefinition = {
  type: 'input',
  services: ['className', 'style', 'attr', 'content'],
  modules: ['markup'],
  validateInitial: validateInputInitial,
  validateAction: validateInputAction,
  sanitizeInitial: sanitizeInputInitial,
  sanitizeAction: sanitizeInputAction,
  create: (input) => new InputComponent(input as never),
  mountablePartResolver: (identity) => [
    selectionIconPartId(identity.storyId, resolvePersoId(identity)),
    correctionIconPartId(identity.storyId, resolvePersoId(identity)),
  ],
}

/** Resolves the perso-local portion of the runtime component identity. */
function resolvePersoId(identity: { storyId: string; componentId: string }): string {
  const prefix = `${identity.storyId}:`
  return identity.componentId.startsWith(prefix) ? identity.componentId.slice(prefix.length) : identity.componentId
}

/** Creates the built-in layout component declaration. */
const coreLayoutDefinition: RuntimeComponentDefinition = {
  type: 'layout',
  services: ['className', 'style', 'attr'],
  modules: ['markup'],
  validateInitial: validateLayoutInitial,
  create: (input) => new LayoutComponent(input as never),
  mountableParts: ['outlet', 'source-outlet', 'target-outlet'],
}

/** Creates the built-in media component declaration. */
const coreMediaDefinition: RuntimeComponentDefinition = {
  type: 'media',
  services: ['className', 'style', 'attr'],
  modules: ['media-sync'],
  validateInitial: validateMediaInitial,
  validateAction: validateMediaAction,
  create: (input) => new MediaComponent(input as never),
  surfaces: (component) => component instanceof MediaComponent ? { media: component } : {},
}

/** Creates the V2 list host declaration backed by the list capability. */
const coreListDefinition: RuntimeComponentDefinition = {
  type: 'list',
  services: ['className', 'style', 'attr'],
  modules: ['list'],
  validateInitial: validateListInitial,
  sanitizeInitial: sanitizeListInitial,
  create: (input) => new ListComponent(input as never),
}

/** Creates the core V2 polygon declaration projected through the SVG materializer. */
const corePolygonDefinition: RuntimeComponentDefinition = {
  type: 'polygon',
  services: ['className', 'style', 'attr', 'content'],
  modules: [],
  validateInitial: validatePolygonInitial,
  validateAction: validatePolygonAction,
  sanitizeInitial: sanitizePolygonInitial,
  sanitizeAction: sanitizePolygonAction,
  create: (input) => new PolygonComponent(input as never),
}
