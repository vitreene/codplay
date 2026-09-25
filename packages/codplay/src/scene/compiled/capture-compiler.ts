import type {
  AuthorCaptureDeclaration,
  AuthorCaptureEvent,
  AuthorEmitEvent,
  AuthorEmitDeclaration,
  AuthorEmitRule,
  AuthorScrollObservationDeclaration,
  AuthorScrollObservationEvent,
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
  CompiledScrollObservation,
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
    Object.entries(declaration).map(([trigger, rule]) => {
      if (trigger === 'observe') {
        if (Array.isArray(rule)) throw new Error('emit.observe accepts one declaration.')
        return [trigger, compileScrollObservation(rule as AuthorScrollObservationDeclaration, `${scope}.observe`, state)]
      }
      return [
        trigger,
        Array.isArray(rule)
          ? rule.map((entry, index) => compileEmitRule(entry as AuthorEmitRule, `${scope}.${trigger}[${index}]`, state))
          : compileEmitRule(rule as AuthorEmitRule, `${scope}.${trigger}`, state),
      ]
    }),
  )
}

/** Compiles one event-plus-capture rule without resolving its source trigger. */
function compileEmitRule(
  rule: AuthorEmitRule,
  scope: string,
  state: ExtractionState,
): CompiledEmitRule {
  if (!('event' in rule)) throw new Error(`Scroll observation must be declared directly as emit.observe: ${scope}`)
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

/** Compiles a geometric observation while keeping its outputs as ordinary events. */
function compileScrollObservation(
  declaration: AuthorScrollObservationDeclaration,
  scope: string,
  state: ExtractionState,
): CompiledScrollObservation {
  return {
    ...(declaration.root === undefined ? {} : { root: declaration.root }),
    ...(declaration.liveAction === undefined ? {} : { liveAction: declaration.liveAction }),
    ...(declaration.zone === undefined ? {} : { zone: { ...declaration.zone } }),
    ...(declaration.enter === undefined ? {} : {
      enter: declaration.enter.map((event, index) => compileScrollObservationEvent(event, `${scope}.enter[${index}]`, state)),
    }),
    ...(declaration.leave === undefined ? {} : {
      leave: declaration.leave.map((event, index) => compileScrollObservationEvent(event, `${scope}.leave[${index}]`, state)),
    }),
  }
}

/** Compiles one observation event and retains its once-only policy. */
function compileScrollObservationEvent(
  event: AuthorScrollObservationEvent,
  scope: string,
  state: ExtractionState,
): CompiledEmitEvent & Readonly<{ once?: true }> {
  return {
    ...compileEmitEvent(event, scope, state),
    ...(event.once === true ? { once: true as const } : {}),
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
