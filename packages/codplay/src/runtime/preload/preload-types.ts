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

/** Metadata discovered while preparing one resource for runtime use. */
export type RuntimePreloadResourceMetadata = Readonly<{
  type?: string
  durationMs?: number
}>

/** Metadata indexed by the stable resource URL used by compiled scenes. */
export type RuntimePreloadMetadata = Readonly<Record<string, RuntimePreloadResourceMetadata>>

/** One adopted native media node owned by a component until its final release. */
export type RuntimePreloadMediaLease = Readonly<{
  node: HTMLMediaElement
  release: () => void
}>

/** Opaque handoff for one native media node retained by the preload cache. */
export type RuntimePreloadMediaHandle = Readonly<{
  type: 'audio' | 'video'
  retain: () => void
  release: () => void
  take: () => RuntimePreloadMediaLease | undefined
}>

/** Native media handoffs indexed by the stable resource URL. */
export type RuntimePreloadMediaResources = Readonly<Record<string, RuntimePreloadMediaHandle>>

/** Extended result used by a native strategy when it retains a live media node. */
export type RuntimePreloadPreparedResource = Readonly<{
  metadata?: RuntimePreloadResourceMetadata
  media: RuntimePreloadMediaHandle
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
    metadata: RuntimePreloadMetadata
    media?: RuntimePreloadMediaResources
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
) => Promise<RuntimePreloadLoadResult>

/** Result returned by one native or foreign preload strategy. */
export type RuntimePreloadLoadResult = RuntimePreloadResourceMetadata | RuntimePreloadPreparedResource | void

/** One entry owned by the shared preload cache. */
export type RuntimePreloadCacheEntry = Readonly<{
  url: string
  status: 'loading' | 'ready' | 'error'
  promise: Promise<RuntimePreloadLoadResult | undefined>
  metadata?: RuntimePreloadResourceMetadata
  media?: RuntimePreloadMediaHandle
  error?: string
}>

/** Shared cache boundary used by several preload consumers. */
export interface RuntimePreloadCacheApi {
  get(url: string): RuntimePreloadCacheEntry | undefined
  claim(url: string, owner: symbol): RuntimePreloadCacheEntry | undefined
  start(url: string, owner: symbol, promise: Promise<RuntimePreloadLoadResult | undefined>, controller: AbortController): RuntimePreloadCacheEntry
  markReady(
    url: string,
    entry: RuntimePreloadCacheEntry,
    metadata?: RuntimePreloadResourceMetadata,
    media?: RuntimePreloadMediaHandle,
  ): void
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
