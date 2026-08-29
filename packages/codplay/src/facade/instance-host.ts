import { RuntimeEngine } from '../runtime/engine'
import type { Diagnostic } from '../diagnostics'
import type { MountTargetDeclaration } from '../runtime/player/pipeline'
import { RuntimePlayer, type PlayerInitResult } from '../runtime/player'
import { HtmlPlayerRunner, type HtmlRootTarget } from '../runtime/runner-html'
import type { RuntimePreloadMetadata } from '../runtime/preload'
import type { CodPlayInstanceOptions } from './facade-types'

/** Dependencies used to assemble one public HTML/DOM instance host. */
export type InstanceHostOptions = Readonly<{
  catalog: import('../runtime/catalog').RuntimeCapabilityCatalog
  engine: RuntimeEngine
  resourceMetadata: ReadonlyMap<string, RuntimePreloadMetadata[string]>
  instance: CodPlayInstanceOptions
  onPublicEvent: (event: import('../runtime/player/pipeline').RuntimeTrackEvent) => void
  onEmitDiagnostic: (diagnostic: Diagnostic) => void
  onResizeError: (error: unknown) => void
}>

/** One runtime player and the single teardown that owns its host resources. */
export type InstanceHost = Readonly<{
  player: RuntimePlayer
  runner: HtmlPlayerRunner
  init: PlayerInitResult
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
    idle: options.instance.idle,
    functions: options.instance.functions,
    strapCollections: options.instance.strapCollections,
    onPublicEvent: options.onPublicEvent,
    onEmitDiagnostic: options.onEmitDiagnostic,
  })
  let stopResizeObservation = (): void => undefined
  try {
    const init = runner.init()
    if (init.ok) {
      stopResizeObservation = observeRootResize(options.instance.root, () => {
        try {
          runner.resize()
        } catch (error) {
          options.onResizeError(error)
        }
      })
    }
    return {
      player: runner.player,
      runner,
      init,
      destroy: () => {
        stopResizeObservation()
        runner.destroy()
      },
    }
  } catch (error) {
    runner.destroy()
    throw error
  }
}

/** Observes the instance root so responsive motion geometry stays inside the facade host. */
function observeRootResize(root: HTMLElement, onResize: () => void): () => void {
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(onResize)
    observer.observe(root)
    return () => observer.disconnect()
  }

  globalThis.addEventListener('resize', onResize)
  return () => globalThis.removeEventListener('resize', onResize)
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
