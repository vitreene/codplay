import type {
  ComponentActionOccurrence,
  ReplaceMotionProfile,
} from '../../components'
import type {
  RuntimeComponentUpdateContext,
  RuntimeModuleServiceContext,
  RuntimeModuleServiceInstance,
} from '../../engine'
import type { RuntimeModuleServiceDefinition } from '../../catalog'
import { normalizeReplacePresetCommand, REPLACE_TEXT_SPLITS } from '../replace-presets'
import {
  createPlayerReplaceAnimation,
  collectReplaceSeekOccurrences,
  findLatestReplaceCandidate,
  createReplaceSurfaceResolver,
  ReplaceTimelineSessions,
  type ReplaceSeekOccurrence,
} from '../replace-session'

/** Player-scoped runtime identifier for rich and plain text replacement. */
export const REPLACE_TEXT_MODULE_SERVICE_ID = 'replace-text' as const

type ReplaceOccurrence = Readonly<{
  key: string
  action: ComponentActionOccurrence
  command: NonNullable<ReturnType<typeof normalizeReplacePresetCommand>>
  mode?: ReplaceMotionProfile['mode']
}>

/** Creates the player-scoped text replacement module declaration. */
export function createReplaceTextModuleServiceDefinition(): RuntimeModuleServiceDefinition {
  return {
    id: REPLACE_TEXT_MODULE_SERVICE_ID,
    create: (context) => createReplaceTextModuleService(context),
  }
}

/** Creates one text service that coordinates replacement hooks and player samples. */
export function createReplaceTextModuleService(
  context: RuntimeModuleServiceContext,
): RuntimeModuleServiceInstance {
  const getReplaceSurface = createReplaceSurfaceResolver(context)
  const sessions = new ReplaceTimelineSessions(collectTextSeekOccurrences)

  /** Prepares the outgoing text view before one logical text update. */
  function beforeComponentUpdate(update: RuntimeComponentUpdateContext): void {
    if (!isTextComponent(update.componentType)) return
    const occurrence = resolveLatestReplaceOccurrence(update)
    if (!sessions.needsSession(update, occurrence?.key) || occurrence === undefined) return
    if (occurrence.mode === undefined) {
      sessions.markHandled(update.componentId, occurrence.key)
      return
    }
    const interruptedSnapshot = sessions.captureInterrupted(update)
    sessions.cancel(update.componentId)
    const definitionSlot = readSlotConfiguration(occurrence.command.definition)
    const session = getReplaceSurface(update.componentId)?.begin({
      ...occurrence.command.profile,
      mode: occurrence.mode,
      split: occurrence.command.split as 'letter' | 'word' | 'line' | undefined,
      stagger: occurrence.command.stagger,
      direction: occurrence.command.direction,
      skipUnchanged: occurrence.command.skipUnchanged ?? (definitionSlot !== undefined),
      slot: definitionSlot,
    }, interruptedSnapshot)
    if (session === undefined) return
    sessions.open(update.componentId, { key: occurrence.key, session })
  }

  /** Registers the sampled text transition after the persistent root is updated. */
  function afterComponentUpdate(update: RuntimeComponentUpdateContext): void {
    if (!isTextComponent(update.componentType)) return
    const occurrence = resolveLatestReplaceOccurrence(update)
    const active = sessions.activeFor(update, occurrence?.key)
    if (active === undefined || occurrence === undefined) return

    if (active.animation === undefined) {
      const { session } = active
      session.start()
      active.animation = createPlayerReplaceAnimation({
        id: `replace-text:${update.componentId}:${occurrence.key}:${sessions.nextId()}`,
        startAt: occurrence.action.startAt,
        duration: session.getDuration?.() ?? occurrence.command.duration,
        sample: (progress) => session.sample(progress),
        complete: () => {
          session.finish()
          sessions.release(update.componentId, session)
        },
      })
    }
    update.registerAnimation(active.animation)
  }

  /** Cancels a prepared snapshot when a component update fails. */
  function onComponentUpdateError(update: RuntimeComponentUpdateContext): void {
    if (isTextComponent(update.componentType)) sessions.cancel(update.componentId)
  }

  return {
    beforeComponentUpdate,
    afterComponentUpdate,
    onComponentUpdateError,
    beforeSeek: () => sessions.cancelAll(),
    prepareSeek: (scene) => sessions.prepareSeek(scene),
    onScenePresented: () => sessions.endSeek(),
    destroy: () => sessions.destroy(),
  }
}

/** Reads the text preset of one action, or undefined. */
function readTextCommand(action: ComponentActionOccurrence): ReplaceOccurrence['command'] | undefined {
  return normalizeReplacePresetCommand(action.action.replace, 'replace', REPLACE_TEXT_SPLITS)
}

/**
 * Selects the latest replace occurrence and derives its intro/outro formula
 * from content state. Only that latest command is normalized.
 */
function resolveLatestReplaceOccurrence(update: RuntimeComponentUpdateContext): ReplaceOccurrence | undefined {
  const candidate = findLatestReplaceCandidate(update.activeActions, readTextCommand)
  if (candidate === undefined) return undefined
  const outgoing = resolveContentBeforeOccurrence(update.initialState ?? {}, update.activeActions, candidate.index)
  return { ...candidate, mode: resolveReplaceMode(outgoing, update.state.content) }
}

/** Lists the text replace occurrences of one perso with an upper bound of their end. */
function collectTextSeekOccurrences(
  persoType: string,
  actions: readonly ComponentActionOccurrence[],
): readonly ReplaceSeekOccurrence[] {
  if (!isTextComponent(persoType)) return []
  return collectReplaceSeekOccurrences(actions, readTextCommand, (command) => ({
    durationMs: command.duration,
    propagates: command.split !== undefined,
    staggerMs: command.stagger,
  }))
}

/** Resolves the text value immediately before one action from initial and active state patches. */
function resolveContentBeforeOccurrence(
  initialState: Readonly<Record<string, unknown>>,
  actions: readonly ComponentActionOccurrence[],
  occurrenceIndex: number,
): unknown {
  let content = initialState.content
  for (let index = 0; index < occurrenceIndex; index += 1) {
    const action = actions[index]?.action
    if (action === undefined) continue
    if (Object.prototype.hasOwnProperty.call(action, 'content')) {
      content = action.content
    } else if (Object.prototype.hasOwnProperty.call(action, 'replace')) {
      content = null
    }
  }
  return content
}

/** Selects intro, outro, replacement, or no operation from the two content states. */
function resolveReplaceMode(outgoing: unknown, incoming: unknown): ReplaceMotionProfile['mode'] | undefined {
  const hasOutgoing = hasTextContent(outgoing)
  const hasIncoming = hasTextContent(incoming)
  if (!hasOutgoing && hasIncoming) return 'intro'
  if (hasOutgoing && !hasIncoming) return 'outro'
  if (hasOutgoing && hasIncoming) return 'replace'
  return undefined
}

/** Applies the user-defined null equivalence for text replacement content. */
function hasTextContent(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}

/** Restricts this capability to the text component types that own its content contract. */
function isTextComponent(componentType: string): boolean {
  return componentType === 'text' || componentType === 'tag'
}

/** Narrows the optional slot-roll settings retained in one JSON preset. */
function readSlotConfiguration(
  definition: ReplaceOccurrence['command']['definition'],
): ReplaceMotionProfile['slot'] | undefined {
  if (!('slot' in definition)) return undefined
  const slot = definition.slot
  if (slot === undefined || (slot.axis !== 'up' && slot.axis !== 'down')) return undefined
  return {
    axis: slot.axis,
    ...(typeof slot.bounce === 'number' ? { bounce: slot.bounce } : {}),
    ...(typeof slot.chroma === 'boolean' ? { chroma: slot.chroma } : {}),
  }
}
