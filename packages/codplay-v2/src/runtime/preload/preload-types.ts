import type { CompiledResource, CompiledResourceManifest } from '../../scene/compiled'

/** Manifest accepted by the external preload service. */
export type RuntimePreloadManifestInput =
  | CompiledResourceManifest
  | readonly CompiledResourceManifest[]

/** Runtime policy used when one resource cannot be prepared. */
export type RuntimePreloadMode = 'author' | 'broadcast'

/** Options for one independent preload operation. */
export type RuntimePreloadOptions = Readonly<{
  mode?: RuntimePreloadMode
  timeout?: number
  /** Existing mount element used to scope CSS resources. */
  container?: Element | null
}>

/** Warning emitted for an unavailable resource in broadcast mode. */
export type RuntimePreloadWarning = Readonly<{
  code: 'RUNTIME_PRELOAD_RESOURCE_UNAVAILABLE'
  message: string
  details: Readonly<{ url: string; error: string }>
}>

/** Successful result returned by one preload operation. */
export type RuntimePreloadSuccess = Readonly<{
  ok: true
  data: Readonly<{
    loaded: readonly string[]
    skipped: readonly string[]
    warnings?: readonly RuntimePreloadWarning[]
  }>
}>

/** Failed result returned by one preload operation. */
export type RuntimePreloadFailure = Readonly<{
  ok: false
  error: Readonly<{
    code: 'RUNTIME_PRELOAD_CANCELLED' | 'RUNTIME_PRELOAD_RESOURCES_UNAVAILABLE'
    message: string
    details?: readonly RuntimePreloadWarning[]
  }>
}>

/** Result returned by the external preload service. */
export type RuntimePreloadResult = RuntimePreloadSuccess | RuntimePreloadFailure

/** Observable state of one preload service instance. */
export type RuntimePreloadState = Readonly<{
  status: 'idle' | 'loading' | 'ready' | 'error'
  loadedCount: number
  totalCount: number
}>

/** Strategy used by built-in and foreign resource types. */
export type RuntimePreloadStrategy = (
  url: string,
  signal: AbortSignal,
) => Promise<void>

/** One entry owned by the shared preload cache. */
export type RuntimePreloadCacheEntry = Readonly<{
  url: string
  status: 'loading' | 'ready' | 'error'
  promise: Promise<void>
  error?: string
}>

/** Shared cache boundary used by several preload consumers. */
export interface RuntimePreloadCacheApi {
  get(url: string): RuntimePreloadCacheEntry | undefined
  claim(url: string, owner: symbol): RuntimePreloadCacheEntry | undefined
  start(url: string, owner: symbol, promise: Promise<void>, controller: AbortController): RuntimePreloadCacheEntry
  markReady(url: string, entry: RuntimePreloadCacheEntry): void
  markError(url: string, entry: RuntimePreloadCacheEntry, error: string): void
  release(owner: symbol, urls: readonly string[]): void
}

/** Public external preload API. */
export interface RuntimePreloadApi {
  load(input: Readonly<{
    manifest: RuntimePreloadManifestInput
    options?: RuntimePreloadOptions
  }>): Promise<RuntimePreloadResult>
  readonly state: RuntimePreloadState
  cancel(): void
  release(urls: readonly string[]): void
  registerStrategy(type: string, strategy: RuntimePreloadStrategy): void
}

/** One normalized resource entry sent to a strategy. */
export type RuntimePreloadResource = CompiledResource
