import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ReplaceComponentSurface,
  ReplaceMotionProfile,
  ReplacePresentationSession,
} from '../../components'
import type {
  RuntimeComponentUpdateContext,
  RuntimeModuleServiceContext,
  RuntimeModuleServiceInstance,
} from '../../engine'
import type { RuntimeModuleServiceDefinition } from '../../catalog'
import { normalizeReplacePresetCommand, REPLACE_TEXT_SPLITS } from '../replace-presets'

/** Player-scoped runtime identifier for rich and plain text replacement. */
export const REPLACE_TEXT_MODULE_SERVICE_ID = 'replace-text' as const

type ReplaceOccurrence = Readonly<{
  key: string
  action: ComponentActionOccurrence
  command: NonNullable<ReturnType<typeof normalizeReplacePresetCommand>>
  mode?: ReplaceMotionProfile['mode']
}>

type ActiveReplaceSession = {
  key: string
  session: ReplacePresentationSession
  animation?: ComponentAnimation
}

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
  const getReplaceSurface = context.componentSurfaces === undefined
    ? (_componentId: string): ReplaceComponentSurface | undefined => undefined
    : (componentId: string) => context.componentSurfaces?.getReplaceSurface?.(componentId)
  const sessions = new Map<string, ActiveReplaceSession>()
  const handledOccurrences = new Map<string, string>()
  let nextSessionId = 1

  /** Cancels one presentation session and removes its runtime bookkeeping. */
  function cancelSession(componentId: string): void {
    const active = sessions.get(componentId)
    if (active === undefined) return
    active.session.cancel()
    sessions.delete(componentId)
  }

  /** Prepares the outgoing text view before one logical text update. */
  function beforeComponentUpdate(update: RuntimeComponentUpdateContext): void {
    if (!isTextComponent(update.componentType)) return
    const occurrence = resolveLatestReplaceOccurrence(update)
    if (update.phase === 'geometry-capture') {
      cancelSession(update.componentId)
      if (occurrence !== undefined) handledOccurrences.set(update.componentId, occurrence.key)
      else handledOccurrences.delete(update.componentId)
      return
    }

    const active = sessions.get(update.componentId)
    if (occurrence === undefined) {
      cancelSession(update.componentId)
      handledOccurrences.delete(update.componentId)
      return
    }
    if (active?.key === occurrence.key) {
      active.session.reflow?.()
      return
    }
    if (handledOccurrences.get(update.componentId) === occurrence.key) return

    if (occurrence.mode === undefined) {
      cancelSession(update.componentId)
      handledOccurrences.set(update.componentId, occurrence.key)
      return
    }
    const interruptedSnapshot = active?.session.captureCurrent?.()
    cancelSession(update.componentId)
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
    handledOccurrences.set(update.componentId, occurrence.key)
    sessions.set(update.componentId, { key: occurrence.key, session })
  }

  /** Registers the sampled text transition after the persistent root is updated. */
  function afterComponentUpdate(update: RuntimeComponentUpdateContext): void {
    if (!isTextComponent(update.componentType)) return
    const occurrence = resolveLatestReplaceOccurrence(update)
    const active = sessions.get(update.componentId)
    if (update.phase === 'geometry-capture' || occurrence === undefined || active?.key !== occurrence.key) return

    if (active.animation === undefined) {
      active.session.start()
      active.animation = createReplaceAnimation({
        componentId: update.componentId,
        key: occurrence.key,
        startAt: occurrence.action.startAt,
        duration: active.session.getDuration?.() ?? occurrence.command.duration,
        session: active.session,
        sessions,
        sessionId: nextSessionId++,
      })
    }
    update.registerAnimation(active.animation)
  }

  /** Cancels a prepared snapshot when a component update fails. */
  function onComponentUpdateError(update: RuntimeComponentUpdateContext): void {
    if (isTextComponent(update.componentType)) cancelSession(update.componentId)
  }

  /** Reconstructs player-clocked sessions when the player seeks. */
  function beforeSeek(): void {
    for (const componentId of [...sessions.keys()]) cancelSession(componentId)
    handledOccurrences.clear()
  }

  /** Releases all sessions and resets this player-scoped service. */
  function destroy(): void {
    beforeSeek()
    sessions.clear()
    handledOccurrences.clear()
    nextSessionId = 1
  }

  return { beforeComponentUpdate, afterComponentUpdate, onComponentUpdateError, beforeSeek, destroy }
}

/** Selects the latest replace occurrence and derives its intro/outro formula from content state. */
function resolveLatestReplaceOccurrence(update: RuntimeComponentUpdateContext): ReplaceOccurrence | undefined {
  let latest: ReplaceOccurrence | undefined
  for (let index = 0; index < update.activeActions.length; index += 1) {
    const action = update.activeActions[index]
    if (action === undefined) continue
    const command = normalizeReplacePresetCommand(action.action.replace, 'replace', REPLACE_TEXT_SPLITS)
    if (command === undefined) continue
    const outgoing = resolveContentBeforeOccurrence(update.initialState ?? {}, update.activeActions, index)
    const mode = resolveReplaceMode(outgoing, update.state.content)
    latest = {
      key: `${action.eventId ?? action.name}:${action.startAt}:${index}`,
      action,
      command,
      mode,
    }
  }
  return latest
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

/** Registers one player-clocked presentation stream for the current occurrence. */
function createReplaceAnimation(options: Readonly<{
  componentId: string
  key: string
  startAt: number
  duration: number
  session: ReplacePresentationSession
  sessions: Map<string, ActiveReplaceSession>
  sessionId: number
}>): ComponentAnimation {
  const endAt = options.startAt + options.duration
  return {
    id: `replace-text:${options.componentId}:${options.key}:${options.sessionId}`,
    startAt: options.startAt,
    endAt,
    sample: (timeMs) => {
      if (timeMs < options.startAt) return undefined
      if (timeMs >= endAt) {
        return {
          value: 'complete',
          apply: () => {
            options.session.finish()
            if (options.sessions.get(options.componentId)?.session === options.session) {
              options.sessions.delete(options.componentId)
            }
          },
        }
      }
      const progress = endAt === options.startAt
        ? 1
        : (timeMs - options.startAt) / (endAt - options.startAt)
      const normalized = Math.min(1, Math.max(0, progress))
      return { value: normalized, apply: () => options.session.sample(normalized) }
    },
  }
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
