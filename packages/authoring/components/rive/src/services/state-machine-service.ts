import { ComponentServiceBase } from 'codplay'
import type { RiveContext, RiveSMIInput, RiveStateMachineInstance } from '../rive-context'

export class StateMachineService extends ComponentServiceBase {
  private readonly ctx: RiveContext
  private readonly stateMachineName: string
  private smInstance: RiveStateMachineInstance

  constructor(ctx: RiveContext, stateMachineName: string) {
    super()
    this.ctx = ctx
    this.stateMachineName = stateMachineName
    this.smInstance = this.createInstance(ctx)
  }

  override advance(sec: number): void {
    void this.smInstance.advance(sec)
  }

  apply(_value: unknown): void {}

  override reset(): void {
    this.recreate()
  }

  override destroy(): void {
    this.smInstance.delete()
  }

  getInput(name: string): RiveSMIInput | null {
    const count = this.smInstance.inputCount()
    for (let i = 0; i < count; i++) {
      const inp = this.smInstance.input(i)
      if (inp.name === name) return inp.asNumber()
    }
    return null
  }

  private recreate(): void {
    this.smInstance.delete()
    this.smInstance = this.createInstance(this.ctx)
  }

  private createInstance(ctx: RiveContext): RiveStateMachineInstance {
    const smRef = ctx.artboard.stateMachineByName(this.stateMachineName)
    if (!smRef) throw new Error(`[rive] state machine "${this.stateMachineName}" not found`)
    return new ctx.runtime.StateMachineInstance(smRef, ctx.artboard) as RiveStateMachineInstance
  }
}
