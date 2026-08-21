import type {
  CompiledCaptureDeclaration,
  CompiledFunctionCollection,
} from '../../scene/compiled'
import type {
  RuntimeCaptureDeclaration,
  RuntimeCaptureEndFunction,
  RuntimeCaptureInitFunction,
  RuntimeCaptureTrackFunction,
} from './capture-types'

/** Resolves one compiled capture declaration through the build function collection. */
export function resolveCompiledCaptureDeclaration(
  declaration: CompiledCaptureDeclaration,
  functions: CompiledFunctionCollection,
): RuntimeCaptureDeclaration {
  return {
    trackOn: declaration.trackOn,
    endOn: declaration.endOn,
    stateScope: declaration.stateScope,
    initCaptureState: declaration.initCaptureStateRef === undefined
      ? undefined
      : resolveFunction(declaration.initCaptureStateRef.ref, functions) as RuntimeCaptureInitFunction,
    trackCommand: declaration.trackCommandRef === undefined
      ? undefined
      : resolveFunction(declaration.trackCommandRef.ref, functions) as RuntimeCaptureTrackFunction,
    endEmit: declaration.endEmit,
    endCapture: declaration.endCaptureRef === undefined
      ? undefined
      : resolveFunction(declaration.endCaptureRef.ref, functions) as RuntimeCaptureEndFunction,
  }
}

/** Fails explicitly when a compiled capture references an unavailable function. */
function resolveFunction(
  reference: string,
  functions: CompiledFunctionCollection,
): (...args: readonly unknown[]) => unknown {
  const fn = functions[reference]
  if (fn === undefined) throw new Error(`Capture function is not available: ${reference}`)
  return fn
}
