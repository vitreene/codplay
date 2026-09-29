import type { AnimationClip, Group } from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { RuntimePreloadStrategy } from 'codplay'
import { getThreeRuntime } from './threejs-core'

/** Decoded GLB source retained by the Three.js preload boundary. */
export type PreparedThreeGlbResource = Readonly<{
  format: 'glb'
  scene: Group
  animations: readonly AnimationClip[]
}>

/** Decoded FBX source retained by the Three.js preload boundary. */
export type PreparedThreeFbxResource = Readonly<{
  format: 'fbx'
  animations: readonly AnimationClip[]
}>

type PreparedThreeResource = PreparedThreeGlbResource | PreparedThreeFbxResource
type ThreeResourceFormat = PreparedThreeResource['format']

const resources = new Map<string, PreparedThreeResource>()
const pendingResources = new Map<string, Promise<PreparedThreeResource>>()

/** Returns a fully decoded GLB source prepared before player initialization. */
export function getThreeGlbResource(src: string): PreparedThreeGlbResource {
  return getThreeResource(src, 'glb')
}

/** Returns fully decoded FBX clips prepared before player initialization. */
export function getThreeFbxResource(src: string): PreparedThreeFbxResource {
  return getThreeResource(src, 'fbx')
}

/** Resolves one prepared resource and rejects a missing or mismatched manifest entry. */
function getThreeResource<Format extends ThreeResourceFormat>(
  src: string,
  format: Format,
): Extract<PreparedThreeResource, { format: Format }> {
  const resource = resources.get(src)
  if (resource === undefined || resource.format !== format) {
    throw new Error(`Three.js ${format.toUpperCase()} resource "${src}" was not preloaded.`)
  }
  return resource as Extract<PreparedThreeResource, { format: Format }>
}

/** Loads and decodes one GLB resource before the preload promise resolves. */
export function preloadThreeGlbResource(src: string, signal: AbortSignal): Promise<void> {
  return preloadThreeResource(src, 'glb', signal)
}

/** Loads and decodes one FBX resource before the preload promise resolves. */
export function preloadThreeFbxResource(src: string, signal: AbortSignal): Promise<void> {
  return preloadThreeResource(src, 'fbx', signal)
}

/** Shares one in-flight decode by URL while keeping the caller's abort boundary. */
function preloadThreeResource(
  src: string,
  format: ThreeResourceFormat,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return Promise.reject(createAbortError())
  const cached = resources.get(src)
  if (cached !== undefined) {
    if (cached.format !== format) return Promise.reject(createFormatError(src, format))
    return Promise.resolve()
  }

  let pending = pendingResources.get(src)
  if (pending === undefined) {
    pending = loadThreeResource(src, format, signal)
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

  return raceAbort(pending, signal).then((resource) => {
    if (resource.format !== format) throw createFormatError(src, format)
  })
}

/** Strategy table for decoded resources owned by the Three.js integration. */
export const THREE_PRELOAD_STRATEGIES: Readonly<Record<string, RuntimePreloadStrategy>> = {
  'three-glb': preloadThreeGlbResource,
  'three-fbx': preloadThreeFbxResource,
}

/** Fetches one resource, decodes it, and publishes it only after decoding succeeds. */
async function loadThreeResource(
  src: string,
  format: ThreeResourceFormat,
  signal: AbortSignal,
): Promise<PreparedThreeResource> {
  const buffer = await loadThreeBinaryResource(src, signal)
  const resource = format === 'glb'
    ? await decodeGlbResource(buffer, src)
    : decodeFbxResource(buffer, src)
  if (signal.aborted) throw createAbortError()
  resources.set(src, resource)
  return resource
}

/** Decodes a GLB and all dependencies handled by GLTFLoader. */
function decodeGlbResource(buffer: ArrayBuffer, src: string): Promise<PreparedThreeGlbResource> {
  const loader = new GLTFLoader()
  const path = src.slice(0, src.lastIndexOf('/') + 1)
  return new Promise((resolve, reject) => {
    loader.parse(buffer, path, (gltf) => {
      resolve({ format: 'glb', scene: gltf.scene, animations: gltf.animations })
    }, reject)
  })
}

/** Decodes FBX clips before the preload barrier opens. */
function decodeFbxResource(buffer: ArrayBuffer, src: string): PreparedThreeFbxResource {
  const path = src.slice(0, src.lastIndexOf('/') + 1)
  const root = new FBXLoader().parse(buffer, path)
  return { format: 'fbx', animations: root.animations }
}

/** Loads binary data through Three.js and links the preload abort signal. */
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
          resolve(data as ArrayBuffer)
        },
        undefined,
        settleError,
      )
    } catch (error) {
      settleError(error)
    }
  })
}

/** Describes a manifest type conflict for one cached URL. */
function createFormatError(src: string, format: ThreeResourceFormat): Error {
  return new Error(`Three.js resource "${src}" is not a ${format.toUpperCase()} resource.`)
}

/** Creates the abort error expected by the shared preload boundary. */
function createAbortError(): Error {
  const error = new Error('Three.js resource preload aborted.')
  error.name = 'AbortError'
  return error
}

/** Lets one preload caller stop waiting for a shared Three.js operation. */
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
