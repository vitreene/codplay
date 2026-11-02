import type { ChapterId, PageId } from '../../../../core/document/content-document-types'
import type { CreatePageCommandInput, LearningDocumentCommand } from '../learning-document-command-types'
import type { PagePlacement } from '../../organization/learning-page-placement'

/** Creates a page command while keeping identifier generation outside rendering. */
export function createPageCommand(input: CreatePageCommandInput): Extract<LearningDocumentCommand, { type: 'page.create' }> {
  return { type: 'page.create', ...input }
}

/** Creates the command that moves a chapter among root scenario entries. */
export function createChapterMoveCommand(
  chapterId: ChapterId,
  index?: number,
): Extract<LearningDocumentCommand, { type: 'chapter.move' }> {
  return { type: 'chapter.move', chapterId, index }
}

/** Creates the command used to move a page between the document's page collections. */
export function createPageMoveCommand(
  pageId: PageId,
  placement: PagePlacement,
): Extract<LearningDocumentCommand, { type: 'page.move' }> {
  return { type: 'page.move', pageId, placement }
}

/** Creates the command that sends a page to the catalogue without deleting it. */
export function createPageRemoveCommand(pageId: PageId): Extract<LearningDocumentCommand, { type: 'page.remove' }> {
  return { type: 'page.remove', pageId }
}

/** Creates the command that permanently deletes a page and its bdc. */
export function createPageDeleteCommand(pageId: PageId): Extract<LearningDocumentCommand, { type: 'page.delete' }> {
  return { type: 'page.delete', pageId }
}
