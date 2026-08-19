import type {
  CompiledFunctionCollection,
  CompiledListenRule,
  CompiledRecord,
  CompiledScene,
} from '../../../scene/compiled'
import { TRACK_GLOBAL_ID } from '../../config/track'
import { STRAP_SCOPE_SCENE, STRAP_SCOPE_STORY } from '../../config/strap-scope'
import {
  TRACK_EVENT_ACTIVATE,
  TRACK_EVENT_DEACTIVATE,
  TRACK_EVENT_TOGGLE,
} from '../../config/track-events'
import { executeListenPipeline, type ListenEventInput, type ListenPipelineIssue, type ListenStrapExecution } from './listen'
import { RuntimeStateStore } from './runtime-state-store'
import type { StrapCollections } from './strap-collections'
import type { StrapCollection } from './strap-executor'
import { RuntimeTrackJournal, type RuntimeTrackEvent } from './track-journal'
import { resolveStoryTrackId } from './tracks'

/** One live event accepted by the single runtime dispatch circuit. */
export type RuntimeEventInput = Readonly<{
  name: string
  applyAtMs: number
  eventId?: string
  trackId?: string
  storyId?: string
  data?: CompiledRecord
  /** Routes the event through scene rules and global materialization. */
  cascade?: boolean
  /** Opaque context available to transforms and straps. */
  context?: Readonly<Record<string, unknown>>
  /** Opaque metadata retained with each journal event. */
  meta?: Readonly<Record<string, unknown>>
}>

/** One non-fatal diagnostic produced while dispatching a live event. */
export type RuntimeEventDispatchIssue = Readonly<{
  code: string
  message: string
  eventName?: string
  ruleName?: string
  functionRef?: string
  strapName?: string
  depth?: number
}>

/** Complete result of one live event and all its declared cascades. */
export type RuntimeEventDispatchResult = Readonly<{
  ok: boolean
  events: readonly RuntimeTrackEvent[]
  straps: readonly ListenStrapExecution[]
  issues: readonly RuntimeEventDispatchIssue[]
}>

/** Dependencies of the deterministic event router. */
export type RuntimeEventDispatcherOptions = Readonly<{
  scene: CompiledScene
  journal: RuntimeTrackJournal
  strapCollections?: StrapCollections
  functions?: CompiledFunctionCollection
  stateStore?: RuntimeStateStore
  maxCascadeDepth?: number
}>

type DispatchScope = 'scene' | 'story'

type DispatchTarget = Readonly<{
  trackId: string
  storyId?: string
  cascade: boolean
}>

type PipelineSelection = Readonly<{
  scope: DispatchScope
  storyId?: string
  rules: readonly CompiledListenRule[]
  straps: StrapCollection
}>

type DispatchAccumulator = {
  ok: boolean
  events: RuntimeTrackEvent[]
  straps: ListenStrapExecution[]
  issues: RuntimeEventDispatchIssue[]
}

/**
 * Routes live events through the one V2 event circuit and persists every
 * resulting fact in the immutable-track journal for both Play and Seek.
 */
export class RuntimeEventDispatcher {
  private readonly scene: CompiledScene
  private readonly journal: RuntimeTrackJournal
  private readonly strapCollections: StrapCollections
  private readonly functions: CompiledFunctionCollection
  private readonly stateStore: RuntimeStateStore | undefined
  private readonly maxCascadeDepth: number
  private nextGeneratedEventId = 0

  /** Creates one dispatcher bound to one player journal and compiled scene. */
  constructor(options: RuntimeEventDispatcherOptions) {
    this.scene = options.scene
    this.journal = options.journal
    this.strapCollections = options.strapCollections ?? { scene: {}, stories: {} }
    this.functions = options.functions ?? {}
    this.stateStore = options.stateStore
    this.maxCascadeDepth = options.maxCascadeDepth ?? 32
  }

  /** Dispatches one live event and recursively routes only declared emissions. */
  async dispatch(input: RuntimeEventInput): Promise<RuntimeEventDispatchResult> {
    const accumulator: DispatchAccumulator = {
      ok: true,
      events: [],
      straps: [],
      issues: [],
    }
    if (input.name.trim().length === 0) {
      accumulator.ok = false
      accumulator.issues.push({
        code: 'RUNTIME_EVENT_NAME_INVALID',
        message: 'Runtime event name must not be empty.',
      })
      return accumulator
    }
    await this.route(input, 0, accumulator)
    return accumulator
  }

  /** Routes one event, appends it once, then processes its matching rules. */
  private async route(
    input: RuntimeEventInput,
    depth: number,
    accumulator: DispatchAccumulator,
  ): Promise<void> {
    if (depth > this.maxCascadeDepth) {
      accumulator.issues.push({
        code: 'RUNTIME_EVENT_CASCADE_LIMIT',
        message: `Runtime event cascade exceeded the maximum depth of ${this.maxCascadeDepth}.`,
        eventName: input.name,
        depth,
      })
      return
    }

    const target = this.resolveTarget(input, accumulator, depth)
    if (target === undefined) return
    const appended = this.journal.appendLiveEvent({
      eventId: input.eventId ?? this.createGeneratedEventId(),
      trackId: target.trackId,
      storyId: target.storyId,
      name: input.name,
      applyAtMs: input.applyAtMs,
      data: input.data,
      cascade: target.cascade,
      context: input.context,
      meta: input.meta,
    })
    if (!appended.ok) {
      accumulator.ok = false
      accumulator.issues.push({
        code: appended.code,
        message: appended.message,
        eventName: input.name,
        depth,
      })
      return
    }
    accumulator.events.push(appended.data)

    if (isTrackControlEvent(input.name)) {
      const control = this.journal.applyControlEvent(input.name, input.data)
      if (!control.ok) {
        accumulator.ok = false
        accumulator.issues.push({
          code: control.code,
          message: control.message,
          eventName: input.name,
          depth,
        })
      }
    }

    const selection = this.selectPipeline(input, target)
    if (selection === undefined) return
    const event: ListenEventInput = {
      eventId: appended.data.eventId,
      eventSeq: appended.data.eventSeq,
      name: appended.data.name,
      applyAtMs: appended.data.applyAtMs,
      trackId: appended.data.trackId,
      storyId: appended.data.storyId,
      data: appended.data.data,
      cascade: appended.data.cascade,
      context: appended.data.context,
      meta: appended.data.meta,
    }
    const execution = await executeListenPipeline({
      rules: selection.rules,
      event,
      functions: this.functions,
      straps: selection.straps,
      state: this.readState(selection.scope, selection.storyId),
      meta: input.meta,
      context: input.context,
    })
    for (const issue of execution.issues) accumulator.issues.push(this.toDispatchIssue(issue, input.name, depth))

    accumulator.straps.push(...execution.straps)
    for (const strapExecution of execution.straps) {
      for (const issue of strapExecution.result.issues) {
        accumulator.issues.push({
          ...issue,
          eventName: input.name,
          ruleName: strapExecution.ruleName,
          depth,
        })
      }
      for (const warning of strapExecution.result.warnings) {
        accumulator.issues.push({
          code: 'RUNTIME_STRAP_WARNING',
          message: warning,
          eventName: input.name,
          ruleName: strapExecution.ruleName,
          depth,
        })
      }
      const strapName = strapExecution.strapNames[0]
      if (strapName === undefined) continue
      const appendedOutput = this.journal.appendStrapOutput({
        scope: selection.scope === 'story' ? STRAP_SCOPE_STORY : STRAP_SCOPE_SCENE,
        storyId: selection.storyId,
        strapName,
        anchorMs: input.applyAtMs,
        output: strapExecution.result,
      })
      if (!appendedOutput.ok) {
        accumulator.ok = false
        accumulator.issues.push({
          code: appendedOutput.code,
          message: appendedOutput.message,
          eventName: input.name,
          ruleName: strapExecution.ruleName,
          strapName,
          depth,
        })
        continue
      }
      accumulator.events.push(...appendedOutput.data.events)
      this.applyImmediateStateUpdates(appendedOutput.data.events, input.applyAtMs)
    }

    await this.routeDeclaredEmissions(selection, execution.events, input, depth, accumulator)
  }

  /** Resolves the declared storage track without creating a runtime track. */
  private resolveTarget(
    input: RuntimeEventInput,
    accumulator: DispatchAccumulator,
    depth: number,
  ): DispatchTarget | undefined {
    const localStory = input.storyId !== undefined && input.cascade !== true
    if (localStory) {
      const story = this.scene.scene.stories[input.storyId!]
      if (story === undefined) {
        accumulator.ok = false
        accumulator.issues.push({
          code: 'RUNTIME_STORY_UNKNOWN',
          message: `Runtime event story is not declared: ${input.storyId}`,
          eventName: input.name,
          depth,
        })
        return undefined
      }
      return {
        trackId: input.trackId ?? resolveStoryTrackId(story),
        storyId: story.id,
        cascade: false,
      }
    }
    return {
      trackId: input.trackId ?? TRACK_GLOBAL_ID,
      storyId: undefined,
      cascade: true,
    }
  }

  /** Chooses story rules first, then scene rules, without mixing scopes. */
  private selectPipeline(input: RuntimeEventInput, target: DispatchTarget): PipelineSelection | undefined {
    if (target.storyId !== undefined && target.cascade === false) {
      const story = this.scene.scene.stories[target.storyId]
      const storyRules = story?.listen.filter((rule) => rule.on === input.name) ?? []
      if (storyRules.length > 0) {
        return {
          scope: 'story',
          storyId: target.storyId,
          rules: storyRules,
          straps: this.strapCollections.stories[target.storyId] ?? {},
        }
      }
    }
    const sceneRules = this.scene.scene.listen.filter((rule) => rule.on === input.name)
    if (sceneRules.length === 0) return undefined
    return {
      scope: 'scene',
      rules: sceneRules,
      straps: this.strapCollections.scene,
    }
  }

  /** Reinjects only declared `emit` outputs, preventing pass-through loops. */
  private async routeDeclaredEmissions(
    selection: PipelineSelection,
    outputs: readonly ListenEventInput[],
    input: RuntimeEventInput,
    depth: number,
    accumulator: DispatchAccumulator,
  ): Promise<void> {
    let outputIndex = 0
    for (const rule of selection.rules) {
      if (rule.emit === undefined) {
        if (outputIndex < outputs.length) outputIndex += 1
        continue
      }
      for (let emissionIndex = 0; emissionIndex < rule.emit.length; emissionIndex += 1) {
        const output = outputs[outputIndex]
        outputIndex += 1
        if (output === undefined) continue
        const cascade = output.cascade === true
        await this.route({
          name: output.name,
          applyAtMs: input.applyAtMs,
          data: output.data,
          storyId: cascade ? undefined : selection.scope === 'story' ? selection.storyId : undefined,
          cascade,
          context: output.context ?? input.context,
          meta: output.meta ?? input.meta,
        }, depth + 1, accumulator)
      }
    }
  }

  /** Reads the state owned by the rule scope without exposing mutable storage. */
  private readState(scope: DispatchScope, storyId: string | undefined): Readonly<Record<string, unknown>> {
    if (this.stateStore === undefined) return {}
    return this.stateStore.snapshot(
      scope === 'story' ? STRAP_SCOPE_STORY : STRAP_SCOPE_SCENE,
      storyId,
    )
  }

  /** Applies only updates effective at the current dispatch boundary. */
  private applyImmediateStateUpdates(events: readonly RuntimeTrackEvent[], anchorMs: number): void {
    if (this.stateStore === undefined) return
    for (const event of events) {
      if (event.update === undefined || event.applyAtMs > anchorMs || event.stateScope === undefined) continue
      this.stateStore.applyUpdate(event.stateScope, event.update, event.storyId)
    }
  }

  /** Converts a listen issue while retaining its runtime event context. */
  private toDispatchIssue(issue: ListenPipelineIssue, eventName: string, depth: number): RuntimeEventDispatchIssue {
    return { ...issue, eventName, depth }
  }

  /** Allocates a process-local id when an external event has no identity. */
  private createGeneratedEventId(): string {
    const index = this.nextGeneratedEventId
    this.nextGeneratedEventId += 1
    return `runtime-dispatch:${this.scene.scene.id}:${index}`
  }
}

/** Identifies controls that mutate only the declared track activity layer. */
function isTrackControlEvent(name: string): boolean {
  return name === TRACK_EVENT_ACTIVATE || name === TRACK_EVENT_DEACTIVATE || name === TRACK_EVENT_TOGGLE
}
