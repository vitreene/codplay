import {
  BaseComponent,
  type ComponentActionOccurrence,
  type ComponentAnimation,
  type ComponentInput,
  type ComponentUpdateInput,
} from 'codplay'

import type {
  RiveArtboard,
  RiveDocumentTarget,
  RiveStateMachineInput,
  RiveStateMachineInstance,
} from './rive-context'
import type {
  RiveInputValues,
  RiveStateMachineActionPayload,
  RiveStateMachineInitial,
} from './rive-types'

type RivePlayback = 'playing' | 'paused' | 'stopped'

/** Drives one native Rive state machine attached to a Rive document host. */
export class RiveStateMachineComponent extends BaseComponent<RiveStateMachineInitial> {
  static readonly declaredServices = [] as const

  private readonly initial = this.perso.initial
  private readonly initialPlayback: RivePlayback
  private target: RiveDocumentTarget | undefined
  private stateMachine: RiveStateMachineInstance | undefined
  private targetRevision = -1
  private instanceRevision = 0
  private playback: RivePlayback
  private lastTimeMs: number | undefined
  private activeActions: readonly ComponentActionOccurrence[] = []
  private needsInputReplay = false

  /** Creates the logical state-machine component without a materialized root. */
  public constructor(input: ComponentInput<RiveStateMachineInitial>) {
    super(input)
    this.initialPlayback = this.resolveInitialPlayback()
    this.playback = this.initialPlayback
  }

  /** Applies broadcasts and generic named input values to the state machine. */
  public update(input: ComponentUpdateInput): void {
    const target = input.target as RiveDocumentTarget | undefined
    if (!this.ensureStateMachine(target)) return

    const activeActions = input.activeActions ?? []
    this.activeActions = activeActions
    this.applyActions(activeActions, input.timeMs)
    this.needsInputReplay = false

    if (input.registerAnimation) {
      input.registerAnimation(this.createAdvanceAnimation())
      return
    }

    this.advanceAt(input.timeMs)
  }

  /** Releases the native state-machine instance owned by this component. */
  public destroy(): void {
    this.stateMachine?.delete()
    this.stateMachine = undefined
    this.target = undefined
    this.activeActions = []
  }

  /** Registers the state-machine stream in the content presentation phase. */
  private createAdvanceAnimation(): ComponentAnimation {
    return {
      id: 'rive-state-machine-advance',
      startAt: 0,
      endAt: Number.POSITIVE_INFINITY,
      sample: (timeMs) => ({
        value: `${timeMs}:${this.targetRevision}:${this.instanceRevision}:${this.playback}`,
        apply: () => this.advanceAt(timeMs),
      }),
    }
  }

  /** Applies active actions in authored order so STOP resets later input writes. */
  private applyActions(
    actions: readonly ComponentActionOccurrence[],
    timeMs: number,
  ): void {
    for (const occurrence of actions) {
      const action = occurrence.action as RiveStateMachineActionPayload
      const broadcast = action.broadcast?.type

      if (broadcast === 'START') {
        this.playback = 'playing'
        this.lastTimeMs = occurrence.startAt
      } else if (broadcast === 'PAUSE') {
        this.playback = 'paused'
        this.lastTimeMs = timeMs
      } else if (broadcast === 'STOP') {
        this.playback = 'stopped'
        this.resetStateMachine()
        this.lastTimeMs = timeMs
        continue
      }

      if (this.playback === 'paused' || this.playback === 'stopped') continue
      this.applyInputValues(this.resolveActionInputs(action))
    }
  }

  /** Advances the native state machine from one absolute CodPlay time. */
  private advanceAt(timeMs: number): void {
    if (!this.ensureStateMachine(this.target)) return
    if (this.needsInputReplay) {
      this.replayInputs()
      this.needsInputReplay = false
    }

    if (this.lastTimeMs !== undefined && timeMs < this.lastTimeMs) {
      this.resetStateMachine()
      this.replayInputs()
      this.needsInputReplay = false
      this.lastTimeMs = 0
    }

    const deltaMs = Math.max(0, timeMs - (this.lastTimeMs ?? timeMs))
    if (this.playback === 'playing' && deltaMs > 0) {
      this.stateMachine!.advance(deltaMs / 1000)
    }
    this.lastTimeMs = timeMs
  }

  /** Rebuilds the native instance after a STOP or host artboard replacement. */
  private resetStateMachine(): void {
    const target = this.target
    const artboard = target?.getArtboard()
    if (!target || !artboard) return

    this.stateMachine?.delete()
    this.stateMachine = this.createStateMachine(target, artboard)
    this.targetRevision = target.getRevision()
    this.instanceRevision += 1
    this.applyInputValues(this.initial.inputs)
    this.needsInputReplay = true
  }

  /** Ensures that the component points at the currently published host artboard. */
  private ensureStateMachine(target: RiveDocumentTarget | undefined): boolean {
    const artboard = target?.getArtboard()
    if (!target || !artboard) return false
    if (
      this.stateMachine !== undefined
      && this.target === target
      && this.targetRevision === target.getRevision()
    ) return true

    this.stateMachine?.delete()
    this.target = target
    this.targetRevision = target.getRevision()
    this.stateMachine = this.createStateMachine(target, artboard)
    this.instanceRevision += 1
    this.lastTimeMs = 0
    this.applyInputValues(this.initial.inputs)
    this.needsInputReplay = true
    return true
  }

  /** Creates one native state-machine instance from the host-owned artboard. */
  private createStateMachine(
    target: RiveDocumentTarget,
    artboard: RiveArtboard,
  ): RiveStateMachineInstance {
    const reference = artboard.stateMachineByName(this.initial.stateMachine)
    const StateMachineInstance = target.getRuntime().StateMachineInstance
    return new StateMachineInstance(reference, artboard)
  }

  /** Resolves one named input from the native state machine. */
  private resolveInput(name: string | undefined): RiveStateMachineInput | undefined {
    if (name === undefined || this.stateMachine === undefined) return undefined
    for (let index = 0; index < this.stateMachine.inputCount(); index += 1) {
      const input = this.stateMachine.input(index)
      if (input.name === name) return input
    }
    return undefined
  }

  /** Returns the native input patch represented by one state-machine action. */
  private resolveActionInputs(action: RiveStateMachineActionPayload): RiveInputValues | undefined {
    return action.inputs
  }

  /** Applies named author values to matching native state-machine inputs. */
  private applyInputValues(values: RiveInputValues | undefined): void {
    if (values === undefined) return
    for (const [name, value] of Object.entries(values)) {
      const input = this.resolveInput(name)
      if (input !== undefined) input.value = value
    }
  }

  /** Reapplies active inputs after the host replaces its artboard. */
  private replayInputs(): void {
    this.applyInputValues(this.initial.inputs)
    let acceptsInputs = this.initialPlayback === 'playing'
    for (const occurrence of this.activeActions) {
      const action = occurrence.action as RiveStateMachineActionPayload
      const broadcast = action.broadcast?.type
      if (broadcast === 'START') acceptsInputs = true
      if (broadcast === 'PAUSE' || broadcast === 'STOP') acceptsInputs = false
      if (!acceptsInputs) continue
      this.applyInputValues(this.resolveActionInputs(action))
    }
  }

  /** Resolves the initial playback state used before the first broadcast. */
  private resolveInitialPlayback(): RivePlayback {
    for (const value of Object.values(this.perso.actions ?? {})) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
      const broadcast = (value as { broadcast?: { type?: unknown } }).broadcast?.type
      if (broadcast === 'START' || broadcast === 'PAUSE' || broadcast === 'STOP') return 'stopped'
    }
    return 'playing'
  }
}
