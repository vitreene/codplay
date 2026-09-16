import type { CompiledRecord } from '../../scene/compiled'
import type { RuntimeEventInsertMode } from '../config/event-insertion'
import type { RuntimeTrackEvent } from './pipeline'

/** Eventime shape accepted at the internal player boundary. */
export type RuntimePlayerEventime = Readonly<{
  name: string
  startAt?: number
  visibility?: 'story' | 'scene' | 'public'
  data?: CompiledRecord
  events?: readonly RuntimePlayerEventime[]
  mode?: RuntimeEventInsertMode
}>

/** Scene-local target kept separate from the eventime content. */
export type RuntimePlayerEventimeTarget = Readonly<{
  scope: 'scene' | 'story'
  storyId?: string
  trackId?: string
}>

/** Result of integrating one eventime into the player journal. */
export type RuntimePlayerEventimeResult = Readonly<{
  events: readonly RuntimeTrackEvent[]
}> 

/** Creates the stable runtime event identity of one compiled eventime declaration. */
export function createCompiledEventimeEventId(
  scope: 'scene' | 'story',
  trackId: string,
  storyId: string | undefined,
  declarationPath: readonly number[],
): string {
  const owner = storyId ?? 'scene'
  const path = declarationPath.join('.')
  return `compiled:${scope}:${owner}:${trackId}:${path}`
}
