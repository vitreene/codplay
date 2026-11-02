import { SCENARIO_ENTRY_KIND } from './learning-organization-config'
import type { ChapterId, PageId } from '../../../core/document/content-document-types'

/** Identifies one ordered root-level page or chapter in an Elce scenario. */
export type ScenarioEntry =
  | Readonly<{ kind: typeof SCENARIO_ENTRY_KIND.PAGE; pageId: PageId }>
  | Readonly<{ kind: typeof SCENARIO_ENTRY_KIND.CHAPTER; chapterId: ChapterId }>
