import { createRiveTalkingAvatarStory } from '@codplay/story/rive-talking-avatar'
import type { StoryDoc } from 'codplay/scene/types'
import type { ResourceBdc } from '../../../document/resource-document-types'
import { PAGE_FINISHED_EVENT } from '../../../pages/page-completion/page-completion-events'
import { mattAvatarProfile } from './avatar-profile'

// Fractions measured from the painted bounds of the supplied transparent rig.
const avatarPaintedInsets = { left: 29.76, top: 25.8, right: 27.14, bottom: 23.2 } as const

/** Composes the authored Avatar into the page story using the existing voice-master factory. */
export function appendAvatarToDiapoStory(story: StoryDoc<string>, pageId: string, rootId: string, bdc: ResourceBdc, audioSource: string, appearanceClass: string): StoryDoc<string> {
  const avatar = bdc.avatar
  if (avatar?.take == null) throw new Error('La prise de l’Avatar est absente.')
  const { placement, take } = avatar
  const left = placement.position.endsWith('left')
  const top = placement.position.startsWith('top')
  const artworkOffsetXPercent = left ? -avatarPaintedInsets.left : avatarPaintedInsets.right
  const artworkOffsetYPercent = top ? -avatarPaintedInsets.top : avatarPaintedInsets.bottom
  const avatarStory = createRiveTalkingAvatarStory({
    id: `rive-talking-avatar-${bdc.id}`,
    profile: mattAvatarProfile,
    voice: { src: audioSource, durationMs: take.durationMs },
    frames: take.frames,
    frame: {
      move: { target: rootId },
      className: appearanceClass,
      style: {
        gridArea: '1 / 1',
        justifySelf: left ? 'start' : 'end',
        alignSelf: top ? 'start' : 'end',
        marginLeft: left ? '16px' : '0',
        marginRight: left ? '0' : '16px',
        marginTop: top ? '16px' : '0',
        marginBottom: top ? '0' : '16px',
        transform: `translate(${artworkOffsetXPercent}%, ${artworkOffsetYPercent}%)`,
        width: `min(${placement.widthPercent}cqw, 75.6cqh)`,
        maxWidth: '100%',
        aspectRatio: '420 / 500',
        overflow: 'hidden',
        zIndex: 3,
        pointerEvents: 'none',
      },
    },
  })
  return {
    ...story,
    persos: [
      ...(story.persos ?? []),
      ...(avatarStory.persos ?? []),
    ],
    listen: [...(story.listen ?? []), { on: 'sequence:end', emit: [{ name: PAGE_FINISHED_EVENT, visibility: 'public', data: { pageId } }] }],
    eventimes: [...(story.eventimes ?? []), ...(avatarStory.eventimes ?? []), { name: 'sequence:end', startAt: take.durationMs }],
  }
}
