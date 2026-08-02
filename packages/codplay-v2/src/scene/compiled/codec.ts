import type { DiagnosticOutput, DiagnosticReport } from '../../diagnostics'
import { DiagnosticCollector } from '../../diagnostics'
import { isPlainRecord } from '../../shared'
import { SCENE_BUILD_CONFIG } from '../config/scene-build'
import type {
  CompiledListenRule,
  CompiledPerso,
  CompiledRecord,
  CompiledScene,
  CompiledSceneData,
  CompiledStory,
  CompiledValue,
} from './types'

/** Result returned when decoding one external compiled-scene payload. */
export type CompiledSceneDecodeResult = Readonly<
  | { ok: true; value: CompiledScene; diagnostics: DiagnosticReport }
  | { ok: false; diagnostics: DiagnosticReport }
>

/** Options controlling diagnostics and the accepted compiled schema version. */
export type CompiledSceneCodecOptions = Readonly<{
  diagnosticOutput?: DiagnosticOutput
  schemaVersion?: string
}>

/** Encodes and validates the versioned CompiledScene envelope. */
export class CompiledSceneCodec {
  private readonly options: CompiledSceneCodecOptions

  /** Creates one codec for a known compiled-scene schema version. */
  constructor(options: CompiledSceneCodecOptions = {}) {
    this.options = options
  }

  /** Serializes one valid compiled artifact without involving runtime targets. */
  encode(scene: CompiledScene): string {
    const schemaVersion = this.options.schemaVersion ?? SCENE_BUILD_CONFIG.schemaVersion
    if (!isValidCompiledScene(scene, schemaVersion)) {
      throw new Error('CompiledScene cannot be encoded because its structure is invalid.')
    }
    return JSON.stringify(scene)
  }

  /** Decodes and validates one JSON payload before it can enter a player. */
  decode(input: string): CompiledSceneDecodeResult {
    const diagnostics = new DiagnosticCollector({ output: this.options.diagnosticOutput })
    let value: unknown
    try {
      value = JSON.parse(input) as unknown
    } catch {
      diagnostics.error('COMPILED_SCENE_JSON_INVALID', 'CompiledScene payload is not valid JSON.')
      return { ok: false, diagnostics: diagnostics.report() }
    }

    const schemaVersion = this.options.schemaVersion ?? SCENE_BUILD_CONFIG.schemaVersion
    if (!isValidCompiledScene(value, schemaVersion)) {
      diagnostics.error('COMPILED_SCENE_INVALID', 'CompiledScene envelope is invalid.')
      return { ok: false, diagnostics: diagnostics.report() }
    }

    freezeValue(value)
    return { ok: true, value, diagnostics: diagnostics.report() }
  }
}

/** Checks the complete serializable compiled-scene boundary. */
function isValidCompiledScene(value: unknown, schemaVersion: string): value is CompiledScene {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ['schemaVersion', 'createdAt', 'scene', 'resources', 'rootNodeIds', 'requirements'])) {
    return false
  }
  return value.schemaVersion === schemaVersion
    && typeof value.createdAt === 'string'
    && isValidSceneData(value.scene)
    && isValidResources(value.resources)
    && isStringArray(value.rootNodeIds)
    && isValidRequirements(value.requirements)
}

/** Checks the complete compiled scene payload. */
function isValidSceneData(value: unknown): value is CompiledSceneData {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ['id', 'name', 'stories', 'initial', 'straps', 'listen', 'state', 'tracks', 'defaults', 'init', 'onStart', 'onSequenceEnd'])) {
    return false
  }
  return typeof value.id === 'string'
    && (value.name === undefined || typeof value.name === 'string')
    && isRecordOf(value.stories, isValidStory)
    && (value.initial === undefined || isCompiledRecord(value.initial))
    && (value.straps === undefined || isStringArray(value.straps))
    && isCompiledListenArray(value.listen)
    && (value.state === undefined || isCompiledRecord(value.state))
    && isCompiledRecord(value.tracks)
    && (value.defaults === undefined || isCompiledRecord(value.defaults))
    && isFunctionReferenceOrUndefined(value.init)
    && isFunctionReferenceOrUndefined(value.onStart)
    && isFunctionReferenceOrUndefined(value.onSequenceEnd)
}

/** Checks one compiled story payload. */
function isValidStory(value: unknown): value is CompiledStory {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ['id', 'name', 'trackId', 'initial', 'persos', 'tracks', 'straps', 'listen', 'eventimes', 'state', 'init'])) {
    return false
  }
  return typeof value.id === 'string'
    && (value.name === undefined || typeof value.name === 'string')
    && (value.trackId === undefined || typeof value.trackId === 'string')
    && (value.initial === undefined || isCompiledRecord(value.initial))
    && Array.isArray(value.persos)
    && value.persos.every(isValidPerso)
    && (value.tracks === undefined || isCompiledRecord(value.tracks))
    && (value.straps === undefined || isStringArray(value.straps))
    && isCompiledListenArray(value.listen)
    && (value.eventimes === undefined || Array.isArray(value.eventimes) && value.eventimes.every(isValidEventime))
    && (value.state === undefined || isCompiledRecord(value.state))
    && isFunctionReferenceOrUndefined(value.init)
}

/** Checks one relative compiled eventime and all of its nested occurrences. */
function isValidEventime(value: unknown): boolean {
  return isPlainRecord(value)
    && hasOnlyKeys(value, ['name', 'startAt', 'data', 'events'])
    && typeof value.name === 'string'
    && typeof value.startAt === 'number'
    && Number.isFinite(value.startAt)
    && value.startAt >= 0
    && (value.data === undefined || isCompiledRecord(value.data))
    && (value.events === undefined || Array.isArray(value.events) && value.events.every(isValidEventime))
}

/** Checks one compiled perso payload. */
function isValidPerso(value: unknown): value is CompiledPerso {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ['id', 'name', 'type', 'initial', 'actions', 'list', 'emit'])) {
    return false
  }
  return typeof value.id === 'string'
    && (value.name === undefined || typeof value.name === 'string')
    && typeof value.type === 'string'
    && isCompiledRecord(value.initial)
    && isCompiledRecord(value.actions)
    && Object.values(value.actions).every(isCompiledValue)
    && (value.list === undefined || isCompiledRecord(value.list))
    && (value.emit === undefined || isCompiledRecord(value.emit))
}


/** Checks one compiled listen array and its function references. */
function isCompiledListenArray(value: unknown): value is readonly CompiledListenRule[] {
  return Array.isArray(value) && value.every((rule) => {
    if (!isPlainRecord(rule) || !hasOnlyKeys(rule, ['on', 'transform', 'emit', 'straps'])) return false
    return typeof rule.on === 'string'
      && (rule.transform === undefined || Array.isArray(rule.transform) && rule.transform.every(isFunctionReference))
      && (rule.emit === undefined || Array.isArray(rule.emit) && rule.emit.every(isCompiledRecord))
      && (rule.straps === undefined || isStringArray(rule.straps))
  })
}

/** Checks resource entries and their declared cache policies. */
function isValidResources(value: unknown): boolean {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ['entries']) || !Array.isArray(value.entries)) return false
  return value.entries.every((entry) => {
    if (!isPlainRecord(entry) || !hasOnlyKeys(entry, ['url', 'type', 'policy']) || !isPlainRecord(entry.policy)) return false
    return typeof entry.url === 'string'
      && typeof entry.type === 'string'
      && hasOnlyKeys(entry.policy, ['cache', 'version', 'hash', 'priority'])
      && (entry.policy.cache === 'default' || entry.policy.cache === 'no-store' || entry.policy.cache === 'immutable')
      && (entry.policy.version === undefined || typeof entry.policy.version === 'string')
      && (entry.policy.hash === undefined || typeof entry.policy.hash === 'string')
      && (entry.policy.priority === undefined || entry.policy.priority === 'high' || entry.policy.priority === 'normal' || entry.policy.priority === 'low')
  })
}

/** Checks the declared capability arrays of one compiled scene. */
function isValidRequirements(value: unknown): boolean {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ['components', 'services', 'modules', 'resources'])) return false
  return isStringArray(value.components)
    && isStringArray(value.services)
    && isStringArray(value.modules)
    && isStringArray(value.resources)
}

/** Checks one compiled recursive value without accepting runtime objects. */
function isCompiledValue(value: unknown): value is CompiledValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isCompiledValue)
  return isCompiledRecord(value) || isFunctionReference(value)
}

/** Checks one compiled record and every value it contains. */
function isCompiledRecord(value: unknown): value is CompiledRecord {
  return isPlainRecord(value) && Object.values(value).every(isCompiledValue)
}

/** Checks one external function reference. */
function isFunctionReference(value: unknown): value is { ref: string } {
  return isPlainRecord(value) && hasOnlyKeys(value, ['ref']) && typeof value.ref === 'string' && value.ref.length > 0
}

/** Checks an optional external function reference. */
function isFunctionReferenceOrUndefined(value: unknown): boolean {
  return value === undefined || isFunctionReference(value)
}

/** Checks one readonly string array boundary. */
function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

/** Checks one record whose values all satisfy the supplied predicate. */
function isRecordOf<T>(value: unknown, predicate: (value: unknown) => value is T): value is Readonly<Record<string, T>> {
  return isPlainRecord(value) && Object.values(value).every(predicate)
}

/** Rejects unknown fields at versioned envelope and section boundaries. */
function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}

/** Freezes decoded data before exposing it to a player boundary. */
function freezeValue(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return
  for (const child of Object.values(value)) freezeValue(child)
  Object.freeze(value)
}
