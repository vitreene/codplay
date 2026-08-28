import type { CompiledFunctionCollection, CompiledScene } from '../../../scene/compiled'
import type { RuntimeModuleServiceInstance } from '../../engine'
import {
  materializeScene,
  materializeSceneBeforeBoundary,
  type MaterializeOptions,
  resolveScene,
  solveScene,
  type MountTargetDeclaration,
  type SolvedScene,
} from '../pipeline'
import type { RuntimeTrackJournal } from '../pipeline'

/** Dependencies shared by every pure player scene reconstruction. */
export type RuntimePlayerSceneContext = Readonly<{
  compiledScene: CompiledScene
  functions: CompiledFunctionCollection
  trackJournal: RuntimeTrackJournal
  mountTargets: readonly MountTargetDeclaration[]
  moduleServiceInstances: ReadonlyMap<string, RuntimeModuleServiceInstance>
}>

/** Resolves one scene without consulting a structural timeline being built. */
export function reconstructPlayerScene(
  context: RuntimePlayerSceneContext,
  timeMs: number,
  childrenByTarget?: Readonly<Record<string, readonly string[]>>,
  includeBoundary = true,
  includePersistOnly = true,
): SolvedScene {
  const options: MaterializeOptions = { includePersistOnly }
  const materialized = includeBoundary
    ? materializeScene(context.compiledScene, timeMs, context.trackJournal, options)
    : materializeSceneBeforeBoundary(context.compiledScene, timeMs, context.trackJournal, options)
  return solveScene(resolveScene(materialized, context.functions), {
    mountTargets: [
      ...context.mountTargets,
      ...[...context.moduleServiceInstances.values()].flatMap((instance) => instance.getMountTargets?.() ?? []),
    ],
    ...(childrenByTarget === undefined ? {} : { childrenByTarget }),
  })
}
