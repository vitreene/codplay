import type { DiagnosticCollector, DiagnosticRefs } from '../diagnostics'
import {
  VALIDATION_TARGET_ACTION,
  VALIDATION_TARGET_INITIAL,
  type ValidationTarget,
} from './config/validation-targets'

export { VALIDATION_TARGET_ACTION, VALIDATION_TARGET_INITIAL }
export type { ValidationTarget } from './config/validation-targets'

/** Shared context passed to one service or component validator. */
export type ValidationContext = Readonly<{
  target: ValidationTarget
  path: string
  refs: DiagnosticRefs
  actionName?: string
  diagnostics: DiagnosticCollector
}>

/** Validates one service or component payload without runtime dependencies. */
export type ValidationFunction = (value: unknown, context: ValidationContext) => void

/** Normalizes one validated service payload before it enters CompiledScene. */
export type ServiceSanitizer = (value: unknown) => unknown

/** Context supplied when one service handles an attribute in authored markup. */
export type MarkupAttributeSanitizerContext = Readonly<{
  elementName: string
  attributeName: string
  value: string
  path: string
}>

/** Service-owned compile-time policy for one authored markup attribute. */
export type MarkupAttributeSanitizer = (context: MarkupAttributeSanitizerContext) => string | undefined

/** Pure validator declaration for one property inside a named service namespace. */
export type PropertyValidationDefinition = Readonly<{
  name: string
  validate?: ValidationFunction
}>

/** Pure validation declaration attached to one registered shared service. */
export type ServiceValidationDefinition = Readonly<{
  name: string
  validate?: ValidationFunction
  sanitize?: ServiceSanitizer
  properties?: readonly PropertyValidationDefinition[]
  allowUnknownProperties?: boolean
  sanitizeMarkupAttribute?: MarkupAttributeSanitizer
}>
