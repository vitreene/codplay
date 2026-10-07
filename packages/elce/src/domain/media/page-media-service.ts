import { BDC_TYPE } from '../../config/document-config'
import type { ElceDocument } from '../document/document-model'
import type { Bdc, Page } from '../document/document-types'

/** Finds media Cards placed directly in a page rather than inside a Section or Carousel. */
export class ElcePageMediaService {
  /** Returns direct Cards that reference reusable media. */
  public unanchoredMediaBdcs(document: ElceDocument, page: Page): readonly Bdc[] {
    return page.bdcIds.flatMap((bdcId) => {
      const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
      switch (bdc) {
        case undefined:
          return []
        default:
          switch (bdc.type) {
            case BDC_TYPE.CARD:
              return bdc.card?.mediaId == null ? [] : [bdc]
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
