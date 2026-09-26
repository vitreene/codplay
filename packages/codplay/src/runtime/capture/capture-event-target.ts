import type { EventVisibility } from '../../scene/capture/authoring-types'

/** Resolves capture visibility to the existing story or global event target. */
export function resolveCaptureEventTarget(
  event: Readonly<{ visibility?: EventVisibility }>,
  storyId: string,
): Readonly<{ storyId?: string; visibility?: EventVisibility }> {
  if (event.visibility === 'scene' || event.visibility === 'public') {
    return { visibility: event.visibility }
  }
  return {
    storyId,
    ...(event.visibility === undefined ? {} : { visibility: event.visibility }),
  }
}
