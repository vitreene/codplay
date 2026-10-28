import type { ChapterId, PageId } from '../../../core/document/content-document-types'
import type { LearningDocument } from '../document/learning-document'
import { BDC_TYPE } from '../learning-definition'
import type { LearningDocumentCommand } from '../commands/learning-document-command-types'
import type { SectionSelection } from '../../../resources/bdcs/section/authoring/section-selection-types'

export type { SectionSelection } from '../../../resources/bdcs/section/authoring/section-selection-types'

export interface LearningSelection {
  readonly selectedPageId: PageId | null
  readonly selectedChapterId: ChapterId | null
  readonly selectedCarouselCardBdcId: string | null
  readonly sectionSelection: SectionSelection | null
}

/** Owns editor selection rules without storing selection outside the controller actor. */
export class LearningSelectionService {
  /** Creates the initial page selection for a newly constructed document. */
  public initial(document: LearningDocument): LearningSelection {
    return {
      selectedPageId: document.pages[0]?.id ?? null,
      selectedChapterId: null,
      selectedCarouselCardBdcId: null,
      sectionSelection: null,
    }
  }

  /** Keeps only selections that still refer to content in a replaced document. */
  public afterReplace(document: LearningDocument, current: LearningSelection): LearningSelection {
    return {
      selectedPageId: this.keepSelectedPage(document, current.selectedPageId),
      selectedChapterId: this.keepSelectedChapter(document, current.selectedChapterId),
      selectedCarouselCardBdcId: this.keepSelectedCarouselCard(document, current.selectedCarouselCardBdcId),
      sectionSelection: null,
    }
  }

  /** Selects the page created by a page command and retains surviving selection otherwise. */
  public afterCommand(
    document: LearningDocument,
    command: LearningDocumentCommand,
    current: LearningSelection,
    selectCreatedPage: boolean,
    selectionAfter?: SectionSelection | null,
  ): LearningSelection {
    const createdPageId = selectCreatedPage && command.type === 'page.create' ? command.pageId : null
    return {
      selectedPageId: createdPageId ?? this.keepSelectedPage(document, current.selectedPageId),
      selectedChapterId: createdPageId === null ? this.keepSelectedChapter(document, current.selectedChapterId) : null,
      selectedCarouselCardBdcId: createdPageId === null
        ? this.selectedCarouselCardAfterCommand(document, command, current.selectedCarouselCardBdcId)
        : null,
      sectionSelection: createdPageId !== null
        ? null
        : this.keepSectionSelection(document, selectionAfter ?? current.sectionSelection),
    }
  }

  /** Selects a valid page and clears the page-specific child selection. */
  public selectPage(document: LearningDocument, current: LearningSelection, pageId: PageId): LearningSelection {
    return {
      ...current,
      selectedPageId: this.keepSelectedPage(document, pageId),
      selectedChapterId: null,
      selectedCarouselCardBdcId: null,
      sectionSelection: null,
    }
  }

  /** Selects a valid chapter and clears the page-specific child selection. */
  public selectChapter(document: LearningDocument, current: LearningSelection, chapterId: ChapterId): LearningSelection {
    return {
      ...current,
      selectedChapterId: this.keepSelectedChapter(document, chapterId),
      selectedCarouselCardBdcId: null,
      sectionSelection: null,
    }
  }

  /** Selects a Carousel card only when it remains part of an authored Carousel. */
  public selectCarouselCard(document: LearningDocument, current: LearningSelection, bdcId: string | null): LearningSelection {
    return {
      ...current,
      selectedCarouselCardBdcId: bdcId !== null && this.findCarouselCard(document, bdcId) ? bdcId : null,
    }
  }

  /** Replaces the Section caret retained with a history position. */
  public withSectionSelection(current: LearningSelection, sectionSelection: SectionSelection | null): LearningSelection {
    return { ...current, sectionSelection }
  }

  /** Keeps a saved caret only while its Section still belongs to the document. */
  public keepSectionSelection(document: LearningDocument, selection: SectionSelection | null): SectionSelection | null {
    return selection !== null && document.bdcs.some((bdc) => bdc.id === selection.sectionBdcId)
      ? selection : null
  }

  /** Keeps the selected page when it survives a document replacement. */
  public keepSelectedPage(document: LearningDocument, selectedPageId: PageId | null): PageId | null {
    if (selectedPageId !== null && document.pages.some((page) => page.id === selectedPageId)) return selectedPageId
    return document.pages[0]?.id ?? null
  }

  /** Keeps the selected chapter only while it remains in the document. */
  public keepSelectedChapter(document: LearningDocument, selectedChapterId: ChapterId | null): ChapterId | null {
    return selectedChapterId !== null && document.chapters.some((chapter) => chapter.id === selectedChapterId)
      ? selectedChapterId
      : null
  }

  /** Selects the first Card on Carousel creation and retains a surviving Card after edits. */
  public selectedCarouselCardAfterCommand(
    document: LearningDocument,
    command: LearningDocumentCommand,
    currentBdcId: string | null,
  ): string | null {
    switch (command.type) {
      case 'bdc.create':
        if (command.bdcType === BDC_TYPE.CAROUSEL) {
          return document.bdcs.find((bdc) => bdc.id === command.bdcId)?.carousel?.cards[0]?.bdcId ?? null
        }
        return this.keepSelectedCarouselCard(document, currentBdcId)
      case 'bdc.carousel.update':
        if (currentBdcId !== null && command.carousel.cards.some((entry) => entry.bdcId === currentBdcId)) return currentBdcId
        return command.carousel.cards[0]?.bdcId ?? null
      default:
        return this.keepSelectedCarouselCard(document, currentBdcId)
    }
  }

  /** Keeps a selected Card BDC when it remains in a Carousel, or selects an available Card. */
  public keepSelectedCarouselCard(document: LearningDocument, bdcId: string | null): string | null {
    if (bdcId !== null && this.findCarouselCard(document, bdcId)) return bdcId
    return document.bdcs.find((bdc) => bdc.carousel?.cards[0] !== undefined)?.carousel?.cards[0]?.bdcId ?? null
  }

  /** Checks whether a Card BDC identifier belongs to an authored Carousel. */
  public findCarouselCard(document: LearningDocument, bdcId: string): boolean {
    return document.bdcs.some((bdc) => bdc.carousel?.cards.some((entry) => entry.bdcId === bdcId) === true)
  }
}
