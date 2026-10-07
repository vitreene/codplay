import type { Handle, RemixNode } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'
import { BDC_TYPE, PAGE_TYPE } from '../../../config/document-config'
import type { Bdc, Page } from '../../../domain/document/document-types'
import type { ElceDocument } from '../../../domain/document/document-model'
import { selectEditorViewModel } from '../../selectors/editor-view-model'
import { EditorContextProvider } from '../../remix/editor-context'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import type { EditorViewModel } from '../../selectors/editor-view-model'
import { RemixCardEditorFields } from './remix-card-editor-fields'

type CardProofEntry =
  | Readonly<{ readonly card: Bdc; readonly placement: 'diapo-direct'; readonly pageName: string }>
  | Readonly<{
      readonly card: Bdc
      readonly placement: 'carousel-child'
      readonly pageName: string
      readonly carouselBdcId: string
      readonly carouselContent: NonNullable<Bdc['carousel']>
      readonly carouselCards: readonly Bdc[]
    }>

/** Temporarily exposes both documented Card placements in the Remix runtime. */
export function RemixCardEditorProofTemp(handle: Handle) {
  const { controller, actions } = handle.context.get(EditorContextProvider)
  if (controller === null || actions === null) {
    throw new Error('The Remix Card proof requires the authoring actor.')
  }

  let view = selectEditorViewModel(controller.getSnapshot())
  handle.queueTask(() => {
    const subscription = controller.subscribe((snapshot) => {
      view = selectEditorViewModel(snapshot)
      void handle.update()
    })
    handle.signal.addEventListener('abort', () => subscription.unsubscribe(), { once: true })
  })

  return () => renderProof(view, actions)
}

/** Selects direct Diapo Cards and Cards whose Carousel owns their placement. */
function selectCardProofEntries(document: ElceDocument): readonly CardProofEntry[] {
  const cards = document.bdcs.filter((bdc) => bdc.type === BDC_TYPE.CARD && bdc.card != null)
  const entries: CardProofEntry[] = []
  for (const card of cards) {
    const placement = cardProofPlacement(document, card)
    switch (placement?.kind) {
      case 'diapo-direct':
        entries.push({ card, placement: 'diapo-direct', pageName: placement.page.name })
        break
      case 'carousel-child':
        entries.push({
          card,
          placement: 'carousel-child',
          pageName: placement.page.name,
          carouselBdcId: placement.carousel.id,
          carouselContent: placement.carouselContent,
          carouselCards: placement.carouselCards,
        })
        break
      default:
        break
    }
  }
  return entries
}

/** Resolves the actual page or Carousel parent without changing the document. */
function cardProofPlacement(document: ElceDocument, card: Bdc):
  | Readonly<{ kind: 'diapo-direct'; page: Page }>
  | Readonly<{ kind: 'carousel-child'; page: Page; carousel: Bdc; carouselContent: NonNullable<Bdc['carousel']>; carouselCards: readonly Bdc[] }>
  | null {
  switch (card.parentBdcId) {
    case null: {
      const page = document.pages.find((candidate) => candidate.id === card.pageId)
      switch (page?.type) {
        case PAGE_TYPE.DIAPO:
          switch (page.bdcIds.includes(card.id)) {
            case true:
              return { kind: 'diapo-direct', page }
            default:
              return null
          }
        default:
          return null
      }
    }
    default: {
      const carousel = document.bdcs.find((candidate) => candidate.id === card.parentBdcId)
      switch (carousel?.type) {
        case BDC_TYPE.CAROUSEL:
          switch (carousel.carousel) {
            case null:
            case undefined:
              return null
            default: {
              const page = document.pages.find((candidate) => candidate.bdcIds.includes(carousel.id))
              switch (page) {
                case undefined:
                  return null
                default:
                  switch (carousel.carousel.cards.some((entry) => entry.bdcId === card.id)) {
                    case true:
                      return {
                        kind: 'carousel-child',
                        page,
                        carousel,
                        carouselContent: carousel.carousel,
                        carouselCards: carousel.carousel.cards.flatMap((entry) => {
                          const child = document.bdcs.find((candidate) => candidate.id === entry.bdcId)
                          return child === undefined ? [] : [child]
                        }),
                      }
                    default:
                      return null
                  }
              }
            }
          }
        default:
          return null
      }
    }
  }
}

/** Renders each supported Card placement with the same Remix fields. */
function renderProof(view: EditorViewModel, actions: EditorActionsFacade): RemixNode {
  const entries = selectCardProofEntries(view.documentModel)
  return jsx('main', {
    id: 'elce-remix-card-proof',
    'data-remix-card-proof': 'active',
    children: [
      jsx('h1', { id: 'elce-remix-card-proof-title', children: 'Vérification des cartes dans Remix' }),
      jsx('p', { id: 'elce-remix-card-proof-count', children: `${entries.length} carte(s) trouvée(s)` }),
      ...entries.map((entry) => renderCardProofEntry(entry, view, actions)),
    ],
  })
}

/** Connects one Card's fields to its existing ElceCardFacade action path. */
function renderCardProofEntry(entry: CardProofEntry, view: EditorViewModel, actions: EditorActionsFacade): RemixNode {
  switch (entry.placement) {
    case 'diapo-direct':
      return renderCardProofFields(entry, view, actions.createCardEditorActions(view.documentModel.bdcs), 'elce-remix-diapo-card', null, false)
    case 'carousel-child': {
      const carouselActions = actions.createCarouselEditorActions(
        entry.carouselBdcId,
        entry.carouselContent,
        entry.carouselCards,
        view.documentModel.data.revelationDefaults,
      )
      return renderCardProofFields(
        entry,
        view,
        carouselActions,
        'elce-remix-carousel-card',
        entry.carouselContent.aspectRatio,
        true,
        carouselActions.importMediaFiles,
      )
    }
  }
}

/** Renders one placement through the actions supplied by its existing facade. */
function renderCardProofFields(
  entry: CardProofEntry,
  view: EditorViewModel,
  cardActions: ReturnType<EditorActionsFacade['createCardEditorActions']>,
  idPrefix: string,
  imageAspectRatio: Readonly<{ width: number; height: number }> | null,
  allowMultipleMediaFiles: boolean,
  importMediaFiles?: (bdcId: string, files: readonly File[]) => void,
): RemixNode {
  return jsx('section', {
    id: `elce-remix-card-proof-${entry.placement}-${entry.card.id}`,
    'data-card-placement': entry.placement,
    'data-card-id': entry.card.id,
    children: [
      jsx('h2', {
        id: `elce-remix-card-proof-heading-${entry.card.id}`,
        children: cardPlacementLabel(entry),
      }),
      jsx(RemixCardEditorFields, {
        bdc: entry.card,
        mediaById: view.mediaById,
        actions: cardActions,
        idPrefix,
        imageAspectRatio,
        allowMultipleMediaFiles,
        importMediaFiles,
      }),
    ],
  }, entry.card.id)
}

/** Names the placement shown by this temporary proof. */
function cardPlacementLabel(entry: CardProofEntry): string {
  switch (entry.placement) {
    case 'diapo-direct':
      return `Carte directe en Diapo — ${entry.pageName}`
    case 'carousel-child':
      return `Carte enfant de Carousel — ${entry.pageName}`
  }
}
