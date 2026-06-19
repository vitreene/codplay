import { ComponentServiceBase } from 'codplay'
import type { RiveContext, RiveSMIInput } from '../rive-context'

type RiveStateMachineInstance = {
  advance(sec: number): void
  inputCount(): number
  input(i: number): RiveSMIInput
}

export class StateMachineService extends ComponentServiceBase {
  private readonly smInstance: RiveStateMachineInstance

  constructor(ctx: RiveContext, stateMachineName: string) {
    super()
    const smRef = ctx.artboard.stateMachineByName(stateMachineName)
    if (!smRef) throw new Error(`[rive] state machine "${stateMachineName}" not found`)
    this.smInstance = new ctx.runtime.StateMachineInstance(smRef, ctx.artboard) as RiveStateMachineInstance
  }

  override advance(sec: number): void {
    this.smInstance.advance(sec)
  }

  apply(_value: unknown): void {}

  getInput(name: string): RiveSMIInput | null {
    const count = this.smInstance.inputCount()
    for (let i = 0; i < count; i++) {
      const inp = this.smInstance.input(i)
      if (inp.name === name) return inp.asNumber()
    }
    return null
  }
}
