import { BDC_TYPE } from '../config/document-config'
import type { ElceDocument } from './document-model'
import { ElceAnchorReferenceService } from './anchor-reference-service'
import type { Bdc, BdcId, Page } from './document-types'

const anchorReferenceService = new ElceAnchorReferenceService()

/** Finds page media that is placed directly in the page rather than at a text anchor. */
export class ElcePageMediaService {
  /** Returns page-level image and video bdc without removing reusable media. */
  public unanchoredMediaBdcs(document: ElceDocument, page: Page): readonly Bdc[] {
    const anchoredBdcIds = new Set<BdcId>()
    for (const bdcId of page.bdcIds) {
      const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
      switch (bdc) {
        case undefined:
          break
        default:
          switch (bdc.section) {
            case null:
              break
            default:
              for (const bdcId of anchorReferenceService.bdcIdsIn(bdc.section.content)) anchoredBdcIds.add(bdcId)
          }
      }
    }
    return page.bdcIds.flatMap((bdcId) => {
      const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
      switch (bdc) {
        case undefined:
          return []
        default:
          switch (bdc.type) {
            case BDC_TYPE.IMAGE:
            case BDC_TYPE.VIDEO:
              return anchoredBdcIds.has(bdc.id) ? [] : [bdc]
            case BDC_TYPE.SECTION:
            case BDC_TYPE.QUESTION:
            case BDC_TYPE.EVALUATION_RESULT:
            case BDC_TYPE.CAROUSEL:
              return []
            default:
              return assertNeverBdc(bdc.type)
          }
      }
    })
  }
}

/** Keeps the bdc type switch exhaustive when the document model grows. */
function assertNeverBdc(value: never): never {
  throw new Error(`Type de bdc inattendu : ${String(value)}`)
}
