export type LegacyEvent = {
  name?: string
  start?: number
  data?: unknown
  duration?: number
}

export type LegacyPerso = {
  type: string
  initial: Record<string, unknown>
  actions: Record<string, boolean | Record<string, unknown>>
  media?: Record<string, unknown>
}

export type LegacyInput = {
  persos: Map<string, LegacyPerso> | Record<string, LegacyPerso>
  eventtimes: Map<number, LegacyEvent | LegacyEvent[]> | Record<number, LegacyEvent | LegacyEvent[]>
}

export type ConversionError = {
  code:
    | 'E_NO_PERSOS'
    | 'E_NO_EVENTTIMES'
    | 'E_ITEM_ID_MISSING'
    | 'E_EVENT_NAME_MISSING'
    | 'E_ACTION_MOVE_TARGET_MISSING'
  message: string
  payload?: Record<string, unknown>
}

export type ConversionWarning = {
  code:
    | 'W_TYPE_UNKNOWN'
    | 'W_PARENT_SYNTHETIC_CREATED'
    | 'W_ID_CANONICAL_DIFFERENT_FROM_KEY'
    | 'W_DUPLICATE_EVENT_SAME_MS_NAME'
  message: string
  payload?: Record<string, unknown>
}

export type ConvertedTimelineEvent = {
  id: string
  ms: number
  name: string
  index: number
  source: 'story'
  trackId: string
  payload?: Record<string, unknown>
}

export type ConvertedItemDoc = {
  id: string
  type: string
  initial: Record<string, unknown>
  children?: string[]
  list?: {
    autoAnimate: {
      insert: boolean
      remove: boolean
      move: boolean
      durationMs: number
      easing: string
    }
  }
  actions: Record<string, Record<string, unknown>>
  media?: {
    legacy: Record<string, unknown>
  }
}

export type ConvertedStoryDoc = {
  id: string
  items: Record<string, ConvertedItemDoc>
  trackId: string
  events: ConvertedTimelineEvent[]
}

export type ConvertedTrackDoc = {
  id: string
  source: 'story'
  order: number
  active: boolean
  ownerStoryId: string
  events: ConvertedTimelineEvent[]
}

export type ConvertedScenarioGraph = {
  initialNodeId: 'node-main'
  nodes: {
    'node-main': {
      id: 'node-main'
      storyRef: {
        storyId: 'story-main'
        instanceId: 'story-main#1'
      }
      transitions: []
    }
  }
}

export type ConvertedSceneDoc = {
  id: 'scene-main'
  stories: {
    'story-main': ConvertedStoryDoc
  }
  scenario: ConvertedScenarioGraph
  tracks: {
    'track-story-main': ConvertedTrackDoc
  }
}

export type ConvertedV1 = {
  scene: ConvertedSceneDoc
  conversion: {
    warnings: ConversionWarning[]
    stats: {
      inputPersos: number
      outputItems: number
      inputEvents: number
      outputEvents: number
    }
  }
}

export type ConvertLegacyResult =
  | {
      ok: true
      data: ConvertedV1
    }
  | {
      ok: false
      error: {
        code: 'CONVERSION_BLOCKED'
        errors: ConversionError[]
        warnings: ConversionWarning[]
      }
    }

const TYPE_MAP: Record<string, string> = {
  LIST: 'list',
  IMG: 'img',
  TEXT: 'text',
  VIDEO: 'video',
  SOUND: 'audio',
  AUDIO: 'audio',
  SPRITE: 'sprite',
  LOTTIE: 'lottie'
}

const DEFAULT_LIST_CONFIG = {
  autoAnimate: {
    insert: true,
    remove: true,
    move: true,
    durationMs: 500,
    easing: 'ease-out'
  }
} as const

/**
 * Clones one JSON-friendly value to avoid mutating legacy inputs.
 */
function cloneValue<T>(value: T): T {
  if (value === undefined) {
    return value
  }

  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Normalizes a map or record into deterministic key/value entries.
 */
function toEntries<K extends string | number, V>(
  input: Map<K, V> | Record<string, V>
): Array<[K, V]> {
  if (input instanceof Map) {
    return [...input.entries()]
  }

  return Object.entries(input).map(([key, value]) => [key as K, value])
}

/**
 * Resolves one canonical item identifier from legacy perso key and initial state.
 */
function resolveCanonicalItemId(
  persoKey: string,
  initial: Record<string, unknown>,
  warnings: ConversionWarning[]
): string {
  const initialId = typeof initial.id === 'string' && initial.id.trim().length > 0 ? initial.id : undefined
  const canonicalId = initialId ?? persoKey

  if (initialId && initialId !== persoKey) {
    warnings.push({
      code: 'W_ID_CANONICAL_DIFFERENT_FROM_KEY',
      message: 'initial.id differs from perso key; canonical id uses initial.id',
      payload: {
        persoKey,
        initialId,
        canonicalId
      }
    })
  }

  return canonicalId
}

/**
 * Maps a legacy item type to its V1 runtime type.
 */
function mapLegacyType(type: string, itemId: string, warnings: ConversionWarning[]): string {
  const normalizedType = type.toUpperCase()
  const mappedType = TYPE_MAP[normalizedType]
  if (mappedType) {
    return mappedType
  }

  warnings.push({
    code: 'W_TYPE_UNKNOWN',
    message: 'Unknown legacy type mapped to unknown',
    payload: {
      itemId,
      legacyType: type
    }
  })
  return 'unknown'
}

/**
 * Converts legacy actions while preserving event key matching.
 */
function convertLegacyActions(actions: Record<string, boolean | Record<string, unknown>>): Record<string, Record<string, unknown>> {
  const convertedActions: Record<string, Record<string, unknown>> = {}

  for (const [eventName, actionValue] of Object.entries(actions)) {
    if (typeof actionValue === 'boolean') {
      convertedActions[eventName] = {}
      continue
    }

    convertedActions[eventName] = cloneValue(actionValue)
  }

  return convertedActions
}

/**
 * Reads one numeric sort order from initial style metadata.
 */
function resolveInitialOrder(item: ConvertedItemDoc): number {
  const style = item.initial.style
  if (typeof style !== 'object' || style === null) {
    return Number.POSITIVE_INFINITY
  }

  const order = (style as Record<string, unknown>).order
  if (typeof order !== 'number' || Number.isNaN(order)) {
    return Number.POSITIVE_INFINITY
  }

  return order
}

/**
 * Converts legacy eventtimes into sorted and deduplicated timeline events.
 */
function convertLegacyEvents(
  eventtimes: Map<number, LegacyEvent | LegacyEvent[]> | Record<number, LegacyEvent | LegacyEvent[]>,
  errors: ConversionError[],
  warnings: ConversionWarning[]
): {
  inputEvents: number
  outputEvents: ConvertedTimelineEvent[]
} {
  const trackId = 'track-story-main'
  const rawEntries = toEntries<number, LegacyEvent | LegacyEvent[]>(eventtimes)
  const expandedEvents: Array<{
    ms: number
    name: string
    localIndex: number
    payload?: Record<string, unknown>
  }> = []

  for (const [msKey, value] of rawEntries) {
    const ms = Number(msKey)
    const eventsAtMs = Array.isArray(value) ? value : [value]

    for (let localIndex = 0; localIndex < eventsAtMs.length; localIndex += 1) {
      const event = eventsAtMs[localIndex]
      const name = event.name
      if (typeof name !== 'string' || name.trim().length === 0) {
        errors.push({
          code: 'E_EVENT_NAME_MISSING',
          message: 'Legacy event name is missing',
          payload: {
            ms,
            localIndex
          }
        })
        continue
      }

      const payload: Record<string, unknown> = {}
      if (event.data !== undefined) {
        payload.data = cloneValue(event.data)
      }

      if (event.duration !== undefined) {
        payload.duration = event.duration
      }

      expandedEvents.push({
        ms,
        name,
        localIndex,
        payload: Object.keys(payload).length > 0 ? payload : undefined
      })
    }
  }

  expandedEvents.sort((left, right) => {
    const byMs = left.ms - right.ms
    if (byMs !== 0) {
      return byMs
    }

    return left.localIndex - right.localIndex
  })

  const dedupedEvents: ConvertedTimelineEvent[] = []
  const seenDuplicateKeys = new Set<string>()
  for (const event of expandedEvents) {
    const duplicateKey = `${event.ms}|${event.name}`
    if (seenDuplicateKeys.has(duplicateKey)) {
      warnings.push({
        code: 'W_DUPLICATE_EVENT_SAME_MS_NAME',
        message: 'Duplicate event at same ms and name is dropped',
        payload: {
          ms: event.ms,
          name: event.name
        }
      })
      continue
    }

    seenDuplicateKeys.add(duplicateKey)
    const globalIndex = dedupedEvents.length
    dedupedEvents.push({
      id: `evt-${event.ms}-${event.localIndex}-${globalIndex}`,
      ms: event.ms,
      name: event.name,
      index: globalIndex,
      source: 'story',
      trackId,
      payload: event.payload
    })
  }

  return {
    inputEvents: expandedEvents.length,
    outputEvents: dedupedEvents
  }
}

/**
 * Creates one synthetic list parent item when a referenced parent is missing.
 */
function createSyntheticListItem(parentId: string): ConvertedItemDoc {
  return {
    id: parentId,
    type: 'list',
    initial: {
      id: parentId,
      tag: 'div'
    },
    actions: {},
    list: cloneValue(DEFAULT_LIST_CONFIG)
  }
}

/**
 * Builds list children arrays from initial parent attachments.
 */
function assignListChildren(
  itemsById: Record<string, ConvertedItemDoc>,
  initialParentByItemId: Map<string, string>
): void {
  const childrenByParentId = new Map<string, string[]>()

  for (const [childId, parentId] of initialParentByItemId.entries()) {
    const parent = itemsById[parentId]
    if (!parent || parent.type !== 'list') {
      continue
    }

    const parentChildren = childrenByParentId.get(parentId) ?? []
    parentChildren.push(childId)
    childrenByParentId.set(parentId, parentChildren)
  }

  for (const [parentId, children] of childrenByParentId.entries()) {
    children.sort((leftChildId, rightChildId) => {
      const leftItem = itemsById[leftChildId]
      const rightItem = itemsById[rightChildId]
      const byOrder = resolveInitialOrder(leftItem) - resolveInitialOrder(rightItem)
      if (byOrder !== 0) {
        return byOrder
      }

      return leftChildId.localeCompare(rightChildId)
    })

    itemsById[parentId].children = children
  }
}

/**
 * Validates that every action.move target references an existing converted item.
 */
function validateActionMoveTargets(itemsById: Record<string, ConvertedItemDoc>, errors: ConversionError[]): void {
  for (const item of Object.values(itemsById)) {
    for (const [eventName, action] of Object.entries(item.actions)) {
      const move = action.move
      if (typeof move !== 'string') {
        continue
      }

      if (itemsById[move]) {
        continue
      }

      errors.push({
        code: 'E_ACTION_MOVE_TARGET_MISSING',
        message: 'Action move target does not exist in converted items',
        payload: {
          itemId: item.id,
          eventName,
          moveTargetId: move
        }
      })
    }
  }
}

/**
 * Converts legacy persos into V1 items and resolves initial parent attachments.
 */
function convertLegacyItems(
  persos: Map<string, LegacyPerso> | Record<string, LegacyPerso>,
  errors: ConversionError[],
  warnings: ConversionWarning[]
): {
  outputItems: Record<string, ConvertedItemDoc>
} {
  const outputItems: Record<string, ConvertedItemDoc> = {}
  const initialParentByItemId = new Map<string, string>()
  const persoEntries = toEntries<string, LegacyPerso>(persos)

  for (const [persoKey, perso] of persoEntries) {
    const initial = cloneValue(perso.initial)
    const canonicalId = resolveCanonicalItemId(persoKey, initial, warnings)
    if (canonicalId.trim().length === 0) {
      errors.push({
        code: 'E_ITEM_ID_MISSING',
        message: 'Converted item id is missing',
        payload: {
          persoKey
        }
      })
      continue
    }

    const itemType = mapLegacyType(perso.type, canonicalId, warnings)
    const convertedItem: ConvertedItemDoc = {
      id: canonicalId,
      type: itemType,
      initial,
      actions: convertLegacyActions(perso.actions)
    }

    if (convertedItem.type === 'list' && convertedItem.list === undefined) {
      convertedItem.list = cloneValue(DEFAULT_LIST_CONFIG)
    }

    if (perso.media !== undefined) {
      convertedItem.media = {
        legacy: cloneValue(perso.media)
      }
    }

    const parentId = typeof convertedItem.initial.move === 'string' ? convertedItem.initial.move : undefined
    if (parentId) {
      initialParentByItemId.set(canonicalId, parentId)
    }

    outputItems[canonicalId] = convertedItem
  }

  for (const parentId of initialParentByItemId.values()) {
    if (outputItems[parentId]) {
      continue
    }

    outputItems[parentId] = createSyntheticListItem(parentId)
    warnings.push({
      code: 'W_PARENT_SYNTHETIC_CREATED',
      message: 'Missing initial parent created as synthetic list container',
      payload: {
        parentId
      }
    })
  }

  assignListChildren(outputItems, initialParentByItemId)
  validateActionMoveTargets(outputItems, errors)

  return {
    outputItems
  }
}

/**
 * Converts one legacy payload into a deterministic V1 scene document.
 */
export function convertLegacyToV1(input: LegacyInput): ConvertLegacyResult {
  const errors: ConversionError[] = []
  const warnings: ConversionWarning[] = []

  const persoEntries = toEntries(input.persos)
  if (persoEntries.length === 0) {
    errors.push({
      code: 'E_NO_PERSOS',
      message: 'Legacy persos collection is empty'
    })
  }

  const eventEntries = toEntries(input.eventtimes)
  if (eventEntries.length === 0) {
    errors.push({
      code: 'E_NO_EVENTTIMES',
      message: 'Legacy eventtimes collection is empty'
    })
  }

  const convertedItems = convertLegacyItems(input.persos, errors, warnings)
  const convertedEvents = convertLegacyEvents(input.eventtimes, errors, warnings)

  if (errors.length > 0) {
    return {
      ok: false,
      error: {
        code: 'CONVERSION_BLOCKED',
        errors,
        warnings
      }
    }
  }

  const storyId = 'story-main'
  const trackId = 'track-story-main'

  const story: ConvertedStoryDoc = {
    id: storyId,
    items: convertedItems.outputItems,
    trackId,
    events: convertedEvents.outputEvents
  }

  const scene: ConvertedSceneDoc = {
    id: 'scene-main',
    stories: {
      'story-main': story
    },
    scenario: {
      initialNodeId: 'node-main',
      nodes: {
        'node-main': {
          id: 'node-main',
          storyRef: {
            storyId: 'story-main',
            instanceId: 'story-main#1'
          },
          transitions: []
        }
      }
    },
    tracks: {
      'track-story-main': {
        id: trackId,
        source: 'story',
        order: 0,
        active: true,
        ownerStoryId: storyId,
        events: convertedEvents.outputEvents
      }
    }
  }

  return {
    ok: true,
    data: {
      scene,
      conversion: {
        warnings,
        stats: {
          inputPersos: persoEntries.length,
          outputItems: Object.keys(convertedItems.outputItems).length,
          inputEvents: convertedEvents.inputEvents,
          outputEvents: convertedEvents.outputEvents.length
        }
      }
    }
  }
}
