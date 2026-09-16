import type { RuntimeComponentRuntime } from '../components'
import type { SolvedScene } from './pipeline'

/** Logical target of one live input projection. */
export type RuntimeInputProjectionTarget = Readonly<{
  storyId: string
  persoId: string
}>

/** Result returned by one non-journaled input-value projection. */
export type RuntimeInputProjectionResult = Readonly<
  | { ok: true }
  | {
      ok: false
      code:
        | 'TIME_NOT_PRESENTED'
        | 'TARGET_NOT_PRESENT'
        | 'TARGET_NOT_INPUT'
        | 'PROJECTION_UNAVAILABLE'
        | 'INVALID_VALUE'
    }
>

/** Projects one scalar value through the mounted component surface. */
export function projectInputValue(input: Readonly<{
  scene: SolvedScene
  componentRuntime: RuntimeComponentRuntime | undefined
  target: RuntimeInputProjectionTarget
  value: string | number
}>): RuntimeInputProjectionResult {
  if (!isValidInputValue(input.value)) return { ok: false, code: 'INVALID_VALUE' }

  const perso = Object.values(input.scene.persos).find((candidate) => (
    candidate.storyId === input.target.storyId
    && candidate.persoId === input.target.persoId
  ))
  if (perso === undefined) return { ok: false, code: 'TARGET_NOT_PRESENT' }
  if (perso.type !== 'input') return { ok: false, code: 'TARGET_NOT_INPUT' }

  const surface = input.componentRuntime?.getComponentSurfaces().getInputSurface?.(perso.key)
  if (surface === undefined) return { ok: false, code: 'PROJECTION_UNAVAILABLE' }
  surface.setValue(input.value)
  return { ok: true }
}

/** Checks the scalar value accepted by the public input projection boundary. */
function isValidInputValue(value: string | number): boolean {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
}
