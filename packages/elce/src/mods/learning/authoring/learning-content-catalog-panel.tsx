import { on, type RemixNode } from 'remix/component'

import { renderProfileTokenInsertion } from '../profile/authoring/profile-token-insertion'
import type { LearningContentCatalogPanelProps } from './learning-content-catalog-panel-types'
import { renderAppearancePanel } from './learning-appearance-panel'
import { renderWorkspacePanelReduceButton } from './workspace-panel-controls'
import { renderLearningClipboardPanel } from './learning-clipboard-panel'

/** Renders the right-side Presse-papiers, Variables and Style panels. */
export function renderLearningContentCatalogPanel(props: LearningContentCatalogPanelProps): RemixNode {
  const { view, actions, profileTokenTargetId } = props
  const panelOpen = props.panelOpen ?? true
  const selectedInlineLabel = props.selectedInlineLabel
  const linkablePageIds = new Set(view.documentModel.scenarioPageIds)
  const linkablePages = view.documentModel.pages.filter((page) => linkablePageIds.has(page.id))

  return <aside
    id="elce-properties"
    className="elce-panel elce-properties"
    data-panel-open={panelOpen}
    aria-labelledby={rightPanelLabelId(props.sidePanelTab)}
  >
    <div
      id="elce-properties-reduce-row"
      className="elce-panel-reduce-row"
    >
      {renderWorkspacePanelReduceButton('properties', () => {
        if (props.onSetPanelVisibility !== undefined) props.onSetPanelVisibility('properties', false)
        else props.onSetResponsivePanel(null, 'elce-properties-toggle')
      })}
    </div>
    <div
      id="elce-properties-topbar"
      className="elce-properties-topbar"
    >
      <div
        id="elce-side-panel-tabs"
        className="elce-side-panel-tabs"
        role="tablist"
        aria-label="Panneau latéral"
      >
        <button
          id="elce-side-panel-tab-clipboard"
          className={props.sidePanelTab === 'clipboard' ? 'elce-side-panel-tab elce-side-panel-tab--active' : 'elce-side-panel-tab'}
          type="button"
          role="tab"
          aria-selected={props.sidePanelTab === 'clipboard'}
          aria-controls="elce-clipboard-tabpanel"
          mix={on<HTMLButtonElement, 'click'>('click', () => props.onSetSidePanelTab('clipboard'))}
        >
          Presse-papiers
        </button>
        <button
          id="elce-side-panel-tab-variables"
          className={props.sidePanelTab === 'variables' ? 'elce-side-panel-tab elce-side-panel-tab--active' : 'elce-side-panel-tab'}
          type="button"
          role="tab"
          aria-selected={props.sidePanelTab === 'variables'}
          aria-controls="elce-variables-tabpanel"
          mix={on<HTMLButtonElement, 'click'>('click', () => props.onSetSidePanelTab('variables'))}
        >
          Variables
        </button>
        <button
          id="elce-side-panel-tab-style"
          className={props.sidePanelTab === 'style' ? 'elce-side-panel-tab elce-side-panel-tab--active' : 'elce-side-panel-tab'}
          type="button"
          role="tab"
          aria-selected={props.sidePanelTab === 'style'}
          aria-controls="elce-appearance-tabpanel"
          mix={on<HTMLButtonElement, 'click'>('click', () => props.onSetSidePanelTab('style'))}
        >
          Style
        </button>
      </div>
    </div>
    <section
      id="elce-clipboard-tabpanel"
      className="elce-properties-tabpanel"
      role="tabpanel"
      aria-labelledby="elce-side-panel-tab-clipboard"
      hidden={props.sidePanelTab !== 'clipboard'}
    >
      {renderLearningClipboardPanel({
        view,
        actions,
        scenario: props.scenario,
        activeTab: props.clipboardTab,
        dropTarget: props.dropTarget,
        getDraggedEntry: props.getDraggedEntry,
        onSetTab: props.onSetClipboardTab,
        onSetDropTarget: props.onSetDropTarget,
        onSetDraggedEntry: props.onSetDraggedEntry,
        onOpenAppearanceTarget: props.onOpenAppearanceTarget,
      })}
    </section>
    <section
      id="elce-variables-tabpanel"
      className="elce-properties-tabpanel elce-variables-panel"
      role="tabpanel"
      aria-labelledby="elce-side-panel-tab-variables"
      hidden={props.sidePanelTab !== 'variables'}
    >
      <header id="elce-variables-heading" className="elce-properties-heading">
        <h1 id="elce-variables-title">Variables</h1>
      </header>
      {profileTokenTargetId === null
        ? <p id="elce-variables-empty" className="elce-muted">
          Sélectionner un champ de texte pour afficher ses variables.
        </p>
        : renderProfileTokenInsertion(
          'elce-profile-token-insertion',
          view.documentModel.data.profile.properties,
          profileTokenTargetId,
          linkablePages,
          selectedInlineLabel,
        )}
    </section>
    <section
      id="elce-appearance-tabpanel"
      className="elce-properties-tabpanel"
      role="tabpanel"
      aria-labelledby="elce-side-panel-tab-style"
      hidden={props.sidePanelTab !== 'style'}
    >
      {renderAppearancePanel({
        view,
        actions,
        target: props.appearanceTarget,
      })}
    </section>
  </aside>
}

/** Resolves the active right-side panel's accessible heading. */
function rightPanelLabelId(tab: LearningContentCatalogPanelProps['sidePanelTab']): string {
  switch (tab) {
    case 'clipboard':
      return 'elce-clipboard-title'
    case 'variables':
      return 'elce-variables-title'
    case 'style':
      return 'elce-appearance-title'
  }
}
