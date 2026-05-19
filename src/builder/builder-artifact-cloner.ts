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
      resources: this.cloneResourceManifest(compiledScene.resources)
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
        tracks: this.cloneData(story.tracks),
        entries: this.cloneData(story.entries),
        initial: this.cloneData(story.initial),
        persos: this.cloneData(story.persos),
        straps: this.cloneData(story.straps),
        listen: this.cloneData(story.listen),
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
      listen: this.cloneData(scene.listen),
      state: this.cloneData(scene.state),
      init: scene.init,
      onStart: scene.onStart,
      onSequenceEnd: scene.onSequenceEnd,
      tracks: this.cloneData(scene.tracks)
    }
  }

  /**
   * Clones one data payload without mutating the caller-owned structure.
   */
  private cloneData<T>(value: T): T {
    if (value === undefined) {
      return value
    }

    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(value)
    }

    return JSON.parse(JSON.stringify(value)) as T
  }
}
