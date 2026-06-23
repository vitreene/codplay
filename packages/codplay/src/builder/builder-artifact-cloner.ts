import type { CompiledScene, ResourceManifest, SceneDef, StoryDef } from './types'

/**
 * Clones builder artifacts without mutating caller-owned inputs.
 */
export class BuilderArtifactCloner {
  /**
   * Clones one compiled scene while preserving plain object structure.
   */
  cloneCompiledScene(compiledScene: CompiledScene): CompiledScene {
    return {
      schemaVersion: compiledScene.schemaVersion,
      createdAt: compiledScene.createdAt,
      scene: this.cloneSceneDef(compiledScene.scene),
      resources: this.cloneResourceManifest(compiledScene.resources),
      rootNodeIds: this.cloneData(compiledScene.rootNodeIds)
    }
  }

  /**
   * Clones one resource manifest payload.
   */
  cloneResourceManifest(manifest: ResourceManifest): ResourceManifest {
    return this.cloneData(manifest)
  }

  /**
   * Clones one scene definition with stable arrays for validation and compile outputs.
   */
  cloneSceneDef(scene: SceneDef): SceneDef {
    const clonedStories: Record<string, StoryDef> = {}

    for (const [storyId, story] of Object.entries(scene.stories)) {
      clonedStories[storyId] = {
        id: story.id,
        name: story.name,
        trackId: story.trackId,
        tracks: this.cloneData(story.tracks),
        entries: this.cloneData(story.entries),
        initial: this.cloneData(story.initial),
        persos: story.persos.map(perso => this.cloneData(perso)),
        straps: story.straps,
        listen: story.listen.map(rule => ({
          on: rule.on,
          transform: rule.transform,
          emit: this.cloneData(rule.emit),
          straps: this.cloneData(rule.straps)
        })),
        eventimes: this.cloneData(story.eventimes),
        state: this.cloneData(story.state),
        init: story.init
      }
    }

    return {
      id: scene.id,
      stories: clonedStories,
      rootStories: this.cloneData(scene.rootStories),
      initial: this.cloneData(scene.initial),
      straps: this.cloneData(scene.straps),
      listen: scene.listen.map(rule => ({
        on: rule.on,
        transform: rule.transform,
        emit: this.cloneData(rule.emit),
        straps: this.cloneData(rule.straps)
      })),
      state: this.cloneData(scene.state),
      init: scene.init,
      onStart: scene.onStart,
      onSequenceEnd: scene.onSequenceEnd,
      tracks: this.cloneData(scene.tracks)
    }
  }

  /**
   * Clones one data payload without mutating the caller-owned structure.
   * Function values anywhere in the structure (e.g. perso action templates
   * like `{ blink: someFn }`) are extracted by reference before cloning —
   * mirroring how story.straps bypasses structuredClone — then substituted
   * back into the cloned skeleton, so structuredClone never sees a function.
   */
  private cloneData<T>(value: T): T {
    if (value === undefined) {
      return value
    }
    if (typeof value === 'function') {
      return value
    }

    const fnRefs = new Map<string, unknown>()
    const skeleton = this.extractFns(value, fnRefs)

    const cloned = typeof globalThis.structuredClone === 'function'
      ? globalThis.structuredClone(skeleton)
      : JSON.parse(JSON.stringify(skeleton))

    return fnRefs.size === 0 ? (cloned as T) : (this.restoreFns(cloned, fnRefs) as T)
  }

  /** Plain object/array structure only — Date, RegExp, Map, Set, etc. are left for structuredClone to handle natively. */
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object') return false
    const proto = Object.getPrototypeOf(value)
    return proto === Object.prototype || proto === null
  }

  /** Walks a value, replacing function leaves with `{ [FN_REF]: <key> }` placeholders recorded in fnRefs. */
  private extractFns(value: unknown, fnRefs: Map<string, unknown>): unknown {
    if (typeof value === 'function') {
      const ref = `fn:${fnRefs.size}`
      fnRefs.set(ref, value)
      return { [FN_REF]: ref }
    }
    if (Array.isArray(value)) {
      return value.map(item => this.extractFns(item, fnRefs))
    }
    if (this.isPlainObject(value)) {
      const result: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.extractFns(val, fnRefs)
      }
      return result
    }
    return value
  }

  /** Reverses extractFns: replaces `{ [FN_REF]: <key> }` placeholders with the original function. */
  private restoreFns(value: unknown, fnRefs: Map<string, unknown>): unknown {
    if (this.isPlainObject(value) && typeof value[FN_REF] === 'string') {
      return fnRefs.get(value[FN_REF])
    }
    if (Array.isArray(value)) {
      return value.map(item => this.restoreFns(item, fnRefs))
    }
    if (this.isPlainObject(value)) {
      const result: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.restoreFns(val, fnRefs)
      }
      return result
    }
    return value
  }
}

const FN_REF = '__codplayFnRef__'
