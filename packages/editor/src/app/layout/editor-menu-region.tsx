import { on, type Handle } from 'remix/component'
import type { Actor } from 'xstate'
import type { EditorScene } from '../commands/types'
import type { controllerMachine } from '../controller/controller-machine'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'
import type { DocumentHistoryState } from '../history/document-history'
import { createEmptyEditorScene } from '../scenes/editor-scene'
import type { EditorScenePersistence } from '../persistence/editor-scene-persistence'
import { rootPlacementModeForScene } from '../commands/root-placement-commands'

type EditorMenuRegionProps = Readonly<{
  controller: Actor<typeof controllerMachine>
  actions: EditorActionsFacade
  persistence: EditorScenePersistence
  scene: EditorScene | null
  history: DocumentHistoryState
  /** Reads the author playhead, where a new item is born. */
  getAuthorTimeMs: () => number
}>

const defaultItemGeometry = {
  translate: { x: 20, y: 18 },
  width: 60,
  height: 18,
}


/** Renders the compact authoring actions without the removed integration fixtures. */
export function EditorMenuRegion(handle: Handle<EditorMenuRegionProps>) {
  const { controller, actions, persistence, getAuthorTimeMs } = handle.props
  let switchingScene = false

  /** Serializes catalogue changes through the existing document and persistence owners. */
  const selectScene = (sceneId: string): void => {
    if (switchingScene || sceneId.length === 0) return
    switchingScene = true
    void handle.update()
    void actions.selectScene(sceneId, persistence).finally(() => {
      switchingScene = false
      void handle.update()
    })
  }

  return () => {
    const { scene, history } = handle.props
    const scenes = persistence.getScenes()
    const persistenceStatus = persistence.getStatus()
    const controllerSnapshot = controller.getSnapshot()
    const placementMode = scene === null ? null : rootPlacementModeForScene(scene)
    const selectedZone = scene === null || controllerSnapshot.context.selectedZoneId === null
      ? undefined
      : scene.zones[controllerSnapshot.context.selectedZoneId]
    const selectedRootZone = selectedZone?.capsuleId === null ? selectedZone : undefined
    const isCreating = controllerSnapshot.value === 'creating'
    const isPlaying = controllerSnapshot.value === 'playing'
    const canCreate = scene !== null
      && placementMode !== null
      && !isPlaying
      && !isCreating
    const canCreateText = canCreate && (placementMode === 'transform' || selectedRootZone !== undefined)
    const createItemDisabledReason = scene === null
      ? 'Charger une scène pour créer'
      : placementMode === null
        ? 'Définir la grille racine pour créer'
        : isPlaying
          ? 'Arrêter la lecture pour créer'
          : isCreating
            ? 'Terminer ou annuler la création en cours'
          : null
    const createTextDisabledReason = createItemDisabledReason
      ?? (placementMode === 'fine-grid' && selectedRootZone === undefined
        ? 'Sélectionner une zone racine pour créer un texte'
        : null)
    const canDeleteScene = scene !== null
      && !switchingScene
      && scenes.some((savedScene) => savedScene.id === scene.id)
      && scenes.length > 1
      && !persistence.isDeletingScene(scene.id)
      && persistenceStatus.kind !== 'error'

    const createItem = (type: 'bloc' | 'text'): void => {
      if (scene === null || placementMode === null || isPlaying || isCreating) return
      if (type === 'bloc') {
        actions.beginItemCreation('bloc', placementMode)
        return
      }
      if (placementMode === 'fine-grid') {
        if (selectedRootZone !== undefined) actions.createItem({ type, geometry: {}, introTimeMs: getAuthorTimeMs(), zoneId: selectedRootZone.id })
        return
      }
      actions.createItem({ type, geometry: defaultItemGeometry, introTimeMs: getAuthorTimeMs() })
    }

    const createCapsule = (): void => {
      if (scene === null || placementMode === null || isPlaying || isCreating) return
      actions.beginItemCreation('capsule', placementMode)
    }

    const deleteScene = (): void => {
      if (!canDeleteScene || scene === null) return
      void persistence.deleteScene(scene.id).then((replacement) => {
        if (replacement !== null) actions.loadScene(replacement)
      })
    }

    return <div id={handle.id} className="app-demo-content">
      <fieldset id="editor-scene-menu" className="editor-menu-group">
        <legend id="editor-scene-legend">Scène</legend>
        <div id="editor-scene-controls" className="editor-menu-section">
          <select
            id="editor-scene-picker"
            aria-label="Choisir une scène"
            className="editor-menu-select"
            value={scene?.id ?? ''}
            disabled={scenes.length === 0 || switchingScene || (scene !== null && persistence.isDeletingScene(scene.id))}
            mix={on('change', (event) => selectScene(event.currentTarget.value))}
          >
            <option id="editor-scene-option-none" value="" disabled selected={scene === null}>Aucune scène</option>
            {scenes.map((savedScene) => <option
              id={`editor-scene-option-${savedScene.id}`}
              key={savedScene.id}
              value={savedScene.id}
              selected={savedScene.id === scene?.id}
            >{savedScene.title}</option>)}
          </select>
          <p id="editor-persistence-status" className={`editor-persistence-status editor-persistence-status--${persistenceStatus.kind}`} role="status">
            {persistenceStatus.message}
          </p>
          {persistenceStatus.ephemeralSourceCount > 0 && <p id="editor-ephemeral-media-status" role="note">
            Sources média temporaires : {persistenceStatus.ephemeralSourceCount}
          </p>}
          <div id="editor-scene-actions" className="editor-menu-actions" aria-label="Scènes">
            <button
              id="editor-create-scene"
              type="button"
              aria-label="Créer une scène"
              title="Créer une scène"
              className="editor-menu-button"
              disabled={switchingScene}
              mix={on('click', () => actions.loadScene(createEmptyEditorScene()))}
            >
              <svg id="editor-create-scene-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              id="editor-delete-scene"
              type="button"
              aria-label="Supprimer la scène"
              title="Supprimer la scène"
              disabled={!canDeleteScene}
              className="editor-menu-button"
              mix={on('click', deleteScene)}
            >
              <svg id="editor-delete-scene-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
              </svg>
            </button>
          </div>
        </div>
      </fieldset>

      <fieldset id="editor-history-menu" className="editor-menu-group">
        <legend id="editor-history-legend">Application</legend>
        <div id="editor-history-actions" className="editor-menu-actions" aria-label="Historique">
          <button
            id="editor-undo"
            type="button"
            aria-label="Annuler"
            title="Annuler"
            disabled={!history.canUndo}
            className="editor-menu-button"
            mix={on('click', () => actions.undo())}
          >
            <svg id="editor-undo-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
          </button>
          <button
            id="editor-redo"
            type="button"
            aria-label="Rétablir"
            title="Rétablir"
            disabled={!history.canRedo}
            className="editor-menu-button"
            mix={on('click', () => actions.redo())}
          >
            <svg id="editor-redo-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
            </svg>
          </button>
        </div>
      </fieldset>

      <fieldset id="editor-item-creation" className="editor-menu-group">
        <legend id="editor-item-creation-legend">Bloc</legend>
        <div id="editor-item-actions" className="editor-menu-actions" aria-label="Créer un élément">
          <button
            id="editor-create-block"
            type="button"
            aria-label="Créer un bloc"
            title={createItemDisabledReason ?? 'Créer un bloc'}
            disabled={!canCreate}
            className="editor-menu-button"
            mix={on('click', () => createItem('bloc'))}
          >
            <svg id="editor-create-block-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>
          <button
            id="editor-create-text"
            type="button"
            aria-label="Créer un texte"
            title={createTextDisabledReason ?? 'Créer un texte'}
            disabled={!canCreateText}
            className="editor-menu-button"
            mix={on('click', () => createItem('text'))}
          >
            <svg id="editor-create-text-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 5h16M8 5v14m-3 0h6M14 11h6M14 15h6M14 19h6" />
            </svg>
          </button>
        </div>
      </fieldset>

      <fieldset id="editor-capsule-creation" className="editor-menu-group">
        <legend id="editor-capsule-creation-legend">Capsule</legend>
        <div id="editor-capsule-actions" className="editor-menu-actions" aria-label="Créer une capsule">
          <button
            id="editor-create-capsule"
            type="button"
            aria-label="Créer une capsule"
            title={createItemDisabledReason ?? 'Tracer une capsule'}
            disabled={!canCreate}
            className="editor-menu-button"
            mix={on('click', createCapsule)}
          >
            <svg id="editor-create-capsule-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <rect x="7" y="7" width="10" height="10" rx="1" />
            </svg>
          </button>
        </div>
      </fieldset>
    </div>
  }
}
