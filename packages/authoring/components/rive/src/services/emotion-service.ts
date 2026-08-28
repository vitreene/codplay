import { ComponentServiceBase } from 'codplay-v1'
import type { RiveSMIInput } from '../rive-context'

export class EmotionService extends ComponentServiceBase {
  private readonly input: RiveSMIInput

  constructor(input: RiveSMIInput) {
    super()
    this.input = input
  }

  override apply(value: unknown): void {
    if (typeof value === 'number') {
      this.input.value = value
    }
  }

  override reset(): void {
    this.input.value = 0
  }
}
