import { on, type RemixNode } from 'remix/ui'

import { CATALOG_TAB } from './learning-authoring-config'
import { renderProfileTokenInsertion } from '../profile/authoring/profile-token-insertion'
import type { LearningContentCatalogPanelProps } from './learning-content-catalog-panel-types'
import { renderAppearancePanel } from './learning-appearance-panel'
import { renderWorkspacePanelReduceButton } from './workspace-panel-controls'

/** Renders contextual Variables and the existing Style panel on the right. */
export function renderLearningContentCatalogPanel(props: LearningContentCatalogPanelProps): RemixNode {
  const { view, actions, profileTokenTargetId } = props
  const panelOpen = props.panelOpen ?? true
  const selectedInlineLabel = props.selectedInlineLabel
  const linkablePageIds = new Set(view.documentModel.scenarioPageIds)
  const linkablePages = view.documentModel.pages.filter((page) => linkablePageIds.has(page.id))
  const canShowProfileTab = profileTokenTargetId !== null

  return <aside
    id="elce-properties"
    className="elce-panel elce-properties"
    data-panel-open={panelOpen}
    aria-labelledby={props.sidePanelTab === 'contents' ? 'elce-content-catalog-title' : 'elce-appearance-title'}
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
          id="elce-side-panel-tab-contents"
          className={props.sidePanelTab === 'contents' ? 'elce-side-panel-tab elce-side-panel-tab--active' : 'elce-side-panel-tab'}
          type="button"
          role="tab"
          aria-selected={props.sidePanelTab === 'contents'}
          aria-controls="elce-content-catalog"
          mix={on<HTMLButtonElement, 'click'>('click', () => props.onSetSidePanelTab('contents'))}
        >
          Contenus
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
      id="elce-content-catalog"
      className="elce-outline-group"
      role="tabpanel"
      aria-labelledby="elce-side-panel-tab-contents"
      hidden={props.sidePanelTab !== 'contents'}
    >
      <header
        id="elce-properties-heading"
        className="elce-properties-heading"
      >
        <h1
          id="elce-content-catalog-title"
        >
          Contenus
        </h1>
      </header>
      <div
        id="elce-content-catalog-tabs"
        className="elce-content-catalog-tabs"
        role="group"
        aria-label="Variables du profil"
      >
        {canShowProfileTab ? <button
          id="elce-content-catalog-tab-profile"
          className={view.catalogTab === CATALOG_TAB.PROFILE ? 'elce-content-catalog-tab elce-content-catalog-tab--active' : 'elce-content-catalog-tab'}
          type="button"
          aria-pressed={view.catalogTab === CATALOG_TAB.PROFILE}
          aria-controls="elce-catalog-profile"
          mix={on<HTMLButtonElement, 'click'>('click', () => actions.selectCatalogTab(CATALOG_TAB.PROFILE))}
        >
          Variables
        </button> : null}
      </div>
      <section
        id="elce-catalog-profile"
        className="elce-content-catalog-panel"
        aria-label="Variables et liens"
        hidden={view.catalogTab !== CATALOG_TAB.PROFILE || !canShowProfileTab}
      >
        {profileTokenTargetId === null ? null : renderProfileTokenInsertion(
          'elce-profile-token-insertion',
          view.documentModel.data.profile.properties,
          profileTokenTargetId,
          linkablePages,
          selectedInlineLabel,
        )}
      </section>
      {canShowProfileTab ? null : <p id="elce-content-catalog-empty" className="elce-muted">
        Sélectionner un champ de texte pour afficher ses variables.
      </p>}
    </section>
    <section
      id="elce-appearance-tabpanel"
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
