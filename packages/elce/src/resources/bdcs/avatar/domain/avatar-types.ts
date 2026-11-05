import type { RiveTalkingAvatarFrame } from '@codplay/story/rive-talking-avatar'
import type { AVATAR_POSITIONS, AVATAR_PROFILE_ID } from '../avatar-config'

export interface AvatarTake {
  readonly id: string
  readonly audioMediaId: string
  readonly durationMs: number
  readonly words: readonly Readonly<{ text: string; startAtMs: number; endAtMs: number }>[]
  readonly frames: readonly RiveTalkingAvatarFrame[]
}

export interface AvatarContent {
  readonly profileId: typeof AVATAR_PROFILE_ID
  readonly autoStart: boolean
  readonly placement: Readonly<{
    position: typeof AVATAR_POSITIONS[number]['value']
    widthPercent: number
  }>
  readonly take: AvatarTake | null
}
