import type { DiagnosticCollector } from '../../diagnostics'
import { validatePersoWithCapabilities } from './validate-perso-with-capabilities'
import type {
  PersoValidationInput,
  CapabilityValidationSnapshot,
  ComponentSanitizer,
} from './validation-types'
import type { MarkupAttributeSanitizer } from '../../services'

/** Minimal capability set consumed by the compiled-scene validation engine. */
export type CompiledSceneValidationInput = Readonly<{
  persos: readonly PersoValidationInput[]
}>

/**
 * Consumes a validation catalog snapshot while guarding compiled-scene inputs.
 */
export class CompiledSceneValidationEngine {
  private readonly catalog: CapabilityValidationSnapshot

  /**
   * Creates one validation engine from the capabilities declared by CodPlay.
   */
  constructor(catalog: CapabilityValidationSnapshot) {
    this.catalog = catalog
  }

  /**
   * Validates all perso payloads without instantiating runtime components.
   */
  validate(input: CompiledSceneValidationInput, diagnostics: DiagnosticCollector): void {
    for (const perso of input.persos) {
      validatePersoWithCapabilities(this.catalog, perso, diagnostics)
    }
  }

  /** Returns the services declared by one registered component type. */
  servicesFor(type: string): readonly string[] {
    return this.catalog.components.get(type)?.services ?? []
  }

  /** Returns the runtime module-service requirements declared by one component type. */
  modulesFor(type: string): readonly string[] {
    return this.catalog.components.get(type)?.modules ?? []
  }

  /** Sanitizes one validated initial component profile before compilation. */
  sanitizeInitial(type: string, value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    return this.sanitize(type, 'sanitizeInitial', value)
  }

  /** Sanitizes one validated action patch before compilation. */
  sanitizeAction(type: string, value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    return this.sanitize(type, 'sanitizeAction', value)
  }

  /** Returns the declared service policies that can sanitize authored markup attributes. */
  markupSanitizersFor(type: string): readonly MarkupAttributeSanitizer[] {
    return this.servicesFor(type)
      .map((name) => this.catalog.services.get(name)?.sanitizeMarkupAttribute)
      .filter((sanitizer): sanitizer is MarkupAttributeSanitizer => sanitizer !== undefined)
  }

  /** Applies a component sanitizer when the registered type provides one. */
  private sanitize(
    type: string,
    key: 'sanitizeInitial' | 'sanitizeAction',
    value: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    const sanitizer: ComponentSanitizer | undefined = this.catalog.components.get(type)?.[key]
    return sanitizer === undefined ? value : sanitizer(value)
  }
}
