import { ComponentServiceBase } from 'codplay-v1'
import { VISEME_TO_RIVE_ID } from '../viseme-map'
import type { RiveSMIInput } from '../rive-context'

export class VisemeLipSyncService extends ComponentServiceBase {
  private readonly input: RiveSMIInput

  constructor(input: RiveSMIInput) {
    super()
    this.input = input
  }

  override apply(value: unknown): void {
    const name = typeof value === 'string' ? value : null
    this.input.value = name !== null ? (VISEME_TO_RIVE_ID[name] ?? 0) : 0
  }

  override reset(): void {
    this.input.value = 0
  }
}
