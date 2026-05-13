export type ApiError = {
  code: string
  message: string
  details?: unknown
}

export type ApiWarning = {
  code: string
  message: string
  details?: unknown
}

export type ApiResult<T> =
  | {
      ok: true
      data: T
      warnings?: ApiWarning[]
    }
  | {
      ok: false
      error: ApiError
    }

export type ListenEmit = {
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
}

export type ListenTransform = {
  name: string
  options?: Record<string, unknown>
}

export type ListenRule = {
  on: string
  transform?: ListenTransform[]
  emit?: ListenEmit[]
  straps?: string[]
}

export type Perso = {
  id: string
  name?: string
  type: string
  initial: Record<string, unknown> | undefined
  actions: Record<string, unknown>
  emit?: Record<string, unknown>
}

export type StoryDef = {
  id: string
  name?: string
  tracks?: Record<string, unknown>
  entries: string[]
  initial: Record<string, unknown> | undefined
  persos: Perso[]
  straps: string[] | undefined
  listen: ListenRule[]
  eventimes?: Array<Record<string, unknown>>
  state?: Record<string, unknown> | undefined
  init?: (input?: Record<string, unknown>) => Record<string, unknown> | undefined
}

export type SceneDef = {
  id: string
  stories: Record<string, StoryDef>
  rootStories: string[]
  initial: Record<string, unknown> | undefined
  straps: string[] | undefined
  listen: ListenRule[]
  state?: Record<string, unknown> | undefined
  init?: (input?: Record<string, unknown>) => Record<string, unknown> | undefined
  onStart?: (...args: any[]) => void
  tracks: Record<string, unknown>
}

export type ResourceManifestEntry = {
  url: string
  type: 'video' | 'audio' | 'image' | 'font' | 'css'
  policy: {
    cache: 'default' | 'no-store' | 'immutable'
    version?: string
    hash?: string
    priority?: 'high' | 'normal' | 'low'
  }
}

export type ResourceManifest = {
  entries: ResourceManifestEntry[]
}

export type CompiledScene = {
  schemaVersion: string
  createdAt: string
  scene: SceneDef
  resources: ResourceManifest
}

export type ValidationError = {
  code: string
  message: string
  details?: unknown
}

export type ValidationReport = {
  ok: boolean
  errors: ValidationError[]
  warnings: ApiWarning[]
}

export type BuilderCompileInput = {
  scene: SceneDef
  options?: Record<string, unknown>
}

export type BuilderCompileOutput = {
  compiledScene: CompiledScene
  resourceManifest: ResourceManifest
  diagnostics: {
    warnings: ApiWarning[]
  }
}

export type BuilderExportInput = {
  compiledScene: CompiledScene
  exporterName: string
  options?: Record<string, unknown>
}

export type BuilderApi = {
  compile: (input: BuilderCompileInput) => ApiResult<BuilderCompileOutput>
  validate: (input: { scene: SceneDef }) => ValidationReport
  export: (input: BuilderExportInput) => ApiResult<{ output: unknown; warnings?: ApiWarning[] }>
}
