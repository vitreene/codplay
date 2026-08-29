import type {
  AuthorCaptureDeclaration,
  AuthorCaptureEvent,
  AuthorEmitEvent,
  AuthorEmitDeclaration,
  AuthorEmitRule,
} from '../capture'
import {
  extractCompiledRecord,
  extractFunction,
} from './function-extractor'
import type { AuthorFunction } from '../types'
import type {
  CompiledCaptureDeclaration,
  CompiledCaptureEvent,
  CompiledEmitEvent,
  CompiledEmitDeclaration,
  CompiledEmitRule,
} from './types'

type ExtractionState = Parameters<typeof extractFunction>[2]

/** Compiles one perso emit declaration and extracts every capture function. */
export function compileEmitDeclaration(
  declaration: AuthorEmitDeclaration | undefined,
  scope: string,
  state: ExtractionState,
): CompiledEmitDeclaration | undefined {
  if (declaration === undefined) return undefined
  return Object.fromEntries(
    Object.entries(declaration).map(([trigger, rule]) => [
      trigger,
      Array.isArray(rule)
        ? rule.map((entry, index) => compileEmitRule(entry as AuthorEmitRule, `${scope}.${trigger}[${index}]`, state))
        : compileEmitRule(rule as AuthorEmitRule, `${scope}.${trigger}`, state),
    ]),
  )
}

/** Compiles one event-plus-capture rule without resolving its source trigger. */
function compileEmitRule(
  rule: AuthorEmitRule,
  scope: string,
  state: ExtractionState,
): CompiledEmitRule {
  const base = {
    ...(rule.ref === undefined ? {} : { ref: rule.ref }),
    ...(rule.keyCode === undefined ? {} : { keyCode: rule.keyCode }),
    ...(rule.preventDefault === undefined ? {} : { preventDefault: rule.preventDefault }),
    data: rule.data === undefined ? undefined : extractCompiledRecord(rule.data, `${scope}.data`, state),
  }
  if (rule.capture === undefined) {
    return {
      ...base,
      event: compileEmitEvent(rule.event, `${scope}.event`, state),
    }
  }
  return {
    ...base,
    event: compileCaptureEvent(rule.event, `${scope}.event`, state),
    capture: compileCaptureDeclaration(rule.capture, `${scope}.capture`, state),
  }
}

/** Compiles one ordinary V2 emit event with named visibility. */
function compileEmitEvent(
  event: AuthorEmitEvent,
  scope: string,
  state: ExtractionState,
): CompiledEmitEvent {
  return {
    name: event.name,
    ...(event.data === undefined ? {} : { data: extractCompiledRecord(event.data, `${scope}.data`, state) }),
    ...(event.visibility === undefined ? {} : { visibility: event.visibility }),
    ...(event.mode === undefined ? {} : { mode: event.mode }),
  }
}

/** Compiles one ordinary event carried by a capture declaration. */
function compileCaptureEvent(
  event: AuthorCaptureEvent,
  scope: string,
  state: ExtractionState,
): CompiledCaptureEvent {
  return {
    name: event.name,
    ...(event.data === undefined ? {} : { data: extractCompiledRecord(event.data, `${scope}.data`, state) }),
    ...(event.cascade === undefined ? {} : { cascade: event.cascade }),
    ...(event.mode === undefined ? {} : { mode: event.mode }),
  }
}

/** Extracts capture lifecycle functions while preserving source metadata. */
function compileCaptureDeclaration(
  declaration: AuthorCaptureDeclaration,
  scope: string,
  state: ExtractionState,
): CompiledCaptureDeclaration {
  return {
    trackOn: declaration.trackOn === undefined ? undefined : [...declaration.trackOn],
    endOn: declaration.endOn === undefined ? undefined : [...declaration.endOn],
    stateScope: declaration.stateScope,
    initCaptureStateRef: declaration.initCaptureState === undefined
      ? undefined
      : extractFunction(declaration.initCaptureState as AuthorFunction, `${scope}.initCaptureState`, state),
    trackCommandRef: declaration.trackCommand === undefined
      ? undefined
      : extractFunction(declaration.trackCommand as AuthorFunction, `${scope}.trackCommand`, state),
    endEmit: declaration.endEmit === undefined
      ? undefined
      : compileCaptureEvent(declaration.endEmit, `${scope}.endEmit`, state),
    endCaptureRef: declaration.endCapture === undefined
      ? undefined
      : extractFunction(declaration.endCapture as AuthorFunction, `${scope}.endCapture`, state),
  }
}
