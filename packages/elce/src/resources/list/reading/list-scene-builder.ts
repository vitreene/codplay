import type { AuthorStrapCollection, PersoDoc, SceneListenRule } from 'codplay/scene/types'
import type { StrapFunction } from 'codplay/runtime/player'
import type { ListContent, ListPrefix } from '../domain/list-types'
import { ListService } from '../domain/list-service'

export type ListEntryTriggerMode = 'live' | 'compiled-eventime'

export interface ListSceneBuildInput {
  readonly list: ListContent
  readonly idPrefix: string
  readonly partId: string
  readonly entryEventName?: string
  readonly entryTriggerMode?: ListEntryTriggerMode
  readonly exitEventName?: string
  readonly initiallyVisible?: boolean
}

export interface ListSceneBuild {
  readonly markup: string
  readonly persos: readonly PersoDoc<string>[]
  readonly straps: AuthorStrapCollection
  readonly listen: readonly SceneListenRule[]
  readonly revealEventimes: readonly Readonly<{ name: string; startAt: number }>[]
}

const LIST_ROW_REVEAL_DURATION_MS = 200

const CLASS_BY_PREFIX: Readonly<Record<ListPrefix, string>> = {
  none: 'none',
  disc: 'disc',
  square: 'square',
  dash: 'dash',
  'lower-alpha': 'lower-alpha',
  decimal: 'decimal',
  'lower-roman': 'lower-roman',
  custom: 'custom',
}

/** Builds semantic list markup, row persos, and CodPlay reveal events. */
export class ListSceneBuilder {
  private readonly service: ListService = new ListService()

  /** Projects one List value without consulting the resource that hosts it. */
  public build(input: ListSceneBuildInput): ListSceneBuild {
    const { list } = input
    this.service.assertValid(list)
    const isOrdered = list.prefix === 'lower-alpha' || list.prefix === 'decimal' || list.prefix === 'lower-roman'
    const tag = isOrdered ? 'ol' : 'ul'
    const id = `${input.idPrefix}-list`
    const attrs = [
      `id="${id}"`,
      `class="elce-list-module elce-list-module--${CLASS_BY_PREFIX[list.prefix]}"`,
      `data-part="${input.partId}"`,
      ...(isOrdered ? [`start="${list.start}"`] : []),
    ].join(' ')
    let elapsedMs = 0
    const visibleRows = list.rows.filter((row) => row.text.trim().length > 0)
    const revealRows = visibleRows.map((row, index) => {
      elapsedMs += row.delayMs ?? (index === 0 ? 0 : list.intervalMs)
      return {
        row,
        offsetMs: elapsedMs,
        revealEventName: `${input.idPrefix}:list:row:${row.id}:reveal`,
        hideEventName: `${input.idPrefix}:list:row:${row.id}:hide`,
      }
    })
    const persos = revealRows.map(({ row, revealEventName, hideEventName }): PersoDoc<string> => {
      const initial = {
        tag: 'li',
        content: row.text,
        ...(list.prefix === 'custom' ? { attr: { 'data-marker': list.customMarker } } : {}),
        ...(input.entryEventName === undefined ? {} : { style: { opacity: input.initiallyVisible === true ? 1 : 0 } }),
        move: { target: input.partId },
      }
      const actions = {
        ...(input.entryEventName === undefined ? {} : {
          [input.entryEventName]: { style: { opacity: 0 } },
          [revealEventName]: {
            duration: LIST_ROW_REVEAL_DURATION_MS,
            ease: 'linear',
            fn: resolveListRowRevealFrame,
          },
        }),
        ...(input.exitEventName === undefined ? {} : {
          [input.exitEventName]: { style: { opacity: 0 } },
          [hideEventName]: { style: { opacity: 0 } },
        }),
      }
      return { id: `${input.idPrefix}-row-${row.id}`, type: 'tag', initial, ...(Object.keys(actions).length === 0 ? {} : { actions }) }
    })
    const strapName = `${input.idPrefix}:list:reveal`
    const stateKey = `${input.idPrefix}:list:pending-reveals`
    const liveEntryEventName = input.entryTriggerMode === 'compiled-eventime' ? undefined : input.entryEventName
    const straps: AuthorStrapCollection = liveEntryEventName === undefined
      ? {}
      : { [strapName]: createListRevealStrap(revealRows, stateKey, liveEntryEventName, input.exitEventName) }
    const listen: readonly SceneListenRule[] = liveEntryEventName === undefined
      ? []
      : [
          { on: liveEntryEventName, straps: [strapName] },
          ...(input.exitEventName === undefined ? [] : [{ on: input.exitEventName, straps: [strapName] }]),
        ]
    const revealEventimes = revealRows.map((row) => ({ name: row.revealEventName, startAt: row.offsetMs }))
    return { markup: `<${tag} ${attrs}></${tag}>`, persos, straps, listen, revealEventimes }
  }
}

/** Resolves the CodPlay opacity frame for one revealed List row. */
function resolveListRowRevealFrame(input: Readonly<{ progress: number }>) {
  return { style: { opacity: input.progress } }
}

/** Schedules row reveals and repairs outstanding events when the List is re-entered. */
function createListRevealStrap(
  rows: readonly Readonly<{ revealEventName: string; hideEventName: string; offsetMs: number }>[],
  stateKey: string,
  entryEventName: string,
  exitEventName: string | undefined,
): StrapFunction {
  return ({ event, state, context }) => {
    const nowMs = event.applyAtMs ?? 0
    const pendingTimes = readPendingRevealTimes(state[stateKey]).filter((timeMs) => timeMs > nowMs)

    if (event.name === entryEventName) {
      const nextPendingTimes = [...new Set([
        ...pendingTimes,
        ...rows.map((row) => nowMs + row.offsetMs).filter((timeMs) => timeMs > nowMs),
      ])].sort((left, right) => left - right)
      const corrections = pendingTimes.flatMap((timeMs) => rows.flatMap((row) => context.planned.wait(
        timeMs - nowMs,
        { event: { name: row.offsetMs <= timeMs - nowMs ? row.revealEventName : row.hideEventName } },
      )))
      const immediateEvents = rows
        .filter((row) => row.offsetMs === 0)
        .map((row) => ({ name: row.revealEventName }))
      const plannedReveals = rows.flatMap((row) => row.offsetMs === 0
        ? []
        : context.planned.wait(row.offsetMs, { event: { name: row.revealEventName } }))
      return [{ update: { [stateKey]: nextPendingTimes } }, { events: immediateEvents }, corrections, plannedReveals]
    }

    if (event.name === exitEventName && exitEventName !== undefined) {
      const corrections = pendingTimes.flatMap((timeMs) => rows.flatMap((row) => context.planned.wait(
        timeMs - nowMs,
        { event: { name: row.hideEventName } },
      )))
      return [{ update: { [stateKey]: pendingTimes } }, corrections]
    }

    return undefined
  }
}

/** Reads outstanding reveal times from the List's serializable story state. */
function readPendingRevealTimes(value: unknown): readonly number[] {
  if (!Array.isArray(value)) return []
  return value.filter((time): time is number => typeof time === 'number' && Number.isFinite(time) && time >= 0)
}

