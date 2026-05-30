/**
 * Describes the modules object injected into every component.
 */
export type ComponentModules = {
  declare(capabilities: readonly string[]): void
  readonly declared: readonly string[]
}

/**
 * Creates one ComponentModules instance for one component.
 */
export function createComponentModules(): ComponentModules {
  let declared: readonly string[] = []

  return {
    declare(capabilities: readonly string[]): void {
      declared = capabilities
    },
    get declared(): readonly string[] {
      return declared
    }
  }
}
