import type { DiagnosticCollector } from '../../diagnostics'
import { validatePersoWithCatalog } from './validation-catalog'
import type { PersoValidationInput, ValidationCatalogSnapshot } from './validation-types'

/** Minimal capability set consumed by the compiled-scene validation engine. */
export type CompiledSceneValidationInput = Readonly<{
  persos: readonly PersoValidationInput[]
}>

/**
 * Consumes a validation catalog snapshot while guarding compiled-scene inputs.
 */
export class CompiledSceneValidationEngine {
  private readonly catalog: ValidationCatalogSnapshot

  /**
   * Creates one validation engine from the capabilities declared by CodPlay.
   */
  constructor(catalog: ValidationCatalogSnapshot) {
    this.catalog = catalog
  }

  /**
   * Validates all perso payloads without instantiating runtime components.
   */
  validate(input: CompiledSceneValidationInput, diagnostics: DiagnosticCollector): void {
    for (const perso of input.persos) {
      validatePersoWithCatalog(this.catalog, perso, diagnostics)
    }
  }
}
