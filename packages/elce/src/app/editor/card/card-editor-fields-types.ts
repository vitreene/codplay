import type { ReactNode } from 'react'
import type { MediaType } from '../../../config/document-config-types'
import type { Bdc, BdcId } from '../../../domain/document/document-types'
import type { ElceCardEditorActions } from '../../facades/card/card-facade-types'

export interface ElceCardEditorFieldsProps {
  readonly bdc: Bdc
  readonly mediaById: Readonly<Record<string, Readonly<{ name: string; type: MediaType; source: string | null }>>>
  readonly actions: ElceCardEditorActions
  readonly idPrefix: string
  readonly imageAspectRatio: Readonly<{ width: number; height: number }> | null
  readonly allowMultipleMediaFiles?: boolean
  readonly importMediaFiles?: (bdcId: BdcId, files: readonly File[]) => void
  readonly toolbarContent?: ReactNode
  readonly toolbarEnd?: ReactNode
}
