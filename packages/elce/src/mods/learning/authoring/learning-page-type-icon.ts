import { PAGE_TYPE, type PageType } from '../learning-definition'
import { DIAPO_PAGE_ICON } from '../../../resources/pages/diapo/diapo-page-icon'
import { FLUX_PAGE_ICON } from '../../../resources/pages/flux/flux-page-icon'

const learningPageTypeIcons: Readonly<Record<PageType, string>> = {
  [PAGE_TYPE.FLUX]: FLUX_PAGE_ICON,
  [PAGE_TYPE.DIAPO]: DIAPO_PAGE_ICON,
}

/** Returns the icon for a page format selected by Learning. */
export function getLearningPageTypeIcon(pageType: PageType): string {
  return learningPageTypeIcons[pageType]
}
