import type { BdcPlacement } from '../../../../core/document/content-location'
import type { MediaMetadata } from '../../../../core/document/content-document-types'
import type { AvatarContent, AvatarTake } from '../domain/avatar-types'
import type { AVATAR_BDC_TYPE, AVATAR_PRESET_ID } from '../avatar-config'

/** Authors Avatar placement, settings and complete takes through the document controller. */
export type AvatarCommand =
  | Readonly<{ type: 'bdc.create'; bdcId: string; bdcType: typeof AVATAR_BDC_TYPE; presetId: typeof AVATAR_PRESET_ID; placement: BdcPlacement }>
  | Readonly<{ type: 'bdc.avatar.update'; bdcId: string; avatar: AvatarContent }>
  | Readonly<{ type: 'bdc.avatar.take.set'; bdcId: string; take: AvatarTake; media?: MediaMetadata }>
  | Readonly<{ type: 'bdc.avatar.delete'; bdcId: string }>
  | Readonly<{ type: 'bdc.carousel.word.set'; bdcId: string; cardBdcId: string; avatarBdcId: string; wordIndex: number }>
