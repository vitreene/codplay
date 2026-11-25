import { on, type Handle } from 'remix/component'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import type { rootSettingsState } from './decor-inspector-state'

type RootSettingsProps = Readonly<{
  state: ReturnType<typeof rootSettingsState>
  actions: EditorActionsFacade
}>

/** Root placement grid and zone visibility of the scene, shown in the scene panel. */
export function RootSettings(handle: Handle<RootSettingsProps>) {
  return () => {
    const { state, actions } = handle.props
    return <fieldset id="editor-root-settings" className="capsule-editor">
      <legend id="editor-root-settings-title">Placement racine</legend>
      <div id="editor-root-placement-modes" className="editor-menu-actions" aria-label="Type de grille racine">
        {state.modes.map((mode) => <button
          id={`editor-root-placement-${mode.value}`}
          key={mode.value}
          type="button"
          className="capsule-editor__control-button"
          title={mode.title}
          aria-pressed={mode.pressed}
          disabled={mode.disabled}
          mix={on('click', () => actions.setRootPlacementMode(mode.value))}
        >{mode.label}</button>)}
      </div>
      <button
        id="editor-toggle-zones"
        type="button"
        className="capsule-editor__control-button"
        aria-pressed={state.zones.pressed}
        disabled={state.zones.disabled}
        mix={on('click', () => actions.toggleZonesVisible())}
      >{state.zones.label}</button>
    </fieldset>
  }
}
