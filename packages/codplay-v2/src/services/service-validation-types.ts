import type { DiagnosticCollector, DiagnosticRefs } from '../diagnostics'

/** The part of a perso payload currently being validated. */
export type ValidationTarget = 'initial' | 'action'

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

/** Pure validator declaration for one property inside a named service namespace. */
export type PropertyValidationDefinition = Readonly<{
  name: string
  validate?: ValidationFunction
}>

/** Pure validation declaration attached to one registered shared service. */
export type ServiceValidationDefinition = Readonly<{
  name: string
  validate?: ValidationFunction
  properties?: readonly PropertyValidationDefinition[]
  allowUnknownProperties?: boolean
}>
