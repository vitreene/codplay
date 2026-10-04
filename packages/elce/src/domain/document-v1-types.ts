import type { Bdc, ElceDocumentData, PageId } from './document-types'

type PersistedBdc = Omit<Bdc, 'question'> & Readonly<{ question?: Bdc['question'] }>

/** Describes the persisted document shape before root entries were ordered together. */
export type ElceDocumentDataV1 = Omit<ElceDocumentData, 'version' | 'scenarioEntries' | 'bdcs'> & Readonly<{
  version: 1
  scenarioPageIds: readonly PageId[]
  bdcs: readonly PersistedBdc[]
}>

export type PersistedElceDocumentDataV2 = Omit<ElceDocumentData, 'bdcs'> & Readonly<{
  bdcs: readonly PersistedBdc[]
}>

/** Covers the persisted document revisions accepted by the current loader. */
export type PersistedElceDocumentData = PersistedElceDocumentDataV2 | ElceDocumentDataV1
