import type { EditorScene } from '../commands/types'
import type { controllerMachine } from '../controller/controller-machine'
import type { Actor } from 'xstate'

const TEMP_EDITOR_SCENE_STORAGE_KEY = 'codplay.editor.temp-scenes.v1'
const TEMP_EDITOR_SCENE_VERSION = 1

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>

type StoredEditorScenes = Readonly<{
  version: 1
  activeSceneId: string | null
  scenes: Record<string, EditorScene>
}>

export type TempEditorScenePersistenceStatus = Readonly<{
  kind: 'ready' | 'warning' | 'error'
  message: string
  ephemeralSourceCount: number
}>

/** Temporarily persists the current EditorScene documents in versioned browser storage. */
export class TempEditorScenePersistence {
  private scenes: EditorScene[] = []
  private readonly getStorage: () => BrowserStorage
  private status: TempEditorScenePersistenceStatus = {
    kind: 'ready',
    message: 'Persistance locale provisoire prête.',
    ephemeralSourceCount: 0,
  }
  private readonly listeners = new Set<() => void>()
  private readonly stopSubscriptions: Array<() => void> = []

  constructor(getStorage: () => BrowserStorage) {
    this.getStorage = getStorage
  }

  /** Reads the stored collection and returns its last active scene when available. */
  open(): EditorScene | null {
    try {
      const stored = this.readCollection()
      this.scenes = Object.values(stored.scenes)
      const activeScene = stored.activeSceneId === null ? undefined : stored.scenes[stored.activeSceneId]
      const scene = activeScene ?? this.scenes[0] ?? null
      this.publish({
        kind: 'ready',
        message: scene === null ? 'Aucune scène locale enregistrée.' : 'Scène locale restaurée.',
        ephemeralSourceCount: scene === null ? 0 : countEphemeralMediaSources(scene),
      })
      return scene
    } catch (error) {
      this.publish({ kind: 'error', message: persistenceErrorMessage(error), ephemeralSourceCount: 0 })
      return null
    }
  }

  /** Returns a stable title-sorted view of the locally stored scenes. */
  getScenes(): readonly EditorScene[] {
    return [...this.scenes].sort((left, right) => left.meta.title.localeCompare(right.meta.title))
  }

  /** Returns the current persistence status for the app menu. */
  getStatus(): TempEditorScenePersistenceStatus {
    return this.status
  }

  /** Resolves a locally stored scene by its stable document ID. */
  getScene(sceneId: string): EditorScene | null {
    return this.scenes.find((scene) => scene.id === sceneId) ?? null
  }

  /** Attaches persistence to the central document load and commit events. */
  attach(controller: Actor<typeof controllerMachine>): void {
    let observedScene = controller.getSnapshot().context.scene
    /** Persists each document replacement once, including history restores without a document commit. */
    const persistIfChanged = (scene: EditorScene): void => {
      if (scene === observedScene) return
      observedScene = scene
      this.persist(scene)
    }
    const loaded = controller.on('sceneLoaded', ({ scene }) => {
      observedScene = scene
      this.persist(scene)
    })
    const committed = controller.on('documentCommitted', ({ afterScene }) => persistIfChanged(afterScene))
    const restored = controller.on('sceneCommitted', ({ scene }) => persistIfChanged(scene))
    this.stopSubscriptions.push(
      () => loaded.unsubscribe(),
      () => committed.unsubscribe(),
      () => restored.unsubscribe(),
    )
  }

  /** Notifies the menu when stored scene titles or persistence status change. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Releases controller subscriptions when the Remix app is removed. */
  destroy(): void {
    this.stopSubscriptions.splice(0).forEach((stop) => stop())
    this.listeners.clear()
  }

  /** Writes the full current model and makes its scene the collection's active document. */
  private persist(scene: EditorScene): void {
    try {
      const stored = this.readCollection()
      const next: StoredEditorScenes = {
        version: TEMP_EDITOR_SCENE_VERSION,
        activeSceneId: scene.id,
        scenes: { ...stored.scenes, [scene.id]: scene },
      }
      assertJsonCompatible(next)
      this.getStorage().setItem(TEMP_EDITOR_SCENE_STORAGE_KEY, JSON.stringify(next))
      this.scenes = Object.values(next.scenes)
      const ephemeralSourceCount = countEphemeralMediaSources(scene)
      this.publish(ephemeralSourceCount === 0
        ? { kind: 'ready', message: 'Modèle auteur sauvegardé localement.', ephemeralSourceCount }
        : {
            kind: 'warning',
            message: 'Le document est sauvegardé, mais ses URLs média temporaires ne survivront pas au rechargement.',
            ephemeralSourceCount,
          })
    } catch (error) {
      this.publish({ kind: 'error', message: persistenceErrorMessage(error), ephemeralSourceCount: countEphemeralMediaSources(scene) })
    }
  }

  /** Reads and validates the temporary versioned collection at the storage boundary. */
  private readCollection(): StoredEditorScenes {
    const source = this.getStorage().getItem(TEMP_EDITOR_SCENE_STORAGE_KEY)
    if (source === null) return { version: TEMP_EDITOR_SCENE_VERSION, activeSceneId: null, scenes: {} }

    const value: unknown = JSON.parse(source)
    if (!isRecord(value) || value.version !== TEMP_EDITOR_SCENE_VERSION
      || !(value.activeSceneId === null || typeof value.activeSceneId === 'string')
      || !isRecord(value.scenes)) {
      throw new Error('Le format de persistance temporaire est invalide ou incompatible.')
    }

    const scenes = Object.fromEntries(Object.entries(value.scenes).map(([sceneId, scene]) => {
      if (!isEditorScene(scene) || scene.id !== sceneId) {
        throw new Error(`La scène locale « ${sceneId} » ne correspond pas au modèle EditorScene actuel.`)
      }
      return [sceneId, scene]
    }))
    if (value.activeSceneId !== null && scenes[value.activeSceneId] === undefined) {
      throw new Error('La scène locale active est absente de la collection.')
    }

    return { version: TEMP_EDITOR_SCENE_VERSION, activeSceneId: value.activeSceneId, scenes }
  }

  /** Updates the persistence status and publishes it to live Remix views. */
  private publish(status: TempEditorScenePersistenceStatus): void {
    this.status = status
    for (const listener of this.listeners) listener()
  }
}

/** Validates the stable document envelope while preserving every nested model property. */
function isEditorScene(value: unknown): value is EditorScene {
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.meta)) return false
  if (typeof value.meta.title !== 'string' || !Number.isFinite(value.meta.durationMs)) return false
  if (!['arbitrary', 'audio-primary', 'mixed'].includes(String(value.meta.durationSource))) return false
  if (value.meta.timeUnit !== 's' && value.meta.timeUnit !== 'ms') return false
  if (value.meta.capsuleOrder !== 'forward' && value.meta.capsuleOrder !== 'backward') return false
  return Array.isArray(value.items)
    && isRecord(value.contents)
    && isRecord(value.decors)
    && isRecord(value.zones)
    && isRecord(value.markerTracks)
}

/** Accepts plain object records at the untrusted storage boundary. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Rejects values that JSON storage would silently omit, coerce, or corrupt. */
function assertJsonCompatible(value: unknown): void {
  const ancestors = new WeakMap<object, string>()

  function visit(candidate: unknown, path: string): void {
    if (candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean') return
    if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate)) throw new Error(`La valeur numérique du document n’est pas sérialisable à ${path}.`)
      return
    }
    if (typeof candidate !== 'object') {
      throw new Error(`Le document contient une valeur non sérialisable en JSON à ${path} (${typeof candidate}).`)
    }
    const ancestorPath = ancestors.get(candidate)
    if (ancestorPath !== undefined) {
      throw new Error(`Le document contient une référence circulaire à ${path}, vers ${ancestorPath}.`)
    }
    const prototype = Object.getPrototypeOf(candidate)
    if (prototype !== Object.prototype && prototype !== null && !Array.isArray(candidate)) {
      throw new Error(`Le document contient un objet non compatible avec la persistance JSON provisoire à ${path}.`)
    }

    ancestors.set(candidate, path)
    for (const key of Reflect.ownKeys(candidate)) {
      if (typeof key !== 'string') throw new Error(`Le document contient une clé non sérialisable en JSON à ${path}.`)
      const childPath = Array.isArray(candidate)
        ? `${path}[${key}]`
        : `${path}[${JSON.stringify(key)}]`
      visit((candidate as Record<string, unknown>)[key], childPath)
    }
    ancestors.delete(candidate)
  }

  visit(value, '$')
}

/** Counts object URLs stored in media content; the strings are kept, but their blobs are not. */
function countEphemeralMediaSources(scene: EditorScene): number {
  return Object.values(scene.contents).filter((content) => content.source?.startsWith('blob:') ?? false).length
}

/** Converts browser storage and serialization errors into a concise app status. */
function persistenceErrorMessage(error: unknown): string {
  const reason = error instanceof Error ? error.message : 'erreur inconnue'
  return `La persistance locale provisoire a échoué : ${reason}`
}
