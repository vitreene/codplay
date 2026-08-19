import { materializeScene, resolveScene, solveScene } from './pipeline'
import type { CompiledFunctionCollection, CompiledRecord, CompiledScene } from '../../scene/compiled'
import type { RuntimeTrackJournal } from './pipeline'

/** Temporary render state retained for the validation vertical. */
export type TemporaryPersoState = CompiledRecord

/** Evaluates the current temporary vertical through the V2 pipeline stages. */
export function evaluateTemporaryScene(
  scene: CompiledScene,
  timeMs: number,
  journal?: RuntimeTrackJournal,
  functions: CompiledFunctionCollection = {},
): Readonly<Record<string, TemporaryPersoState>> {
  const materialized = materializeScene(scene, timeMs, journal)
  const resolved = resolveScene(materialized, functions)
  const solved = solveScene(resolved)
  return Object.fromEntries(Object.entries(solved.persos).map(([key, perso]) => [key, perso.state]))
}
