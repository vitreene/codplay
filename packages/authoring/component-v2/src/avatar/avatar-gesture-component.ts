import type { ComponentUpdateInput } from 'codplay'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type { AvatarTarget } from './avatar-coordinator'
import type { AvatarGestureInitial } from './avatar-types'

/** Contributes one gesture selection to the Avatar coordinator. */
export class AvatarGestureComponent extends AvatarFeatureComponent<AvatarGestureInitial> {
  static readonly declaredServices = [] as const

  /** Stores the selected gesture and derives a stable replay seed from its occurrence. */
  protected contribute(target: AvatarTarget, input: ComponentUpdateInput<AvatarGestureInitial>): void {
    const gesture = input.state.gesture ?? null
    const occurrence = [...(input.activeActions ?? [])]
      .reverse()
      .find((candidate) => 'gesture' in candidate.action)
    const seed = input.state.seed ?? stableSeed(occurrence?.eventId ?? gesture)
    target.setGesture(gesture, seed)
  }
}

/** Derives a repeatable seed when a gesture is supplied as stable initial data. */
function stableSeed(gesture: string | null): number {
  if (gesture === null) return 0
  let hash = 2_166_136_261
  for (const character of gesture) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  return hash | 0
}
