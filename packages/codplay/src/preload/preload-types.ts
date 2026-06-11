import type { ApiResult, ApiWarning, ResourceManifest } from '../builder/types'

export type PreloadOptions = {
  mode?: 'author' | 'broadcast'
  timeout?: number
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

export type PreloadApi = {
  load: (input: {
    manifest: ResourceManifest
    options?: PreloadOptions
  }) => Promise<ApiResult<PreloadResult>>
  readonly state: PreloadState
  cancel: () => void
  release: (urls: string[]) => void
}
