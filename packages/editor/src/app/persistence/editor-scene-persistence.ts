import type { EditorScene } from '../commands/types'
import type { controllerMachine } from '../controller/controller-machine'
import type { Actor } from 'xstate'
import type { DeleteEditorSceneResult, EditorSceneSummary, SaveEditorSceneResult, StoredEditorScene } from './editor-scene-persistence-types'
import { stringifyJson } from './json-serialization'

type SceneCatalogue = Readonly<{
  scenes: EditorSceneSummary[]
  activeSceneId: string | null
}>

export type EditorScenePersistenceStatus = Readonly<{
  kind: 'ready' | 'warning' | 'error'
  message: string
  ephemeralSourceCount: number
}>

/** Persists EditorScene snapshots through the local SQLite API at existing commit boundaries. */
export class EditorScenePersistence {
  private scenes: EditorSceneSummary[] = []
  private activeSceneId: string | null = null
  private readonly sceneCache = new Map<string, EditorScene>()
  private readonly revisions = new Map<string, number>()
  private readonly pendingSnapshots = new Map<string, EditorScene>()
  private readonly writeQueues = new Map<string, Promise<void>>()
  private status: EditorScenePersistenceStatus = {
    kind: 'ready',
    message: 'Connexion à la base SQLite locale…',
    ephemeralSourceCount: 0,
  }
  private readonly listeners = new Set<() => void>()
  private readonly stopSubscriptions: Array<() => void> = []
  private deletingSceneId: string | null = null

  /** Loads the active scene from the local API and caches its revision. */
  async open(): Promise<EditorScene | null> {
    try {
      const response = await fetch('/api/scenes')
      const catalogue = await responseValue<SceneCatalogue>(response)
      this.scenes = catalogue.scenes
      this.activeSceneId = catalogue.activeSceneId
      for (const scene of catalogue.scenes) this.revisions.set(scene.id, scene.revision)

      const chosenSceneId = catalogue.activeSceneId !== null
        && catalogue.scenes.some((scene) => scene.id === catalogue.activeSceneId)
        ? catalogue.activeSceneId
        : catalogue.scenes[0]?.id ?? null
      if (chosenSceneId === null) {
        this.publish({ kind: 'ready', message: 'Aucune scène SQLite enregistrée.', ephemeralSourceCount: 0 })
        return null
      }

      const scene = await this.loadScene(chosenSceneId)
      if (scene === null) return null
      if (catalogue.activeSceneId !== chosenSceneId) await this.activateStoredScene(chosenSceneId)
      this.publishSceneStatus(scene, 'Scène SQLite restaurée.')
      return scene
    } catch (error) {
      this.publish({ kind: 'error', message: persistenceErrorMessage(error), ephemeralSourceCount: 0 })
      return null
    }
  }

  /** Returns scene titles in a stable alphabetical order for the scene selector. */
  getScenes(): readonly EditorSceneSummary[] {
    return [...this.scenes].sort((left, right) => left.title.localeCompare(right.title))
  }

  /** Returns the current local database connection and save status. */
  getStatus(): EditorScenePersistenceStatus {
    return this.status
  }

  /** Reports whether a scene deletion is currently in flight. */
  isDeletingScene(sceneId: string): boolean {
    return this.deletingSceneId === sceneId
  }

  /** Loads a scene on demand, reusing its cached author document when possible. */
  async loadScene(sceneId: string): Promise<EditorScene | null> {
    const cached = this.sceneCache.get(sceneId)
    if (cached !== undefined) return cached
    try {
      const response = await fetch(`/api/scenes/${encodeURIComponent(sceneId)}`)
      const stored = await responseValue<StoredEditorScene>(response)
      this.revisions.set(sceneId, stored.revision)
      this.cacheScene(stored.scene, stored.revision)
      return stored.scene
    } catch (error) {
      this.publish({ kind: 'error', message: persistenceErrorMessage(error), ephemeralSourceCount: 0 })
      return null
    }
  }

  /** Flushes the current document, deletes its matching SQLite revision, and returns the replacement scene. */
  async deleteScene(sceneId: string): Promise<EditorScene | null> {
    if (this.deletingSceneId !== null || this.scenes.length <= 1 || this.status.kind === 'error') return null
    this.deletingSceneId = sceneId
    this.publish({ kind: 'ready', message: 'Suppression de la scène…', ephemeralSourceCount: 0 })
    try {
      await this.flush()
      if (this.getStatus().kind === 'error') {
        throw new Error('La scène ne peut pas être supprimée car des modifications ne sont pas enregistrées.')
      }
      const expectedRevision = this.revisions.get(sceneId)
      if (expectedRevision === undefined) throw new Error('La révision de la scène est inconnue ; recharge-la avant de la supprimer.')

      const response = await fetch(`/api/scenes/${encodeURIComponent(sceneId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: stringifyJson({ expectedRevision }),
      })
      const result = await responseValue<DeleteEditorSceneResult>(response)
      if (result.kind !== 'deleted') throw new Error('La scène n’a pas été supprimée.')

      const { scene, revision } = result.activeScene
      this.scenes = this.scenes.filter((candidate) => candidate.id !== sceneId)
      this.sceneCache.delete(sceneId)
      this.revisions.delete(sceneId)
      this.activeSceneId = scene.id
      this.cacheScene(scene, revision)
      this.deletingSceneId = null
      this.publishSceneStatus(scene, 'Scène supprimée.')
      return scene
    } catch (error) {
      this.deletingSceneId = null
      this.publish({ kind: 'error', message: persistenceErrorMessage(error), ephemeralSourceCount: 0 })
      return null
    }
  }

  /** Attaches the SQLite writer to the central scene load and document commit events. */
  attach(controller: Actor<typeof controllerMachine>): void {
    let observedScene = controller.getSnapshot().context.scene
    /** Writes a document replacement once, including history restores without a normal commit. */
    const persistIfChanged = (scene: EditorScene): void => {
      if (scene === observedScene) return
      observedScene = scene
      void this.persist(scene)
    }
    const loaded = controller.on('sceneLoaded', ({ scene }) => {
      observedScene = scene
      void this.activate(scene)
    })
    const committed = controller.on('documentCommitted', ({ afterScene }) => persistIfChanged(afterScene))
    const restored = controller.on('sceneCommitted', ({ scene }) => persistIfChanged(scene))
    this.stopSubscriptions.push(
      () => loaded.unsubscribe(),
      () => committed.unsubscribe(),
      () => restored.unsubscribe(),
    )
  }

  /** Notifies Remix views when the scene list or persistence status changes. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Waits until every scene's latest queued snapshot has reached SQLite. */
  async flush(): Promise<void> {
    while (this.pendingSnapshots.size > 0 || this.writeQueues.size > 0) {
      for (const sceneId of this.pendingSnapshots.keys()) this.startSceneWrites(sceneId)
      await Promise.all(this.writeQueues.values())
    }
  }

  /** Releases controller subscriptions when the Remix application is removed. */
  destroy(): void {
    this.stopSubscriptions.splice(0).forEach((stop) => stop())
    this.listeners.clear()
  }

  /** Keeps only the newest pending document snapshot and serializes writes per scene. */
  private persist(scene: EditorScene): Promise<void> {
    this.publish({
      kind: 'ready',
      message: 'Enregistrement dans SQLite…',
      ephemeralSourceCount: countEphemeralMediaSources(scene),
    })
    this.pendingSnapshots.set(scene.id, scene)
    return this.startSceneWrites(scene.id)
  }

  /** Starts one writer per scene; changes during an HTTP write replace its pending snapshot. */
  private startSceneWrites(sceneId: string): Promise<void> {
    const running = this.writeQueues.get(sceneId)
    if (running !== undefined) return running

    const queued = this.writePendingSnapshots(sceneId)
    this.writeQueues.set(sceneId, queued)
    void queued.then(() => {
      if (this.writeQueues.get(sceneId) !== queued) return
      this.writeQueues.delete(sceneId)
      if (this.pendingSnapshots.has(sceneId)) this.startSceneWrites(sceneId)
    })
    return queued
  }

  /** Saves pending snapshots in revision order, skipping superseded snapshots not yet sent. */
  private async writePendingSnapshots(sceneId: string): Promise<void> {
    while (this.pendingSnapshots.has(sceneId)) {
      const scene = this.pendingSnapshots.get(sceneId)
      if (scene === undefined) return
      this.pendingSnapshots.delete(sceneId)
      try {
        await this.saveSnapshot(scene)
      } catch (error) {
        this.publish({
          kind: 'error',
          message: persistenceErrorMessage(error),
          ephemeralSourceCount: countEphemeralMediaSources(scene),
        })
      }
    }
  }

  /** Writes one scene revision and refreshes its catalogue entry. */
  private async saveSnapshot(scene: EditorScene): Promise<void> {
    const response = await fetch(`/api/scenes/${encodeURIComponent(scene.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: stringifyJson({ scene, expectedRevision: this.revisions.get(scene.id) ?? null }),
    })
    const result = await responseValue<SaveEditorSceneResult>(response)
    if (result.kind === 'conflict') throw new Error('La scène a une révision plus récente en base. Recharge-la avant de poursuivre.')
    this.cacheScene(scene, result.revision)
    this.activeSceneId = scene.id
    if (this.pendingSnapshots.has(scene.id)) return
    this.publishSceneStatus(scene, countEphemeralMediaSources(scene) === 0
      ? 'Modèle auteur sauvegardé dans SQLite.'
      : 'La scène est sauvegardée, mais ses URLs blob: ne survivront pas au rechargement.')
  }

  /** Selects a loaded document as active, creating a new scene row when it has no revision yet. */
  private async activate(scene: EditorScene): Promise<void> {
    try {
      if (!this.revisions.has(scene.id)) {
        await this.persist(scene)
        return
      }
      if (this.activeSceneId === scene.id) return
      await this.activateStoredScene(scene.id)
    } catch (error) {
      this.publish({ kind: 'error', message: persistenceErrorMessage(error), ephemeralSourceCount: countEphemeralMediaSources(scene) })
    }
  }

  /** Stores the active scene id through the API. */
  private async activateStoredScene(sceneId: string): Promise<void> {
    const response = await fetch('/api/active-scene', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: stringifyJson({ sceneId }),
    })
    await responseValue<void>(response)
    this.activeSceneId = sceneId
  }

  /** Updates the local scene list, revision cache, and document cache after a successful write. */
  private cacheScene(scene: EditorScene, revision: number): void {
    this.sceneCache.set(scene.id, scene)
    this.revisions.set(scene.id, revision)
    const summary = { id: scene.id, title: scene.meta.title, revision }
    this.scenes = [...this.scenes.filter((candidate) => candidate.id !== scene.id), summary]
  }

  /** Publishes a status message together with the current source-URL limitation. */
  private publishSceneStatus(scene: EditorScene, message: string): void {
    const ephemeralSourceCount = countEphemeralMediaSources(scene)
    this.publish(ephemeralSourceCount === 0
      ? { kind: 'ready', message, ephemeralSourceCount }
      : {
          kind: 'warning',
          message: 'La scène est sauvegardée, mais ses URLs blob: ne survivront pas au rechargement.',
          ephemeralSourceCount,
        })
  }

  /** Updates persistence state and requests a Remix render. */
  private publish(status: EditorScenePersistenceStatus): void {
    this.status = status
    for (const listener of this.listeners) listener()
  }
}

/** Parses a local API response and surfaces its JSON error message. */
async function responseValue<Value>(response: Response): Promise<Value> {
  if (response.status === 204) return undefined as Value
  const body: unknown = await response.json()
  if (!response.ok) {
    const message = isRecord(body) && typeof body.error === 'string' ? body.error : `Erreur API (${response.status}).`
    throw new Error(message)
  }
  return body as Value
}

/** Counts media blob URLs whose underlying bytes do not survive a browser reload. */
function countEphemeralMediaSources(scene: EditorScene): number {
  return Object.values(scene.contents)
    .filter((content) => content.mediaId === undefined && (content.source?.startsWith('blob:') ?? false))
    .length
}

/** Converts fetch and SQL errors into a concise app status. */
function persistenceErrorMessage(error: unknown): string {
  const reason = error instanceof Error ? error.message : 'erreur inconnue'
  return `La persistance SQLite locale a échoué : ${reason}`
}

/** Narrows response bodies to plain records. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
