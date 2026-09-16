import type { SightyShowMode } from '../types'
import { getConditionScopes } from './conditions'
import type { ActiveSelection } from './types'

/** Defines the default used when no author or integration scope overrides it. */
export const DEFAULT_SIGHTY_SHOW_MODE: SightyShowMode = 'rewind'

/** Resolves one show policy through the same nearest-scope chain as conditions. */
export function resolveShowMode<SceneKey extends string, SlotName extends string>(
  selection: ActiveSelection<SceneKey, SlotName>,
  runtimeMode: SightyShowMode | undefined,
  scenarioMode: SightyShowMode | undefined,
  fallback: SightyShowMode = DEFAULT_SIGHTY_SHOW_MODE,
): SightyShowMode {
  const scopedMode = getConditionScopes(selection).find((scope) => scope.scope.showMode !== undefined)?.scope.showMode
  return scopedMode ?? scenarioMode ?? runtimeMode ?? fallback
}
