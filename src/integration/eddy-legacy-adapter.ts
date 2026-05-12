import { convertLegacyToV1, type LegacyInput, type LegacyPerso } from '../legacy-converter/convert-legacy-to-v1'
import type { PersoDoc, SceneDoc } from '../player/types'

export type EddyLegacySnapshot = {
  persos: unknown[]
  eventtimes: Map<number, unknown> | Record<string, unknown>
}

export type EddyAdapterWarning = {
  code: 'W_EVENTTIMES_EMPTY_PREVIEW_NORMALIZED' | 'W_PERSO_ID_FALLBACK'
  message: string
  payload?: Record<string, unknown>
}

export type EddyAdapterError = {
  code: 'E_PERSOS_NOT_ARRAY' | 'E_EVENTTIMES_INVALID'
  message: string
}

export type AdaptEddySnapshotOptions = {
  allowEmptyEventtimesPreview?: boolean
}

export type AdaptEddySnapshotResult =
  | {
      ok: true
      data: {
        legacyInput: LegacyInput
        warnings: EddyAdapterWarning[]
      }
    }
  | {
      ok: false
      error: EddyAdapterError
    }

export type ConvertEddySnapshotResult =
  | {
      ok: true
      data: {
        scene: SceneDoc
        warnings: EddyAdapterWarning[]
        conversionWarnings: Array<{ code: string; message: string }>
      }
    }
  | {
      ok: false
      error: {
        code: string
        message: string
      }
    }

/**
 * Resolves one deterministic perso key for adapter output.
 */
function resolvePersoKey(perso: LegacyPerso, index: number, warnings: EddyAdapterWarning[]): string {
  const initialId = typeof perso.initial.id === 'string' ? perso.initial.id : undefined
  if (initialId && initialId.trim().length > 0) {
    return initialId
  }

  const fallbackId = `legacy-perso-${index + 1}`
  warnings.push({
    code: 'W_PERSO_ID_FALLBACK',
    message: 'Legacy perso has no initial.id, fallback key generated',
    payload: {
      fallbackId,
      index
    }
  })
  return fallbackId
}

/**
 * Converts legacy persos array into record shape expected by converter.
 */
function toPersoRecord(persos: unknown[], warnings: EddyAdapterWarning[]): Record<string, LegacyPerso> {
  const record: Record<string, LegacyPerso> = {}

  for (let index = 0; index < persos.length; index += 1) {
    const value = persos[index]
    if (typeof value !== 'object' || value === null) {
      continue
    }

    const perso = value as LegacyPerso
    const key = resolvePersoKey(perso, index, warnings)
    record[key] = perso
  }

  return record
}

/**
 * Detects whether eventtimes contains no event entries.
 */
function isEmptyEventtimes(eventtimes: Map<number, unknown> | Record<string, unknown>): boolean {
  if (eventtimes instanceof Map) {
    return eventtimes.size === 0
  }

  return Object.keys(eventtimes).length === 0
}

/**
 * Normalizes eventtimes for preview mode when source data is empty.
 */
function normalizeEventtimes(
  eventtimes: Map<number, unknown> | Record<string, unknown>,
  allowEmptyEventtimesPreview: boolean,
  warnings: EddyAdapterWarning[]
): LegacyInput['eventtimes'] {
  if (!isEmptyEventtimes(eventtimes)) {
    return eventtimes as LegacyInput['eventtimes']
  }

  if (!allowEmptyEventtimesPreview) {
    return eventtimes as LegacyInput['eventtimes']
  }

  warnings.push({
    code: 'W_EVENTTIMES_EMPTY_PREVIEW_NORMALIZED',
    message: 'eventtimes is empty, preview mode injects one empty time bucket at 0ms'
  })

  return {
    0: []
  }
}

/**
 * Adapts Eddy snapshot payload into converter-compatible legacy input.
 */
export function adaptEddySnapshot(
  snapshot: EddyLegacySnapshot,
  options: AdaptEddySnapshotOptions = {}
): AdaptEddySnapshotResult {
  if (!Array.isArray(snapshot.persos)) {
    return {
      ok: false,
      error: {
        code: 'E_PERSOS_NOT_ARRAY',
        message: 'Expected persos to be an array'
      }
    }
  }

  if (typeof snapshot.eventtimes !== 'object' || snapshot.eventtimes === null) {
    return {
      ok: false,
      error: {
        code: 'E_EVENTTIMES_INVALID',
        message: 'Expected eventtimes to be a map or object'
      }
    }
  }

  const warnings: EddyAdapterWarning[] = []
  const persos = toPersoRecord(snapshot.persos, warnings)
  const eventtimes = normalizeEventtimes(snapshot.eventtimes, options.allowEmptyEventtimesPreview ?? true, warnings)

  return {
    ok: true,
    data: {
      legacyInput: {
        persos,
        eventtimes
      },
      warnings
    }
  }
}

/**
 * Converts one converted runtime item record into strict scene persos.
 */
function convertItemsToPersos(items: Record<string, { id: string; type: string; initial: Record<string, unknown>; actions: Record<string, unknown>; children?: string[]; list?: unknown; media?: unknown }>) {
  return Object.values(items).map((item): PersoDoc => ({
    id: item.id,
    type: item.type,
    initial: item.initial,
    children: item.children,
    actions: item.actions as PersoDoc['actions']
  }))
}

/**
 * Converts one Eddy snapshot into SceneDoc consumable by createPlayer.
 */
export function convertEddySnapshotToScene(
  snapshot: EddyLegacySnapshot,
  options: AdaptEddySnapshotOptions = {}
): ConvertEddySnapshotResult {
  const adapted = adaptEddySnapshot(snapshot, options)
  if (!adapted.ok) {
    return {
      ok: false,
      error: {
        code: adapted.error.code,
        message: adapted.error.message
      }
    }
  }

  const converted = convertLegacyToV1(adapted.data.legacyInput)
  if (!converted.ok) {
    const firstError = converted.error.errors[0]
    return {
      ok: false,
      error: {
        code: firstError?.code ?? 'CONVERSION_FAILED',
        message: firstError?.message ?? 'Legacy conversion failed'
      }
    }
  }

  const mainStory = converted.data.scene.stories['story-main']
  const playerScene: SceneDoc = {
    id: converted.data.scene.id,
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: mainStory.id,
        entries: Object.keys(mainStory.items),
        initial: undefined,
        persos: convertItemsToPersos(mainStory.items),
        straps: undefined,
        listen: []
      }
    },
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    onStart(scene, options) {
      options.start(scene.rootStories[0])
    },
    tracks: converted.data.scene.tracks
  }

  return {
    ok: true,
    data: {
      scene: playerScene,
      warnings: adapted.data.warnings,
      conversionWarnings: converted.data.conversion.warnings
    }
  }
}
