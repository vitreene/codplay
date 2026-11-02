import type { BdcId, PageId } from '../../core/document/content-document-types'
import type { AppearanceSettings } from '../../config/appearance/appearance-types'

/** Identifies the document layer that receives an appearance command. */
export type AppearanceTarget =
  | Readonly<{ kind: 'document' }>
  | Readonly<{ kind: 'page'; pageId: PageId }>
  | Readonly<{ kind: 'bdc'; bdcId: BdcId }>

export type AppearanceProperty = keyof AppearanceSettings

export type AppearanceTargetForProperty<Property extends AppearanceProperty> = Property extends 'presetId'
  ? Extract<AppearanceTarget, Readonly<{ kind: 'document' }>>
  : AppearanceTarget
