import type { RuntimePreloadStrategy } from 'codplay'
import { getThreeRuntime } from './threejs-core'

const resources = new Map<string, ArrayBuffer>()
const pendingResources = new Map<string, Promise<ArrayBuffer>>()

/** Returns one binary buffer prepared by the Three.js resource boundary. */
export function getThreeBinaryResource(src: string): ArrayBuffer {
  const resource = resources.get(src)
  if (resource === undefined) {
    throw new Error(`Three.js resource "${src}" was not preloaded.`)
  }
  return resource
}

/** Loads one binary resource with the Three.js file loader. */
export function preloadThreeBinaryResource(
  src: string,
  signal: AbortSignal,
): Promise<void> {
  if (resources.has(src)) return Promise.resolve()

  let pending = pendingResources.get(src)
  if (pending === undefined) {
    pending = loadThreeBinaryResource(src, signal)
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

  return raceAbort(pending, signal).then(() => undefined)
}

/** Strategy table for binary resources owned by the Three.js integration. */
export const THREE_PRELOAD_STRATEGIES: Readonly<Record<string, RuntimePreloadStrategy>> = {
  'three-glb': preloadThreeBinaryResource,
  'three-fbx': preloadThreeBinaryResource,
}

/** Fetches one binary resource through Three.js and retains its raw bytes. */
async function loadThreeBinaryResource(src: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const runtime = await getThreeRuntime()
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const loader = new runtime.FileLoader()
    loader.setResponseType('arraybuffer')
    let settled = false

    const cleanup = (): void => {
      signal.removeEventListener('abort', abort)
    }
    const abort = (): void => {
      loader.abort()
      settleError(createAbortError())
    }
    const settleError = (error: unknown): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    if (signal.aborted) {
      settleError(createAbortError())
      return
    }

    signal.addEventListener('abort', abort, { once: true })
    try {
      loader.load(
        src,
        (data) => {
          if (settled) return
          settled = true
          cleanup()
          const resource = data as ArrayBuffer
          resources.set(src, resource)
          resolve(resource)
        },
        undefined,
        settleError,
      )
    } catch (error) {
      settleError(error)
    }
  })
}

/** Creates the abort error expected by the shared preload boundary. */
function createAbortError(): Error {
  const error = new Error('Three.js resource preload aborted.')
  error.name = 'AbortError'
  return error
}

/** Lets one preload caller stop waiting without interrupting shared Three.js work. */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(createAbortError())

  return new Promise<T>((resolve, reject) => {
    const abort = (): void => {
      signal.removeEventListener('abort', abort)
      reject(createAbortError())
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
