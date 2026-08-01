import { materializeScene, resolveScene, solveScene } from './pipeline'
import type { CompiledRecord, CompiledScene } from '../../scene/compiled'

/** Temporary render state retained for the validation vertical. */
export type TemporaryPersoState = CompiledRecord

/** Evaluates the current temporary vertical through the V2 pipeline stages. */
export function evaluateTemporaryScene(scene: CompiledScene, timeMs: number): Readonly<Record<string, TemporaryPersoState>> {
  const materialized = materializeScene(scene, timeMs)
  const resolved = resolveScene(materialized)
  const solved = solveScene(resolved)
  return Object.fromEntries(Object.entries(solved.persos).map(([key, perso]) => [key, perso.state]))
}
