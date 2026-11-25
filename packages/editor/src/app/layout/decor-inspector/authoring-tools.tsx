import { on, unsafeHTML, type Handle } from 'remix/component'
import { iconSvg, type IconName } from '../../../decor-editor/icons'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import type { authoringToolsState } from './decor-inspector-state'

type AuthoringToolsProps = Readonly<{
  state: ReturnType<typeof authoringToolsState>
  actions: EditorActionsFacade
}>

type ToolButtonProps = Readonly<{
  id: string
  label: string
  icon: IconName
  pressed: boolean
  disabled: boolean
  onPress: () => void
}>

/** One accessible, icon-only toolbar action. */
function ToolButton(handle: Handle<ToolButtonProps>) {
  return () => {
    const { id, label, icon, pressed, disabled, onPress } = handle.props
    return <button
      id={id}
      type="button"
      className="capsule-editor__control-button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      innerHTML={unsafeHTML(iconSvg(icon))}
      mix={on('click', onPress)}
    />
  }
}

/** Zone/Block authoring toolbar shown above the inspector panels. */
export function AuthoringTools(handle: Handle<AuthoringToolsProps>) {
  return () => {
    const { state, actions } = handle.props
    return <div
      id="editor-authoring-tools"
      className="editor-menu-actions editor-authoring-tools"
      role="group"
      aria-label="Outils d’édition"
      hidden={!state.visible}
    >
      <ToolButton id="editor-authoring-zone" label="Mode Zone" icon="grid" pressed={state.mode === 'zone'}
        disabled={state.disabled} onPress={() => actions.setAuthoringMode('zone')} />
      <ToolButton id="editor-authoring-block" label="Mode Bloc" icon="square" pressed={state.mode === 'block'}
        disabled={state.disabled} onPress={() => actions.setAuthoringMode('block')} />
      {state.offsetTool !== null && <ToolButton id="editor-block-offset" label="Décalage" icon="offset"
        pressed={state.offsetTool.pressed} disabled={state.disabled} onPress={() => actions.toggleOffsetGesture()} />}
      {state.zonesHiddenInBlockMode !== null && <ToolButton
        id="editor-block-toggle-zone-visibility"
        label={state.zonesHiddenInBlockMode ? 'Afficher les zones' : 'Masquer les zones'}
        icon="eye-off"
        pressed={state.zonesHiddenInBlockMode}
        disabled={state.disabled}
        onPress={() => actions.toggleZonesInBlockMode()}
      />}
    </div>
  }
}
