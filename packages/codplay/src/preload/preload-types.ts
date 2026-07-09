import type { ApiResult, ApiWarning, ResourceManifest } from '../builder/types'

export type PreloadOptions = {
  mode?: 'author' | 'broadcast'
  timeout?: number
  /**
   * Scene mount container — used to scope `type:'css'` resources (`@scope`, never a global
   * `document.head` injection, so a scene's CSS never leaks onto the rest of the host page).
   * Absent when preload runs before a scene is mounted (ex. tooling prefetch, `mode:'author'`) —
   * `loadCss` falls back to a plain, unscoped `<link>` in that case.
   */
  container?: Element | null
}

export type PreloadResult = {
  loaded: string[]
  skipped: string[]
  warnings?: ApiWarning[]
}

export type PreloadState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  loadedCount: number
  totalCount: number
}

export type PreloadCacheEntry = {
  url: string
  status: 'loading' | 'ready' | 'error'
  promise: Promise<void>
  error?: string
}

export type PreloadStrategyFn = (url: string, signal: AbortSignal) => Promise<void>

export type PreloadApi = {
  load: (input: {
    manifest: ResourceManifest
    options?: PreloadOptions
  }) => Promise<ApiResult<PreloadResult>>
  readonly state: PreloadState
  cancel: () => void
  release: (urls: string[]) => void
  /** Registers a load strategy for a non-built-in ResourceManifestEntry.type — see ThirdPartyBinding.preload. */
  registerStrategy: (type: string, load: PreloadStrategyFn) => void
}
