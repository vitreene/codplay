import { FilePlus, Presentation } from 'lucide-static'

import { PAGE_TYPE } from '../../../config/document-config'
import type { PageType } from '../../../config/document-config-types'

const pageTypeIcons: Record<PageType, string> = {
  [PAGE_TYPE.FLUX]: FilePlus,
  [PAGE_TYPE.DIAPO]: Presentation,
}

/** Returns the icon already used to create a page of the requested type. */
export function getPageTypeIcon(pageType: PageType): string {
  return pageTypeIcons[pageType]
}
