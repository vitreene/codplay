/** Returns a deterministic internal perso id for one path item's visual child. */
export function motionVisualPersoId(itemId: string, reservedIds: ReadonlySet<string>): string {
  const base = `__editor_motion_visual_${encodeURIComponent(itemId)}`
  let candidate = base
  let suffix = 1
  while (reservedIds.has(candidate)) candidate = `${base}_${suffix++}`
  return candidate
}
