import { RuntimeEngine } from '../runtime/engine'
import type { MountTargetDeclaration } from '../runtime/player/pipeline'
import { RuntimePlayer } from '../runtime/player'
import { HtmlPlayerRunner, type HtmlRootTarget } from '../runtime/runner'
import type { RuntimePreloadMetadata } from '../runtime/preload'
import type { CodPlayInstanceOptions } from './facade-types'

/** Dependencies used to assemble one public HTML/DOM instance host. */
export type InstanceHostOptions = Readonly<{
  catalog: import('../runtime/catalog').RuntimeCapabilityCatalog
  engine: RuntimeEngine
  resourceMetadata: ReadonlyMap<string, RuntimePreloadMetadata[string]>
  instance: CodPlayInstanceOptions
  onPublicEvent: (event: import('../runtime/player/pipeline').RuntimeTrackEvent) => void
}>

/** One runtime player and the single teardown that owns its host resources. */
export type InstanceHost = Readonly<{
  player: RuntimePlayer
  destroy: () => void
}>

/** Creates the one public HTML/DOM host used by every CodPlay V2 instance. */
export function createInstanceHost(options: InstanceHostOptions): InstanceHost {
  const rootTargets = resolveRootTargets(options.instance.mountTargets)
  const runner = new HtmlPlayerRunner({
    id: options.instance.instanceId,
    compiledScene: options.instance.compiledScene,
    root: options.instance.root,
    rootTargets,
    catalog: options.catalog,
    resourceMetadata: toResourceMetadata(options.resourceMetadata),
    engine: options.engine,
    functions: options.instance.functions,
    strapCollections: options.instance.strapCollections,
    onPublicEvent: options.onPublicEvent,
  })
  return {
    player: runner.player,
    destroy: () => runner.destroy(),
  }
}

/** Converts the internal metadata map to the runner's indexed metadata shape. */
function toResourceMetadata(
  metadata: ReadonlyMap<string, RuntimePreloadMetadata[string]>,
): RuntimePreloadMetadata {
  return Object.fromEntries(metadata.entries())
}

/** Converts public root declarations to the HTML runner's root-target shape. */
function resolveRootTargets(
  declarations: readonly MountTargetDeclaration[] | undefined,
): readonly HtmlRootTarget[] {
  const targets = (declarations ?? [])
    .filter((target) => target.kind === 'root')
    .map((target) => ({ id: target.id, storyId: target.storyId ?? '' }))
  if (targets.some((target) => target.storyId.length === 0)) {
    throw new Error('Every DOM root target must declare a storyId.')
  }
  if (targets.length === 0) {
    throw new Error('The core DOM materializer requires at least one root mount target.')
  }
  return targets
}
