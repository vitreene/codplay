import type { Diagnostic } from 'codplay/diagnostics'

/** Owns one source provider's idempotent attachment and stale-callback guard. */
export abstract class AbstractLiveSourceProvider {
  private lifecycle: 'detached' | 'attached' | 'destroyed' = 'detached'
  private attachmentGeneration = 0
  private readonly report: (diagnostic: Diagnostic) => void

  /** Creates a source provider with the host's existing diagnostic output. */
  constructor(reportDiagnostic: (diagnostic: Diagnostic) => void = () => undefined) {
    this.report = reportDiagnostic
  }

  /** Attaches once and gives this attachment a fresh callback generation. */
  attach(): void {
    if (this.lifecycle !== 'detached') return
    this.lifecycle = 'attached'
    this.attachmentGeneration += 1
    try {
      this.onAttach(this.attachmentGeneration)
    } catch (error) {
      this.lifecycle = 'detached'
      this.attachmentGeneration += 1
      throw error
    }
  }

  /** Detaches once and invalidates callbacks created by the active attachment. */
  detach(): void {
    if (this.lifecycle !== 'attached') return
    this.lifecycle = 'detached'
    this.attachmentGeneration += 1
    this.onDetach()
  }

  /** Releases provider state after invalidating any active attachment. */
  destroy(): void {
    if (this.lifecycle === 'destroyed') return
    this.detach()
    this.lifecycle = 'destroyed'
    this.onDestroy()
  }

  /** Returns whether the provider can accept a source notification. */
  protected isAttached(): boolean {
    return this.lifecycle === 'attached'
  }

  /** Returns the current generation for guarding one asynchronous callback. */
  protected getAttachmentGeneration(): number {
    return this.attachmentGeneration
  }

  /** Checks that one delayed callback belongs to the current live attachment. */
  protected isCurrentAttachment(generation: number): boolean {
    return this.lifecycle === 'attached' && generation === this.attachmentGeneration
  }

  /** Reports a source-specific failure through the existing diagnostic contract. */
  protected reportDiagnostic(diagnostic: Diagnostic): void {
    this.report(diagnostic)
  }

  /** Runs after one attachment generation has been established. */
  protected onAttach(_generation: number): void {}

  /** Runs after the active generation has been invalidated. */
  protected onDetach(): void {}

  /** Runs once after the provider enters its destroyed state. */
  protected onDestroy(): void {}
}
