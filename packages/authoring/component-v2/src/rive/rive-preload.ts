import type { RuntimePreloadStrategy } from 'codplay'

import type { RiveResource, RiveRuntime } from './rive-context'

const resources = new Map<string, RiveResource>()
const pendingResources = new Map<string, Promise<RiveResource>>()
let runtimePromise: Promise<RiveRuntime> | undefined

/** Loads the Rive WASM runtime once for the component package. */
export function getRiveRuntime(): Promise<RiveRuntime> {
  runtimePromise ??= import('@rive-app/canvas').then(({ RuntimeLoader }) =>
    RuntimeLoader.awaitInstance() as unknown as Promise<RiveRuntime>,
  )

  return runtimePromise
}

/** Reads a prepared Rive document from the package-owned resource cache. */
export function getRiveResource(src: string): RiveResource {
  const resource = resources.get(src)

  if (!resource) {
    throw new Error(`Rive resource "${src}" was not preloaded.`)
  }

  return resource
}

/** Registers one prepared document for the host component. */
export function registerRiveResource(src: string, resource: RiveResource): void {
  resources.set(src, resource)
}

/** Preloads one Rive document through the V2 preload strategy contract. */
export async function preloadRiveResource(
  src: string,
  signal: AbortSignal,
): Promise<void> {
  if (resources.has(src)) return

  let pending = pendingResources.get(src)
  if (!pending) {
    pending = loadRiveResource(src)
    pendingResources.set(src, pending)
    void pending.then(
      () => {
        if (pendingResources.get(src) === pending) pendingResources.delete(src)
      },
      () => {
        if (pendingResources.get(src) === pending) pendingResources.delete(src)
      },
    )
  }

  await raceAbort(pending, signal)
}

/** Strategy table registered by an application using the Rive module. */
export const RIVE_PRELOAD_STRATEGIES: Readonly<
  Record<string, RuntimePreloadStrategy>
> = {
  rive: preloadRiveResource,
}

/** Fetches and decodes one Rive document into the package-owned cache. */
async function loadRiveResource(src: string): Promise<RiveResource> {
  const response = await fetch(src)
  if (!response.ok) {
    throw new Error(`Unable to load Rive resource "${src}" (${response.status}).`)
  }

  const runtime = await getRiveRuntime()
  const file = await runtime.load(new Uint8Array(await response.arrayBuffer()))
  const resource = { runtime, file } satisfies RiveResource
  resources.set(src, resource)
  return resource
}

/** Lets the V2 preload caller stop waiting without duplicating a URL load. */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error('Rive resource preload aborted.'))

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort)
      reject(new Error('Rive resource preload aborted.'))
    }

    signal.addEventListener('abort', abort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      },
    )
  })
}
