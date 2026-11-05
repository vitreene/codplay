import { createRiveTalkingAvatarStory } from '@codplay/story/rive-talking-avatar'
import type { StoryDoc } from 'codplay/scene/types'
import type { ResourceBdc } from '../../../document/resource-document-types'
import { PAGE_FINISHED_EVENT } from '../../../pages/page-completion/page-completion-events'
import { mattAvatarProfile } from './avatar-profile'

/** Composes the authored Avatar into the page story using the existing voice-master factory. */
export function appendAvatarToDiapoStory(story: StoryDoc<string>, pageId: string, rootId: string, bdc: ResourceBdc, audioSource: string, appearanceClass: string): StoryDoc<string> {
  const avatar = bdc.avatar
  if (avatar?.take == null) throw new Error('La prise de l’Avatar est absente.')
  const { placement, take } = avatar
  const left = placement.position.endsWith('left')
  const top = placement.position.startsWith('top')
  const avatarStory = createRiveTalkingAvatarStory({
    id: `rive-talking-avatar-${bdc.id}`,
    profile: mattAvatarProfile,
    voice: { src: audioSource, durationMs: take.durationMs },
    frames: take.frames,
    frame: {
      move: { target: rootId },
      className: appearanceClass,
      style: {
        position: 'absolute', [left ? 'left' : 'right']: '2cqw', [top ? 'top' : 'bottom']: '2cqw',
        width: `${placement.widthPercent}cqw`, maxHeight: '90cqh', aspectRatio: '420 / 500',
        overflow: 'hidden', zIndex: 3, pointerEvents: 'none',
      },
    },
  })
  return {
    ...story,
    persos: [
      ...(story.persos ?? []).map((perso) => perso.id !== rootId ? perso : {
        ...perso,
        initial: { ...perso.initial, style: { [left ? 'paddingLeft' : 'paddingRight']: `${placement.widthPercent + 4}cqw`, boxSizing: 'border-box' } },
      }),
      ...(avatarStory.persos ?? []),
    ],
    listen: [...(story.listen ?? []), { on: 'sequence:end', emit: [{ name: PAGE_FINISHED_EVENT, visibility: 'public', data: { pageId } }] }],
    eventimes: [...(story.eventimes ?? []), ...(avatarStory.eventimes ?? []), { name: 'sequence:end', startAt: take.durationMs }],
  }
}
