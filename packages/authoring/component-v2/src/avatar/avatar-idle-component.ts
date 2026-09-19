import type { ComponentUpdateInput } from 'codplay'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type { AvatarTarget } from './avatar-coordinator'
import type { AvatarIdleInitial } from './avatar-types'
import { createAvatarBlinkSchedule } from './avatar-idle-schedule'

/** Installs the non-event-driven idle behavior selected for one Avatar. */
export class AvatarIdleComponent extends AvatarFeatureComponent<AvatarIdleInitial> {
  static readonly declaredServices = [] as const

  private configuredTarget: AvatarTarget | undefined
  private configured = false

  /** Applies one stable deterministic blink scheduler to the selected Avatar. */
  protected contribute(target: AvatarTarget, _input: ComponentUpdateInput<AvatarIdleInitial>): void {
    if (this.configured && this.configuredTarget === target) return

    const schedule = this.perso.initial.blink === false
      ? null
      : createAvatarBlinkSchedule(resolveSeed(this.perso.initial.blinkSeed, this.perso.id))
    target.setBlinkSchedule(schedule)
    this.configuredTarget = target
    this.configured = true
  }
}

/** Creates a stable seed when the author leaves blink randomness unspecified. */
function resolveSeed(value: number | undefined, persoId: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return stableSeed(persoId)
}

/** Derives one repeatable seed from the component identity. */
function stableSeed(value: string): number {
  let hash = 2_166_261
  for (const character of value) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  }
  return hash | 0
}
