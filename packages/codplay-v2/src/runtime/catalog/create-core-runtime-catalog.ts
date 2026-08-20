import { LayoutComponent } from '../components/layout-component'
import { TagComponent } from '../components/tag-component'
import {
  HTML_MATERIALIZER_ID,
  RuntimeCapabilityCatalog,
  type RuntimeComponentDefinition,
  type RuntimeComponentServiceContext,
  type RuntimeComponentServiceInstance,
  type RuntimeComponentServiceDefinition,
} from './runtime-capability-catalog'
import { createMarkupModuleServiceDefinition } from '../capabilities/markup'
import { createListModuleServiceDefinition } from '../capabilities/list'
import { ATTR_SERVICE } from '../../services/attr/attr-service'
import { createHtmlAttrService } from '../../services/attr/html-attr-service'
import { CLASS_NAME_SERVICE } from '../../services/class-name/class-name-service'
import { createHtmlClassNameService } from '../../services/class-name/html-class-name-service'
import { CONTENT_SERVICE } from '../../services/content/content-service'
import { createHtmlContentService } from '../../services/content/html-content-service'
import { STYLE_SERVICE } from '../../services/style/style-service'
import { createHtmlStyleService } from '../../services/style/html-style-service'
import type { HtmlMaterializerRuntimeContext } from '../../services/html-materializer-service-types'
import type { ServiceValidationDefinition } from '../../services/service-validation-types'

/** Creates the single built-in catalog used by CodPlay V2 HTML instances. */
export function createCoreRuntimeCatalog(): RuntimeCapabilityCatalog {
  const catalog = new RuntimeCapabilityCatalog()
  catalog.registerService(createHtmlService(ATTR_SERVICE, () => createHtmlAttrService()), 'core')
  catalog.registerService(createHtmlService(CLASS_NAME_SERVICE, () => createHtmlClassNameService()), 'core')
  catalog.registerService(createHtmlService(CONTENT_SERVICE, () => createHtmlContentService()), 'core')
  catalog.registerService(createHtmlService(STYLE_SERVICE, (context) => createHtmlStyleService(htmlContext(context))), 'core')

  catalog.registerModule({ ...createMarkupModuleServiceDefinition(), origin: 'core' }, 'core')
  catalog.registerModule({ ...createListModuleServiceDefinition(), origin: 'core' }, 'core')

  catalog.registerComponent(coreTagDefinition, 'core')
  catalog.registerComponent(coreLayoutDefinition, 'core')
  catalog.registerComponent(coreListDefinition, 'core')
  return catalog
}

/** Combines one service's pure declaration with its selected materializer factory. */
function createHtmlService(
  declaration: ServiceValidationDefinition,
  create: (context: RuntimeComponentServiceContext) => RuntimeComponentServiceInstance,
): RuntimeComponentServiceDefinition {
  return {
    ...declaration,
    materializers: [HTML_MATERIALIZER_ID],
    create,
    origin: 'core',
  }
}

/** Narrows a generic materializer context to the HTML service context. */
function htmlContext(context: RuntimeComponentServiceContext): HtmlMaterializerRuntimeContext {
  if (context.materializerId !== HTML_MATERIALIZER_ID) {
    throw new Error(`HTML service received an unexpected materializer: ${context.materializerId}`)
  }
  if (!isHtmlMaterializerRuntimeContext(context.materializerContext)) {
    throw new Error('HTML materializer context is invalid.')
  }
  return context.materializerContext
}

/** Creates the built-in generic tag component declaration. */
const coreTagDefinition: RuntimeComponentDefinition = {
  type: 'tag',
  services: ['className', 'style', 'attr', 'content'],
  modules: [],
  validateInitial: () => undefined,
  validateAction: () => undefined,
  create: (input) => new TagComponent(input as never),
}

/** Creates the built-in layout component declaration. */
const coreLayoutDefinition: RuntimeComponentDefinition = {
  type: 'layout',
  services: ['className', 'style', 'attr'],
  modules: ['markup'],
  validateInitial: () => undefined,
  validateAction: () => undefined,
  create: (input) => new LayoutComponent(input as never),
  mountableParts: ['outlet', 'source-outlet', 'target-outlet'],
}

/** Creates the current list host declaration without a demo-only path. */
const coreListDefinition: RuntimeComponentDefinition = {
  type: 'list',
  services: ['className', 'style', 'attr'],
  modules: ['list'],
  validateInitial: () => undefined,
  validateAction: () => undefined,
  create: (input) => new TagComponent(input as never),
}

/** Checks the mutable HTML runtime context used by style conversion. */
function isHtmlMaterializerRuntimeContext(value: unknown): value is HtmlMaterializerRuntimeContext {
  return typeof value === 'object'
    && value !== null
    && 'numericLengthScale' in value
    && typeof (value as { numericLengthScale?: unknown }).numericLengthScale === 'number'
}
