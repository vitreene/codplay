import { ANCHOR } from '../../config/document-config'
import type { BdcId, RichTextDocument, RichTextNode } from '../document/document-types'
import type { ElceDocument } from '../document/document-model'

/** Reads and compares the unique bdc references embedded in Elcé rich text. */
export class ElceAnchorReferenceService {
  /** Returns anchor references in document order and preserves duplicates for validation. */
  public bdcIdsIn(content: RichTextDocument): readonly BdcId[] {
    const bdcIds: BdcId[] = []
    this.collectBdcIds(content.content, bdcIds)
    return bdcIds
  }

  /** Returns bdc references removed when a Section's rich-text content changes. */
  public removedBdcIds(previous: RichTextDocument, next: RichTextDocument): readonly BdcId[] {
    const nextBdcIds = new Set(this.bdcIdsIn(next))
    return [...new Set(this.bdcIdsIn(previous))].filter((bdcId) => !nextBdcIds.has(bdcId))
  }

  /** Checks whether any Section in the document still refers to a bdc. */
  public isReferenced(document: ElceDocument, bdcId: BdcId): boolean {
    for (const bdc of document.bdcs) {
      switch (bdc.section) {
        case null:
          break
        default:
          if (this.bdcIdsIn(bdc.section.content).includes(bdcId)) return true
      }
    }
    return false
  }

  /** Collects anchor references recursively from a rich-text subtree. */
  private collectBdcIds(nodes: readonly RichTextNode[], target: BdcId[]): void {
    for (const node of nodes) {
      switch (node.type) {
        case ANCHOR.NODE_NAME: {
          const bdcId = node.attrs?.bdcId
          switch (typeof bdcId) {
            case 'string':
              switch (bdcId) {
                case '':
                  throw new Error('Ancre sans identifiant de bdc.')
                default:
                  target.push(bdcId)
              }
              break
            default:
              throw new Error('Ancre sans identifiant de bdc.')
          }
          break
        }
        default:
          break
      }
      switch (node.content) {
        case undefined:
          break
        default:
          this.collectBdcIds(node.content, target)
      }
    }
  }
}
