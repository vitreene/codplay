import type { ComponentActionOccurrence } from '../../components'
import { createReplaceOccurrenceKey } from './occurrence-key'
import { resolveReplaceMaxEndAt, type ReplaceSeekOccurrence } from './seek-requirements'

/** One action carrying a replace command its module can present. */
export type ReplaceCandidate<Command> = Readonly<{
  key: string
  action: ComponentActionOccurrence
  command: Command
  /** Position of the action in the perso action list, for state replayed before it. */
  index: number
}>

/** Reads the replace command a module presents for one action, or undefined. */
export type ReplaceCommandReader<Command> = (action: ComponentActionOccurrence) => Command | undefined

/** Timing a seek needs to bound the end of one replace command. */
export type ReplaceCommandEnvelope = Readonly<{
  durationMs: number
  /** Whether a DOM-measured propagation (text split, mask grid) may extend the duration. */
  propagates: boolean
  staggerMs?: number
}>

/**
 * Finds the latest action whose replace command the module presents. The list
 * is read from its end, so only that latest command is normalized.
 */
export function findLatestReplaceCandidate<Command>(
  actions: readonly ComponentActionOccurrence[],
  readCommand: ReplaceCommandReader<Command>,
): ReplaceCandidate<Command> | undefined {
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const action = actions[index]
    if (action === undefined) continue
    const command = readCommand(action)
    if (command !== undefined) return { key: createReplaceOccurrenceKey(action), action, command, index }
  }
  return undefined
}

/** Lists every presentable replace occurrence of one perso, oldest first, with an upper bound of its end. */
export function collectReplaceSeekOccurrences<Command>(
  actions: readonly ComponentActionOccurrence[],
  readCommand: ReplaceCommandReader<Command>,
  readEnvelope: (command: Command) => ReplaceCommandEnvelope,
): readonly ReplaceSeekOccurrence[] {
  return actions.flatMap((action) => {
    const command = readCommand(action)
    if (command === undefined) return []
    const envelope = readEnvelope(command)
    return [{
      key: createReplaceOccurrenceKey(action),
      startAt: action.startAt,
      maxEndAt: resolveReplaceMaxEndAt(action.startAt, envelope.durationMs, envelope.propagates, envelope.staggerMs),
    }]
  })
}
