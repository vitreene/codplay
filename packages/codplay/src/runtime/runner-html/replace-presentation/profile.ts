import type {
  ReplaceCellGridSettings,
  ReplaceMediaPresentationProfile,
  ReplaceMotionProfile,
  ReplaceStaggerPattern,
  ReplaceTransition,
  SlotReplaceProfile,
  SlotReplaceShape,
} from '../../components'



export type HtmlReplaceProfile = Readonly<{
  transition: string
  duration?: number
  shape?: SlotReplaceShape
  clipToSlot: boolean
  motion?: ReplaceMotionProfile
  mediaCells?: MediaCellRequest
  freezeMedia: boolean
}>

/** Author-supplied cell sizing retained until the media box is measured. */
export type MediaCellRequest = ReplaceCellGridSettings

/** One grid configuration shared by the SVG masks and ticker sampling. */
export type ResolvedMediaCellSettings = Readonly<{
  columns: number
  rows: number
  stagger?: number
  staggerPattern?: ReplaceStaggerPattern
  direction?: ReplaceMotionProfile['direction']
}>


/** Converts the simple media shorthand to the common profile shape. */
export function normalizeProfile(
  profile: ReplaceTransition | SlotReplaceProfile | ReplaceMediaPresentationProfile | ReplaceMotionProfile,
): HtmlReplaceProfile {
  if (typeof profile === 'string') return { transition: profile, clipToSlot: false, freezeMedia: false }
  if ('intro' in profile && 'outro' in profile) {
    return {
      transition: profile.transition,
      duration: profile.duration,
      shape: profile.shape,
      clipToSlot: false,
      motion: profile,
      freezeMedia: profile.freezeMedia === true,
      ...(profile.split === 'cells' ? { mediaCells: toMediaCellSettings(profile) } : {}),
    }
  }
  if ('freezeMedia' in profile && profile.freezeMedia === true) {
    return {
      transition: profile.transition,
      duration: profile.duration,
      shape: profile.shape,
      clipToSlot: false,
      freezeMedia: true,
      ...(profile.split === 'cells' ? { mediaCells: toMediaCellSettings(profile) } : {}),
    }
  }
  return {
    transition: profile.transition,
    duration: profile.duration,
    shape: profile.shape,
    clipToSlot: true,
    freezeMedia: false,
    ...(profile.split === 'cells' ? { mediaCells: toMediaCellSettings(profile) } : {}),
  }
}


/** Converts the media profile's cell fields to the shared grid settings. */
export function toMediaCellSettings(
  profile: SlotReplaceProfile | ReplaceMotionProfile | ReplaceMediaPresentationProfile,
): MediaCellRequest | undefined {
  if (profile.split !== 'cells') return undefined
  return {
    ...(profile.cellSize === undefined ? {} : { cellSize: profile.cellSize }),
    ...(profile.cellX === undefined ? {} : { cellX: profile.cellX }),
    ...(profile.cellY === undefined ? {} : { cellY: profile.cellY }),
    ...(profile.stagger === undefined ? {} : { stagger: profile.stagger }),
    ...(profile.staggerPattern === undefined ? {} : { staggerPattern: profile.staggerPattern }),
    ...(profile.direction === undefined ? {} : { direction: profile.direction }),
  }
}

/** Resolves responsive cell sizing and axis counts to one measured media grid. */
export function resolveMediaCellSettings(
  request: MediaCellRequest,
  width: number,
  height: number,
): ResolvedMediaCellSettings {
  const mediaWidth = Number.isFinite(width) && width > 0 ? width : 1
  const mediaHeight = Number.isFinite(height) && height > 0 ? height : 1
  let columns: number
  let rows: number

  if (request.cellSize !== undefined) {
    const cellSizePx = mediaWidth * request.cellSize / 100
    if (Number.isFinite(cellSizePx) && cellSizePx > 0) {
      columns = Math.max(1, Math.ceil(mediaWidth / cellSizePx))
      rows = Math.max(1, Math.ceil(mediaHeight / cellSizePx))
    } else {
      columns = 4
      rows = 3
    }
  } else if (request.cellX !== undefined && request.cellY !== undefined) {
    columns = request.cellX
    rows = request.cellY
  } else if (request.cellX !== undefined) {
    columns = request.cellX
    rows = Math.max(1, Math.ceil(mediaHeight / (mediaWidth / columns)))
  } else if (request.cellY !== undefined) {
    rows = request.cellY
    columns = Math.max(1, Math.ceil(mediaWidth / (mediaHeight / rows)))
  } else {
    columns = 4
    rows = 3
  }

  return {
    columns,
    rows,
    ...(request.stagger === undefined ? {} : { stagger: request.stagger }),
    ...(request.staggerPattern === undefined ? {} : { staggerPattern: request.staggerPattern }),
    ...(request.direction === undefined ? {} : { direction: request.direction }),
  }
}
