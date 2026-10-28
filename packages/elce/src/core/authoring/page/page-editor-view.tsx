import { on, type RemixNode } from 'remix/ui'
import { GripVertical } from 'lucide-static'
import type { ContentPage } from '../../document/content-document-types'
import type { AppearanceTarget } from '../../../domain/appearance/appearance-target-types'
import { renderLucideIcon } from '../lucide-static-icon'
import { renderAppearanceTrigger } from '../appearance-trigger'

export interface PageEditorViewProps<TPage extends ContentPage = ContentPage> {
  readonly page: TPage | undefined
  readonly sequence: readonly Readonly<{ bdcId: string; index: number }>[]
  readonly pageToolbar: RemixNode
  readonly dropTarget: string | null
  readonly chapterTitle: RemixNode | null
  readonly renderPageTypeMark: (page: TPage) => RemixNode
  readonly onRenamePage: (pageId: string, name: string) => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
  readonly renderBdcEditor: (bdcId: string, index: number) => RemixNode
  readonly onStartBdcDrag: (event: DragEvent, bdcId: string) => void
  readonly onEndBdcDrag: () => void
  readonly onDragOverSeparator: (event: DragEvent, targetId: string, index: number) => void
  readonly onDragLeaveSeparator: (event: DragEvent) => void
  readonly onDropBdc: (event: DragEvent, index: number) => void
}

/** Renders the shared page heading, ordered BDC host and insertion separators. */
export function renderPageEditorView<TPage extends ContentPage>(props: PageEditorViewProps<TPage>): RemixNode {
  const page = props.page
  return <section id="elce-work-area" className="elce-panel elce-work-area">
    <div id="elce-work-area-heading" className="elce-work-area-heading">
      <div id="elce-work-area-title-row" className="elce-work-area-title-row">
        <div id="elce-work-area-actions" className="elce-work-area-actions">
          {props.pageToolbar}
        </div>
        <div id="elce-work-area-titles" className="elce-work-area-titles">
          {props.chapterTitle}
          {renderPageTitle(page, props.renderPageTypeMark, props.onRenamePage, props.onOpenAppearanceTarget)}
        </div>
      </div>
    </div>
    {page === undefined
      ? <p id="elce-editor-unavailable">Sélectionnez une page du scénario.</p>
      : renderPageBdcSequence(page, props)}
  </section>
}

/** Renders the page title and its keyboard-accessible style entry point. */
function renderPageTitle<TPage extends ContentPage>(
  page: TPage | undefined,
  renderPageTypeMark: PageEditorViewProps<TPage>['renderPageTypeMark'],
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
      <input
        id={`elce-page-title-${page.id}`}
        className="elce-inline-title-input"
        type="text"
        aria-label="Titre de la page"
        title="Modifier le titre de la page"
        defaultValue={page.name}
        data-elce-profile-token-target="true"
        key={`${page.id}:${page.name}`}
        mix={[
          on<HTMLInputElement, 'blur'>('blur', (event) => commitInlineName(event.currentTarget, page.name, (name) => onRenamePage(page.id, name))),
          on<HTMLInputElement, 'keydown'>('keydown', (event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }),
        ]}
      />
    </h1>
    {renderAppearanceTrigger({
      id: `elce-page-style-${page.id}`,
      target: { kind: 'page', pageId: page.id },
      label: `Ouvrir le style de la page ${page.name}`,
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
      renderBdcSeparator(index, props),
      <div key={bdcId} id={`elce-page-bdc-${bdcId}`} className="elce-page-bdc">
        <div id={`elce-page-bdc-actions-${bdcId}`} className="elce-page-bdc-actions">
          <button
            id={`elce-page-bdc-drag-${bdcId}`}
            className="elce-bdc-icon-button elce-page-bdc__drag"
            type="button"
            draggable={true}
            aria-label="Déplacer le bloc"
            title="Glisser pour déplacer ou rendre disponible"
            mix={[
              on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => props.onStartBdcDrag(event, bdcId)),
              on<HTMLButtonElement, 'dragend'>('dragend', props.onEndBdcDrag),
            ]}
          >
            {renderLucideIcon(GripVertical, `elce-page-bdc-drag-icon-${bdcId}`)}
          </button>
        </div>
        {props.renderBdcEditor(bdcId, index)}
      </div>,
    ])}
    {renderBdcSeparator(page.bdcIds.length, props)}
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
      on<HTMLElement, 'dragleave'>('dragleave', props.onDragLeaveSeparator),
      on<HTMLElement, 'drop'>('drop', (event) => props.onDropBdc(event, index)),
    ]}
  >
    <span id={`${id}-line`} />
  </div>
}

/** Keeps inline title validation consistent with the existing page editor. */
function commitInlineName(input: HTMLInputElement, previous: string, rename: (name: string) => void): void {
  const next = input.value.trim()
  if (next.length === 0) {
    input.value = previous
    return
  }
  if (next !== previous) rename(next)
}
