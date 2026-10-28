import type { BdcId } from '../../../../core/document/content-document-types'
import type { BdcPlacement } from '../../../../core/document/content-location'
import type { RevelationTransitionOverrides } from '../../../revelation/revelation-types'
import type { RichTextDocument } from '../domain/section-types'
import { SECTION_BDC_TYPE, SECTION_PRESET_ID } from '../section-config'

/** Commands that author a Section resource. */
export type SectionCommand =
  | Readonly<{ type: 'bdc.create'; bdcId: BdcId; bdcType: typeof SECTION_BDC_TYPE; presetId: typeof SECTION_PRESET_ID; placement: BdcPlacement }>
  | Readonly<{ type: 'bdc.section.update'; bdcId: BdcId; title: string; markup: string; content: RichTextDocument }>
  | Readonly<{ type: 'bdc.section.delete'; bdcId: BdcId }>
  | Readonly<{ type: 'bdc.section.revelation.update'; bdcId: BdcId; revelation: RevelationTransitionOverrides }>
