import { RuntimeEngine } from '../runtime/engine'
import type { Diagnostic } from '../diagnostics'
import { RuntimePlayer, type PlayerInitResult } from '../runtime/player'
import { HtmlPlayerRunner } from '../runtime/runner-html'
import type {
  RuntimePreloadMediaResources,
  RuntimePreloadMetadata,
} from '../runtime/preload'
import type { CodPlayInstanceOptions } from './facade-types'

/** Dependencies used to assemble one public HTML/DOM instance host. */
export type InstanceHostOptions = Readonly<{
  catalog: import('../runtime/catalog').RuntimeCapabilityCatalog
  engine: RuntimeEngine
  resourceMetadata: ReadonlyMap<string, RuntimePreloadMetadata[string]>
  resourceMedia: ReadonlyMap<string, RuntimePreloadMediaResources[string]>
  instance: CodPlayInstanceOptions
  onPublicEvent: (event: import('../runtime/player/pipeline').RuntimeTrackEvent) => void
  onTrace: (event: import('../runtime/player/pipeline').RuntimeTrackEvent) => void
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
  const runner = new HtmlPlayerRunner({
    id: options.instance.instanceId,
    compiledScene: options.instance.compiledScene,
    root: options.instance.root,
    numericLengthScale: resolveRootNumericLengthScale(options.instance.root),
    catalog: options.catalog,
    resourceMetadata: toResourceMetadata(options.resourceMetadata),
    resourceMedia: toResourceMedia(options.resourceMedia),
    engine: options.engine,
    idle: options.instance.idle,
    functions: options.instance.functions,
    strapCollections: options.instance.strapCollections,
    onPublicEvent: options.onPublicEvent,
    onTrace: options.onTrace,
    onEmitDiagnostic: options.onEmitDiagnostic,
  })
  let stopResizeObservation = (): void => undefined
  try {
    const init = runner.init()
    if (init.ok) {
      stopResizeObservation = observeRootResize(options.instance.root, () => {
        try {
          runner.resize(resolveRootNumericLengthScale(options.instance.root))
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

/** Resolves the pixel scale for one cqw from the current scene-root width. */
function resolveRootNumericLengthScale(root: HTMLElement): number {
  const width = root.getBoundingClientRect().width
  return Number.isFinite(width) && width > 0 ? width / 100 : 1
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

/** Converts the internal media handoff map to the runner's indexed shape. */
function toResourceMedia(
  media: ReadonlyMap<string, RuntimePreloadMediaResources[string]>,
): RuntimePreloadMediaResources {
  return Object.fromEntries(media.entries())
}
