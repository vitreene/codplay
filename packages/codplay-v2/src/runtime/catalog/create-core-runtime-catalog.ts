import { LayoutComponent, validateLayoutInitial } from '../components/layout-component'
import { ListComponent, validateListInitial } from '../components/list-component'
import { MediaComponent, validateMediaAction, validateMediaInitial } from '../components/media-component'
import { TagComponent, validateTagInitial } from '../components/tag-component'
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
  catalog.registerComponent(coreLayoutDefinition, 'core')
  catalog.registerComponent(coreMediaDefinition, 'core')
  catalog.registerComponent(coreListDefinition, 'core')
  return catalog
}

/** Creates the built-in generic tag component declaration. */
const coreTagDefinition: RuntimeComponentDefinition = {
  type: 'tag',
  services: ['className', 'style', 'attr', 'content'],
  modules: [],
  validateInitial: validateTagInitial,
  create: (input) => new TagComponent(input as never),
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
  create: (input) => new ListComponent(input as never),
}
