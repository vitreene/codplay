/** Stable placement states produced before hierarchy and substrate projection. */
export const MOUNT_PLACEMENT_UNSPECIFIED = 'unspecified' as const
export const MOUNT_PLACEMENT_ROOT = 'root' as const
export const MOUNT_PLACEMENT_OFF = 'off' as const
export const MOUNT_PLACEMENT_PARENT = 'parent' as const
export const MOUNT_PLACEMENT_INVALID = 'invalid' as const

export type MountPlacementKind =
  | typeof MOUNT_PLACEMENT_UNSPECIFIED
  | typeof MOUNT_PLACEMENT_ROOT
  | typeof MOUNT_PLACEMENT_OFF
  | typeof MOUNT_PLACEMENT_PARENT
  | typeof MOUNT_PLACEMENT_INVALID
