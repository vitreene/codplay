import type { RuntimeModuleServiceDefinition } from '../../engine'

/** Runtime module identifier for components declaring the generic list capability. */
export const LIST_MODULE_SERVICE_ID = 'list' as const

/** Registers list as a declared capability without owning structural state. */
export function createListModuleServiceDefinition(): RuntimeModuleServiceDefinition {
  return {
    id: LIST_MODULE_SERVICE_ID,
    create: () => ({}),
  }
}
