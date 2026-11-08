import { on, type RemixNode } from 'remix/component'
import type { ContentPage } from '../../document/content-document-types'
import type { ResourceTextFieldFeature } from '../resource-text-field-feature'
import type { AuthoredTextValue } from '../../document/rich-text-types'
import type { AppearanceTarget } from '../../../domain/appearance/appearance-target-types'
import { renderLucideIcon } from '../lucide-static-icon'
import { Library, Plus, Trash2 } from 'lucide-static'
import { renderAppearanceTrigger } from '../appearance-trigger'

export interface PageEditorViewProps<TPage extends ContentPage = ContentPage> {
  readonly page: TPage | undefined
  readonly sequence: readonly Readonly<{
    bdcId: string
    index: number
    navigationIcon: RemixNode
    navigationLabel: string
  }>[]
  readonly addContentMenu: RemixNode
  readonly isAddContentMenuOpen: boolean
  readonly trashAnimationToken: number
  readonly onToggleAddContentMenu: () => void
  readonly dropTarget: string | null
  readonly chapterTitle: RemixNode | null
  readonly renderPageTypeMark: (page: TPage) => RemixNode
  readonly textFieldFeature: ResourceTextFieldFeature
  readonly onRenamePage: (pageId: string, name: AuthoredTextValue) => void
  readonly onOpenAppearanceTarget?: (target: AppearanceTarget, triggerId: string) => void
  readonly renderBdcEditor: (bdcId: string, index: number) => RemixNode
  readonly onStartBdcDrag: (event: DragEvent, bdcId: string) => void
  readonly onEndBdcDrag: () => void
  readonly onDragOverBdcNavigationItem: (event: DragEvent, bdcId: string, index: number) => void
  readonly onDropBdcNavigationItem: (event: DragEvent, bdcId: string, index: number) => void
  readonly onDragOverBdcTrash: (event: DragEvent) => void
  readonly onDropBdcTrash: (event: DragEvent) => void
  readonly onDragOverBdcCatalog?: (event: DragEvent) => void
  readonly onDropBdcCatalog?: (event: DragEvent) => void
  readonly onDragOverSeparator: (event: DragEvent, targetId: string, index: number) => void
  readonly onDragLeaveDropTarget: (event: DragEvent) => void
  readonly onDropBdc: (event: DragEvent, index: number) => void
}

/** Renders the page controls, heading, ordered BDC host and insertion separators. */
export function renderPageEditorView<TPage extends ContentPage>(props: PageEditorViewProps<TPage>): RemixNode {
  const page = props.page
  return <div id="elce-page-editor-layout" className="elce-page-editor-layout">
    <section id="elce-work-area" className="elce-panel elce-work-area">
      <div id="elce-work-area-heading" className="elce-work-area-heading">
        <div id="elce-work-area-title-row" className="elce-work-area-title-row">
          <div id="elce-work-area-titles" className="elce-work-area-titles">
            {props.chapterTitle}
            {renderPageTitle(page, props.renderPageTypeMark, props.textFieldFeature, props.onRenamePage, props.onOpenAppearanceTarget)}
          </div>
        </div>
      </div>
      {page === undefined
        ? <p id="elce-editor-unavailable">Sélectionnez une page du scénario.</p>
        : renderPageBdcLayout(page, props)}
    </section>
  </div>
}

/** Renders the page title and its keyboard-accessible style entry point. */
function renderPageTitle<TPage extends ContentPage>(
  page: TPage | undefined,
  renderPageTypeMark: PageEditorViewProps<TPage>['renderPageTypeMark'],
  textFieldFeature: PageEditorViewProps<TPage>['textFieldFeature'],
  onRenamePage: PageEditorViewProps<TPage>['onRenamePage'],
  onOpenAppearanceTarget: PageEditorViewProps<TPage>['onOpenAppearanceTarget'],
): RemixNode {
  if (page === undefined) return <h1 id="elce-work-area-title">Éditeur</h1>
  return <div
    id={`elce-work-area-page-heading-${page.id}`}
    className="elce-work-area-page-heading"
  >
    <h1 id="elce-work-area-title" className="elce-work-area-page-title">
      <span id={`elce-page-type-mark-${page.id}`} className="elce-page-type-mark" aria-hidden={true}>
        {renderPageTypeMark(page)}
      </span>
      {textFieldFeature.render({
        id: `elce-page-title-${page.id}`,
        className: 'elce-inline-title-input',
        ariaLabel: 'Titre de la page',
        placeholder: 'Titre de la page',
        value: page.name,
        required: true,
        onChange: (name) => onRenamePage(page.id, name),
      })}
    </h1>
    {onOpenAppearanceTarget === undefined ? null : renderAppearanceTrigger({
      id: `elce-page-style-${page.id}`,
      target: { kind: 'page', pageId: page.id },
      label: 'Ouvrir le style de la page',
      onOpen: onOpenAppearanceTarget,
    })}
  </div>
}

/** Renders the existing ordered BDC host while delegating each editor to Learning. */
function renderPageBdcSequence<TPage extends ContentPage>(page: TPage, props: PageEditorViewProps<TPage>): RemixNode {
  return <div id={`elce-page-bdc-list-${page.id}`} className="elce-page-bdc-list">
    {props.sequence.length === 0
      ? <p id="elce-editor-unavailable">Cette page ne contient aucun bloc éditable.</p>
      : null}
    {props.sequence.flatMap(({ bdcId, index }) => [
      index === 0 ? null : renderBdcSeparator(index, props),
      renderPageBdc<TPage>(bdcId, index, props),
    ])}
    {renderBdcSeparator(page.bdcIds.length, props)}
  </div>
}

/** Renders the sticky type-icon rail beside the existing direct BDC sequence. */
function renderPageBdcLayout<TPage extends ContentPage>(page: TPage, props: PageEditorViewProps<TPage>): RemixNode {
  return <div id={`elce-page-bdc-layout-${page.id}`} className="elce-page-bdc-layout">
    {renderBdcSeparator(0, props)}
    <nav
      id={`elce-page-bdc-navigation-${page.id}`}
      className="elce-page-bdc-navigation"
      aria-label="Navigation des blocs de la page"
    >
      {props.sequence.map((entry) => renderBdcNavigationItem(entry, props))}
      {renderAddContentMenu(page.id, props)}
      {renderBdcCatalog(page.id, props)}
      {renderBdcTrash(page.id, props)}
    </nav>
    {renderPageBdcSequence(page, props)}
  </div>
}

/** Renders a drop target that returns a direct page BDC to the catalog. */
function renderBdcCatalog<TPage extends ContentPage>(pageId: string, props: PageEditorViewProps<TPage>): RemixNode {
  if (props.onDragOverBdcCatalog === undefined || props.onDropBdcCatalog === undefined) return null
  const id = `elce-page-bdc-catalog-${pageId}`
  const classNames = [
    'elce-page-bdc-catalog',
    ...(props.dropTarget === `${id}-drop` ? ['elce-page-bdc-catalog--drop-target'] : []),
  ]
  return <div
    id={id}
    className={classNames.join(' ')}
    role="region"
    aria-label="Catalogue : déposer un bloc pour le rendre disponible"
    title="Déposer un bloc ici pour le remettre au catalogue"
    mix={[
      on<HTMLElement, 'dragover'>('dragover', props.onDragOverBdcCatalog),
      on<HTMLElement, 'dragleave'>('dragleave', props.onDragLeaveDropTarget),
      on<HTMLElement, 'drop'>('drop', props.onDropBdcCatalog),
    ]}
  >
    <span
      id={`elce-page-bdc-catalog-icon-${pageId}`}
      className="elce-page-bdc-catalog__icon"
      aria-hidden={true}
    >
      {renderLucideIcon(Library, `elce-page-bdc-catalog-symbol-${pageId}`)}
    </span>
  </div>
}

/** Renders a borderless drop target that permanently deletes a direct page BDC. */
function renderBdcTrash<TPage extends ContentPage>(pageId: string, props: PageEditorViewProps<TPage>): RemixNode {
  const id = `elce-page-bdc-trash-${pageId}`
  const classNames = [
    'elce-page-bdc-trash',
    ...(props.dropTarget === `${id}-drop` ? ['elce-page-bdc-trash--drop-target'] : []),
  ]
  return <div
    id={id}
    className={classNames.join(' ')}
    role="region"
    aria-label="Corbeille : déposer un bloc pour le supprimer"
    title="Déposer un bloc ici pour le supprimer"
    mix={[
      on<HTMLElement, 'dragover'>('dragover', props.onDragOverBdcTrash),
      on<HTMLElement, 'dragleave'>('dragleave', props.onDragLeaveDropTarget),
      on<HTMLElement, 'drop'>('drop', props.onDropBdcTrash),
    ]}
  >
    <span
      key={props.trashAnimationToken}
      id={`elce-page-bdc-trash-icon-${pageId}`}
      className={props.trashAnimationToken === 0
        ? 'elce-page-bdc-trash__icon'
        : 'elce-page-bdc-trash__icon elce-page-bdc-trash__icon--success'}
      aria-hidden={true}
    >
      {renderLucideIcon(Trash2, `elce-page-bdc-trash-symbol-${pageId}`)}
    </span>
  </div>
}

/** Renders the final rail control and the existing BDC creation commands. */
function renderAddContentMenu<TPage extends ContentPage>(pageId: string, props: PageEditorViewProps<TPage>): RemixNode {
  const menuId = `elce-page-bdc-add-menu-${pageId}`
  return <div id={`elce-page-bdc-add-${pageId}`} className="elce-page-bdc-add">
    <button
      id={`elce-page-bdc-add-toggle-${pageId}`}
      className="elce-bdc-icon-button elce-page-bdc-add-toggle"
      type="button"
      aria-label="Ajouter un contenu"
      title="Ajouter un contenu"
      aria-expanded={props.isAddContentMenuOpen}
      aria-controls={menuId}
      mix={on<HTMLButtonElement, 'click'>('click', props.onToggleAddContentMenu)}
    >
      {renderLucideIcon(Plus, `elce-page-bdc-add-icon-${pageId}`)}
    </button>
    <div
      id={menuId}
      className="elce-page-bdc-add-menu"
      role="group"
      aria-label="Ajouter un contenu"
      hidden={!props.isAddContentMenuOpen}
    >
      {props.addContentMenu}
    </div>
  </div>
}

/** Renders one BDC point that navigates, reorders and returns the same BDC. */
function renderBdcNavigationItem<TPage extends ContentPage>(
  entry: PageEditorViewProps<TPage>['sequence'][number],
  props: PageEditorViewProps<TPage>,
): RemixNode {
  const beforeDropTarget = `elce-page-bdc-navigation-drop-${entry.bdcId}-before`
  const afterDropTarget = `elce-page-bdc-navigation-drop-${entry.bdcId}-after`
  const classNames = [
    'elce-bdc-icon-button',
    'elce-page-bdc-navigation-item',
    ...(props.dropTarget === beforeDropTarget ? ['elce-page-bdc-navigation-item--drop-before'] : []),
    ...(props.dropTarget === afterDropTarget ? ['elce-page-bdc-navigation-item--drop-after'] : []),
  ]
  return <button
    key={entry.bdcId}
    id={`elce-page-bdc-drag-${entry.bdcId}`}
    className={classNames.join(' ')}
    type="button"
    draggable={true}
    aria-label={`Aller au bloc ${entry.navigationLabel} ${entry.index + 1}`}
    title={`Bloc ${entry.index + 1} · ${entry.navigationLabel} : cliquer pour atteindre, glisser pour réordonner ou rendre disponible`}
    mix={[
      on<HTMLButtonElement, 'click'>('click', () => {
        document.getElementById(`elce-page-bdc-${entry.bdcId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }),
      on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => props.onStartBdcDrag(event, entry.bdcId)),
      on<HTMLButtonElement, 'dragover'>('dragover', (event) => props.onDragOverBdcNavigationItem(event, entry.bdcId, entry.index)),
      on<HTMLButtonElement, 'dragleave'>('dragleave', props.onDragLeaveDropTarget),
      on<HTMLButtonElement, 'drop'>('drop', (event) => props.onDropBdcNavigationItem(event, entry.bdcId, entry.index)),
      on<HTMLButtonElement, 'dragend'>('dragend', props.onEndBdcDrag),
    ]}
  >
    {entry.navigationIcon}
  </button>
}

/** Renders one BDC at its stable identity in the page sequence. */
function renderPageBdc<TPage extends ContentPage>(bdcId: string, index: number, props: PageEditorViewProps<TPage>): RemixNode {
  return <div key={bdcId} id={`elce-page-bdc-${bdcId}`} className="elce-page-bdc">
    {props.renderBdcEditor(bdcId, index)}
  </div>
}

/** Renders one insertion separator and forwards its native drag events. */
function renderBdcSeparator<TPage extends ContentPage>(index: number, props: PageEditorViewProps<TPage>): RemixNode {
  const id = `elce-page-bdc-drop-${index}`
  const active = props.dropTarget === id
  return <div
    id={id}
    className={active ? 'elce-page-bdc-drop elce-page-bdc-drop--active' : 'elce-page-bdc-drop'}
    aria-label="Déposer le bloc à cet endroit"
    mix={[
      on<HTMLElement, 'dragover'>('dragover', (event) => props.onDragOverSeparator(event, id, index)),
      on<HTMLElement, 'dragleave'>('dragleave', props.onDragLeaveDropTarget),
      on<HTMLElement, 'drop'>('drop', (event) => props.onDropBdc(event, index)),
    ]}
  >
    <span id={`${id}-line`} />
  </div>
}
