import { on, type Handle } from 'remix/component'
import button from '@remix-run/ui/button'
import { Option, Select } from '@remix-run/ui/select'
import { onSelectChange } from '@remix-run/ui/select/primitives'
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
}>

const defaultItemGeometry = {
  translate: { x: 20, y: 18 },
  width: 60,
  height: 18,
}

/** Creates an item in the selected zone through the existing command and history paths. */
function createItemInZone(
  controller: Actor<typeof controllerMachine>,
  actions: EditorActionsFacade,
  zoneId: string,
  type: 'bloc' | 'text',
): void {
  const beforeItemIds = new Set((controller.getSnapshot().context.scene?.items ?? []).map((item) => item.id))
  actions.runCommand({ name: 'createItem', args: { geometry: {}, zoneId } })
  const itemId = controller.getSnapshot().context.scene?.items.find((item) => !beforeItemIds.has(item.id))?.id
  if (itemId === undefined) return
  if (type === 'text') {
    actions.runTransaction([
      { name: 'assignType', args: { itemId, type } },
      { name: 'assignContent', args: { itemId, content: { type, text: 'Nouveau texte' } } },
    ])
  }
  actions.selectItem([itemId])
}

/** Renders the compact authoring actions without the removed integration fixtures. */
export function EditorMenuRegion(handle: Handle<EditorMenuRegionProps>) {
  const { controller, actions, persistence } = handle.props
  const buttonStyle = button({ size: 'md', tone: 'neutral' })

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
      && (placementMode === 'transform' || selectedRootZone !== undefined)
    const createItemDisabledReason = scene === null
      ? 'Charger une scène pour créer'
      : placementMode === null
        ? 'Définir la grille racine pour créer'
        : isPlaying
          ? 'Arrêter la lecture pour créer'
          : isCreating
            ? 'Terminer ou annuler la création en cours'
            : placementMode === 'fine-grid' && selectedRootZone === undefined
              ? 'Sélectionner une zone racine pour créer'
              : null
    const canDeleteScene = scene !== null
      && scenes.some((savedScene) => savedScene.id === scene.id)
      && scenes.length > 1
      && !persistence.isDeletingScene(scene.id)
      && persistenceStatus.kind !== 'error'

    const createItem = (type: 'bloc' | 'text'): void => {
      if (scene === null || placementMode === null || isPlaying || isCreating) return
      if (placementMode === 'fine-grid') {
        if (selectedRootZone !== undefined) createItemInZone(controller, actions, selectedRootZone.id, type)
        return
      }
      if (type === 'bloc') {
        actions.beginBlockCreation(placementMode)
        return
      }

      const beforeItemIds = new Set(controller.getSnapshot().context.scene?.items.map((item) => item.id) ?? [])
      actions.runCommand({ name: 'createItem', args: { geometry: defaultItemGeometry } })
      const itemId = controller.getSnapshot().context.scene?.items.find((item) => !beforeItemIds.has(item.id))?.id
      if (itemId === undefined) return
      actions.runTransaction([
        { name: 'assignType', args: { itemId, type } },
        { name: 'assignContent', args: { itemId, content: { type, text: 'Nouveau texte' } } },
      ])
      actions.selectItem([itemId])
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
          <Select
            id="editor-scene-picker"
            aria-label="Choisir une scène"
            key={`${scene?.id ?? 'none'}:${scenes.length}`}
            defaultLabel={scene?.meta.title ?? 'Aucune scène'}
            defaultValue={scene?.id ?? null}
            disabled={scenes.length === 0}
            mix={[
              buttonStyle,
              onSelectChange((event) => {
                if (event.value === null) return
                void persistence.loadScene(event.value).then((selected) => {
                  if (selected !== null) actions.loadScene(selected)
                })
              }),
            ]}
          >
            {scenes.map((savedScene) => <Option
              id={`editor-scene-option-${savedScene.id}`}
              key={savedScene.id}
              label={savedScene.title}
              value={savedScene.id}
            >
              {savedScene.title}
            </Option>)}
          </Select>
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
              mix={[buttonStyle, on('click', () => actions.loadScene(createEmptyEditorScene()))]}
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
              mix={[buttonStyle, on('click', deleteScene)]}
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
            mix={[buttonStyle, on('click', () => actions.undo())]}
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
            mix={[buttonStyle, on('click', () => actions.redo())]}
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
            mix={[buttonStyle, on('click', () => createItem('bloc'))]}
          >
            <svg id="editor-create-block-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>
          <button
            id="editor-create-text"
            type="button"
            aria-label="Créer un texte"
            title={createItemDisabledReason ?? 'Créer un texte'}
            disabled={!canCreate}
            mix={[buttonStyle, on('click', () => createItem('text'))]}
          >
            <svg id="editor-create-text-icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 5h16M8 5v14m-3 0h6M14 11h6M14 15h6M14 19h6" />
            </svg>
          </button>
        </div>
      </fieldset>
    </div>
  }
}
