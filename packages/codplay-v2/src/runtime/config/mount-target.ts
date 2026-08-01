/** Internal kinds used to identify one logical mount target. */
export const MOUNT_TARGET_KIND_ROOT = 'root' as const
export const MOUNT_TARGET_KIND_HOST = 'host' as const
export const MOUNT_TARGET_KIND_OUTLET = 'outlet' as const
export const MOUNT_TARGET_KIND_PERSO = 'perso' as const

export type MountTargetKind =
  | typeof MOUNT_TARGET_KIND_ROOT
  | typeof MOUNT_TARGET_KIND_HOST
  | typeof MOUNT_TARGET_KIND_OUTLET
  | typeof MOUNT_TARGET_KIND_PERSO
