import type { CompiledRecord, CompiledScene } from '../../../scene/compiled'
import type { MaterializedTrackRegistry } from './tracks'

/** Identifies one perso across one compiled scene evaluation. */
export type RuntimePersoIdentity = Readonly<{
  key: string
  storyId: string
  persoId: string
  type: string
}>

/** One discrete action active at a given timeline position. */
export type MaterializedAction = Readonly<{
  name: string
  startAt: number
  elapsedMs: number
  trackId: string
  trackOrder: number
  eventId?: string
  eventSeq?: number
  declarationPath: readonly number[]
  eventData?: CompiledRecord
  action: CompiledRecord
}>

/** Output of materialize: initial data plus active discrete occurrences. */
export type MaterializedPerso = RuntimePersoIdentity & Readonly<{
  initial: CompiledRecord
  actions: readonly MaterializedAction[]
}>

/** Scene data selected for one timeline position. */
export type MaterializedScene = Readonly<{
  scene: CompiledScene
  timeMs: number
  tracks: MaterializedTrackRegistry
  sceneState: CompiledRecord
  storyStates: Readonly<Record<string, CompiledRecord>>
  persos: Readonly<Record<string, MaterializedPerso>>
}>

/** Output of resolve before hierarchy and substrate projection. */
export type ResolvedPerso = RuntimePersoIdentity & Readonly<{
  state: CompiledRecord
}>

/** Scene data after discrete patches and continuous values are resolved. */
export type ResolvedScene = Readonly<{
  timeMs: number
  sceneState: CompiledRecord
  storyStates: Readonly<Record<string, CompiledRecord>>
  persos: Readonly<Record<string, ResolvedPerso>>
}>

/** Stable solve output consumed by a future component/projector boundary. */
export type SolvedPerso = ResolvedPerso

/** Scene data after the currently supported solve stage. */
export type SolvedScene = Readonly<{
  timeMs: number
  sceneState: CompiledRecord
  storyStates: Readonly<Record<string, CompiledRecord>>
  persos: Readonly<Record<string, SolvedPerso>>
}>
