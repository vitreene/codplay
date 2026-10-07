import { SCENARIO_ENTRY_KIND } from '../../config/document-config'
import type { ChapterId, PageId } from '../document/document-types'

/** Identifies one ordered root-level page or chapter in an Elce scenario. */
export type ScenarioEntry =
  | Readonly<{ kind: typeof SCENARIO_ENTRY_KIND.PAGE; pageId: PageId }>
  | Readonly<{ kind: typeof SCENARIO_ENTRY_KIND.CHAPTER; chapterId: ChapterId }>
