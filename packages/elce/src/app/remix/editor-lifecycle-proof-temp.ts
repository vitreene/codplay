import { on, type Handle } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'
import { selectEditorViewModel } from '../selectors/editor-view-model'
import { EditorContextProvider } from './editor-context'

/** Temporarily proves that a Remix surface follows and releases the live XState actor. */
export function RemixEditorLifecycleProofTemp(handle: Handle) {
  const { controller, actions } = handle.context.get(EditorContextProvider)
  if (controller === null || actions === null) {
    throw new Error('The Remix editor lifecycle proof requires the authoring actor.')
  }

  let view = selectEditorViewModel(controller.getSnapshot())

  handle.queueTask(() => {
    const subscription = controller.subscribe((snapshot) => {
      view = selectEditorViewModel(snapshot)
      void handle.update()
    })
    handle.signal.addEventListener('abort', () => subscription.unsubscribe(), { once: true })
  })

  return () => jsx('main', {
    id: 'elce-remix-lifecycle-proof',
    'data-remix-lifecycle-proof': 'active',
    children: [
      jsx('h1', { id: 'elce-remix-lifecycle-proof-title', children: 'Vérification temporaire du cycle Remix' }),
      jsx('p', {
        id: 'elce-remix-lifecycle-proof-current-page',
        children: `Page sélectionnée : ${view.selectedPage?.name ?? 'aucune'}`,
      }),
      jsx('ul', {
        id: 'elce-remix-lifecycle-proof-page-list',
        children: view.documentModel.pages.map((page) => jsx('li', {
          id: `elce-remix-lifecycle-proof-item-${page.id}`,
          children: jsx('button', {
            id: `elce-remix-lifecycle-proof-select-${page.id}`,
            type: 'button',
            'aria-pressed': page.id === view.selectedPageId,
            mix: on<HTMLButtonElement, 'click'>('click', () => actions.selectPage(page.id)),
            children: page.name,
          }),
        }, page.id)),
      }),
      jsx('a', {
        id: 'elce-remix-lifecycle-proof-return',
        href: '/',
        children: 'Retour à l’éditeur',
      }),
    ],
  })
}
