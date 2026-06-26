import { RiveBaseComponent } from './rive-base-component'
import { StateMachineService } from './services/state-machine-service'
import type { RiveSMIInput } from './rive-context'
import type { RiveStateMachineInitial } from './rive-types'

export class RiveStateMachineComponent extends RiveBaseComponent {
  protected _stateMachine: StateMachineService | null = null

  protected override _initializeInternalServices(): void {
    const initial = this.perso.initial as RiveStateMachineInitial
    const stateMachine = new StateMachineService(this._riveCtx!, initial.stateMachine)
    this._stateMachine = stateMachine
    this._addService(stateMachine)
  }

  protected _getStateMachineInput(name: string): RiveSMIInput | null {
    return this._stateMachine?.getInput(name) ?? null
  }
}
