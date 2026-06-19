import type { RuntimeComponentUpdateInput } from 'codplay/runtime/components/types'
import { RiveBaseComponent } from './rive-base-component'
import { StateMachineService } from './services/state-machine-service'
import { VisemeLipSyncService } from './services/viseme-lipsync-service'
import { EmotionService } from './services/emotion-service'
import type { CoachRiveInitial, CoachRiveActionPayload } from './rive-types'

export class CoachRiveComponent extends RiveBaseComponent {
  private _lipSync!: VisemeLipSyncService
  private _emotion?: EmotionService

  override init(): void {
    super.init()

    const initial = this.perso.initial as CoachRiveInitial
    const sm = new StateMachineService(this._riveCtx!, initial.stateMachine)
    this._addService(sm)

    const lipSyncInput = sm.getInput('lips sync id')
    if (!lipSyncInput) throw new Error(`[rive-coach] input "lips sync id" not found in "${initial.stateMachine}"`)
    this._lipSync = new VisemeLipSyncService(lipSyncInput)
    this._addService(this._lipSync)

    const emotionInput = sm.getInput('emotion')
    if (emotionInput) {
      this._emotion = new EmotionService(emotionInput)
      this._addService(this._emotion)
    }
  }

  override update(input: RuntimeComponentUpdateInput): void {
    super.update(input)
    const action = input.action as CoachRiveActionPayload
    const broadcast = action.broadcast
    if (broadcast?.type === 'START' || broadcast?.type === 'STOP') {
      this._resetServices()
      return
    }
    if ('viseme' in action) this._lipSync.apply(action['viseme'])
    if ('emotion' in action) this._emotion?.apply(action['emotion'])
  }
}
