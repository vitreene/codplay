import type { CompiledResourceManifest, SceneDoc } from 'codplay'

/** Stable story identifier used by the current single-story ed2 document model. */
export const EDITOR_V2_STORY_ID = 'story-main'

/** Stable perso identifier of the implicit scene-root capsule. */
export const EDITOR_V2_ROOT_PERSO_ID = `${EDITOR_V2_STORY_ID}__root`

/** Severity carried by a builder diagnostic. */
export type BuilderDiagnosticLevel = 'error' | 'warning'

/** Structured issue produced while translating an EditorScene to a V2 SceneDoc. */
export type BuilderDiagnostic = Readonly<{
  level: BuilderDiagnosticLevel
  code: string
  message: string
  context?: Readonly<Record<string, unknown>>
}>

/** Successful output of the current native V2 editor-builder increment. */
export type BuildSceneV2Success = Readonly<{
  ok: true
  sceneDoc: SceneDoc
  durationMs: number
  preRollMs: number
  /** CSS emitted by capsule-automation; the browser bridge turns it into its preload resource. */
  styleSheet: string
  /** Resolved scene-root grid used by the editor host for its aspect ratio. */
  rootGrid: Readonly<{ rows: number; cols: number }>
  /** Reserved for bridge-owned preload entries; content URLs are also derived by CodPlay.build(). */
  preloadManifest: CompiledResourceManifest
  diagnostics: readonly BuilderDiagnostic[]
}>

/** Failed output: no partial SceneDoc is returned when the input cannot be mapped. */
export type BuildSceneV2Failure = Readonly<{
  ok: false
  diagnostics: readonly BuilderDiagnostic[]
}>

/** Result of the isolated native V2 editor builder. */
export type BuildSceneV2Result = BuildSceneV2Success | BuildSceneV2Failure
