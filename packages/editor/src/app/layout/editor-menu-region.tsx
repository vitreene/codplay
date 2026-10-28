import { on, type Handle } from 'remix/component'
import button from '@remix-run/ui/button'
import { Option, Select } from '@remix-run/ui/select'
import { onSelectChange } from '@remix-run/ui/select/primitives'
import type { Actor } from 'xstate'
import type { EditorScene } from '../commands/types'
import type { controllerMachine } from '../controller/controller-machine'
import { rootPlacementModeForScene } from '../commands/root-placement-commands'
import { EditorActionsFacade } from '../facades/editor-actions-facade'
import type { DocumentHistoryState } from '../history/document-history'
import { createEmptyEditorScene } from '../scenes/editor-scene'
import type { EditorScenePersistence } from '../persistence/editor-scene-persistence'

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

/** Creates one test item with two authored keyframes and distinct decor values. */
function createLaneTestItem(
  controller: Actor<typeof controllerMachine>,
  actions: EditorActionsFacade,
  laneX: number,
  label: string,
  firstColor: string,
  secondColor: string,
  rotate: number,
): void {
  const scene = controller.getSnapshot().context.scene
  if (scene === null) return

  actions.runCommand({ name: 'createItem', args: { geometry: {} } })
  const items = controller.getSnapshot().context.scene?.items ?? []
  const itemId = items.at(-1)?.id
  if (itemId === undefined) return

  actions.runTransaction([
    { name: 'assignType', args: { itemId, type: 'text' } },
    { name: 'assignContent', args: { itemId, content: { type: 'text', text: label } } },
    { name: 'createKeyframe', args: { itemId, timeMs: 0 } },
    { name: 'createKeyframe', args: { itemId, timeMs: scene.meta.durationMs } },
  ])

  const createdItem = controller.getSnapshot().context.scene?.items.find((item) => item.id === itemId)
  const keyframes = createdItem?.keyframes.toSorted((left, right) => left.timeMs - right.timeMs)
  const [firstKeyframe, lastKeyframe] = keyframes ?? []
  if (firstKeyframe === undefined || lastKeyframe === undefined) return

  actions.runTransaction([
    {
      name: 'setDecor',
      args: {
        decorId: firstKeyframe.decorId,
        patch: { offset: { translate: { x: laneX, y: 15 }, width: 18, height: 18, rotate: 0 }, style: { 'background-color': firstColor } },
      },
    },
    {
      name: 'setDecor',
      args: {
        decorId: lastKeyframe.decorId,
        patch: { offset: { translate: { x: laneX, y: 50 }, width: 18, height: 18, rotate }, style: { 'background-color': secondColor } },
      },
    },
  ])
}

/** Creates the existing two-item position-and-color integration fixture. */
function createPositionColorTestScene(
  controller: Actor<typeof controllerMachine>,
  actions: EditorActionsFacade,
): void {
  actions.clearSelection()
  createLaneTestItem(controller, actions, 8, 'Item A', 'oklch(0.6 0.24 25)', 'oklch(0.6 0.24 260)', 15)
  createLaneTestItem(controller, actions, 54, 'Item B', 'oklch(0.6 0.24 145)', 'oklch(0.7 0.2 80)', -15)
  actions.clearSelection()
}

/** Renders scene selection, SQLite status, history controls, and editor fixtures. */
export function EditorMenuRegion(handle: Handle<EditorMenuRegionProps>) {
  const { controller, actions, persistence } = handle.props
  const buttonStyle = button({ size: 'md', tone: 'neutral' })

  return () => {
    const { scene, history } = handle.props
    const scenes = persistence.getScenes()
    const persistenceStatus = persistence.getStatus()
    const controllerSnapshot = controller.getSnapshot()
    const placementMode = scene === null ? null : rootPlacementModeForScene(scene)
    const rootZonesExist = scene !== null && Object.values(scene.zones).some((zone) => zone.capsuleId === null)
    const isCreatingBlock = controllerSnapshot.context.creatingType === 'bloc'
    const isCreating = controllerSnapshot.value === 'creating'
    const isPlaying = controllerSnapshot.value === 'playing'

    return <div id={handle.id} className="app-demo-content">
      <section id="editor-scene-menu" className="editor-menu-section">
        <h2 id="editor-menu-title">Éditeur</h2>
        <label id="editor-scene-picker-label" className="editor-menu-label">
          <span id="editor-scene-picker-caption">Scène</span>
          <Select
            id="editor-scene-picker"
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
        </label>
        <p id="editor-persistence-status" className={`editor-persistence-status editor-persistence-status--${persistenceStatus.kind}`} role="status">
          {persistenceStatus.message}
        </p>
        {persistenceStatus.ephemeralSourceCount > 0 && <p id="editor-ephemeral-media-status" role="note">
          Sources média temporaires : {persistenceStatus.ephemeralSourceCount}
        </p>}
      </section>

      <section id="editor-history-menu" className="editor-menu-section">
        <h3 id="editor-history-title">Historique</h3>
        <div id="editor-history-actions" className="editor-menu-actions">
          <button
            id="editor-undo"
            type="button"
            disabled={!history.canUndo}
            mix={[buttonStyle, on('click', () => actions.undo())]}
          >
            Annuler
          </button>
          <button
            id="editor-redo"
            type="button"
            disabled={!history.canRedo}
            mix={[buttonStyle, on('click', () => actions.redo())]}
          >
            Rétablir
          </button>
        </div>
        <p id="editor-history-shortcuts">Ctrl/Cmd+Z · Ctrl/Cmd+Shift+Z</p>
      </section>

      <section id="editor-scene-actions" className="editor-menu-section">
        <h3 id="editor-scene-actions-title">Scènes et éléments</h3>
        <button
          id="editor-create-scene"
          type="button"
          mix={[buttonStyle, on('click', () => actions.loadScene(createEmptyEditorScene()))]}
        >
          Créer une scène
        </button>
        <div id="editor-root-placement-modes" className="editor-menu-actions" aria-label="Mode de placement racine">
          <button
            id="editor-root-placement-transform"
            type="button"
            aria-pressed={placementMode === 'transform'}
            disabled={scene === null || isCreating || isPlaying || (rootZonesExist && placementMode !== 'transform')}
            mix={[buttonStyle, on('click', () => actions.runCommand({ name: 'setRootPlacementMode', args: { mode: 'transform' } }))]}
          >
            Racine 1 × 1 · transforms
          </button>
          <button
            id="editor-root-placement-grid"
            type="button"
            aria-pressed={placementMode === 'fine-grid'}
            disabled={scene === null || isCreating || isPlaying}
            mix={[buttonStyle, on('click', () => actions.runCommand({ name: 'setRootPlacementMode', args: { mode: 'fine-grid' } }))]}
          >
            Racine 160 × 90
          </button>
        </div>
        <button
          id="editor-create-block"
          type="button"
          disabled={scene === null || placementMode === null || isPlaying || isCreating}
          mix={[buttonStyle, on('click', () => {
            if (placementMode !== null) actions.beginBlockCreation(placementMode)
          })]}
        >
          Tracer un bloc
        </button>
        {isCreatingBlock && <button
          id="editor-cancel-block-creation"
          type="button"
          mix={[buttonStyle, on('click', () => actions.cancelCreation())]}
        >
          Annuler le tracé (Échap)
        </button>}
        <p id="editor-block-creation-hint">Choisir la grille racine, puis tracer le bloc sur la scène. Le bloc reste vide et peut recevoir un décor.</p>
        <button
          id="editor-create-item"
          type="button"
          disabled={scene === null}
          mix={[buttonStyle, on('click', () => {
            if (scene === null) return
            actions.runCommand({ name: 'createItem', args: { geometry: defaultItemGeometry } })
            const itemId = controller.getSnapshot().context.scene?.items.at(-1)?.id
            if (itemId === undefined) return
            const durationMs = controller.getSnapshot().context.scene?.meta.durationMs ?? scene.meta.durationMs
            actions.runTransaction([
              { name: 'assignType', args: { itemId, type: 'text' } },
              { name: 'assignContent', args: { itemId, content: { type: 'text', text: 'Nouvel item' } } },
              { name: 'createKeyframe', args: { itemId, timeMs: 0 } },
              { name: 'createKeyframe', args: { itemId, timeMs: durationMs } },
            ])
            actions.selectItem([itemId])
          })]}
        >
          Créer un item de test
        </button>
        <button
          id="editor-position-color-fixture"
          type="button"
          disabled={scene === null}
          mix={[buttonStyle, on('click', () => createPositionColorTestScene(controller, actions))]}
        >
          Test position + couleur
        </button>
      </section>
    </div>
  }
}
