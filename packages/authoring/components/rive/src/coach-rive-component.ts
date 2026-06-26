import { RiveStateMachineComponent } from './rive-state-machine-component'
import { VisemeLipSyncService } from './services/viseme-lipsync-service'
import { EmotionService } from './services/emotion-service'
import type { CoachRiveInitial, CoachRiveActionPayload } from './rive-types'

export class CoachRiveComponent extends RiveStateMachineComponent {
  private _lipSync: VisemeLipSyncService | null = null
  private _emotion: EmotionService | null = null

  protected override _initializeInternalServices(): void {
    super._initializeInternalServices()

    const initial = this.perso.initial as CoachRiveInitial
    const lipSyncInput = this._getStateMachineInput('lips sync id')
    if (!lipSyncInput) throw new Error(`[rive-coach] input "lips sync id" not found in "${initial.stateMachine}"`)
    this._lipSync = new VisemeLipSyncService(lipSyncInput)
    this._addService(this._lipSync)

    const emotionInput = this._getStateMachineInput('emotion')
    if (emotionInput) {
      this._emotion = new EmotionService(emotionInput)
      this._addService(this._emotion)
    }
  }

  protected override _applyAction(action: CoachRiveActionPayload): void {
    if ('viseme' in action) this._lipSync?.apply(action['viseme'])
    if ('emotion' in action) this._emotion?.apply(action['emotion'])
  }
}
