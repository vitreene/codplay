import { AutoCapsule } from '../../capsule-automation/src'
import type { AutoCapsuleChildElementArtifact, AutoCapsuleResult } from '../../capsule-automation/src'
import type { SceneDoc } from '../../player/types'

const CAPSULE_ID = 'carousel'
const CONTAINER_ID = 'carousel-container'
const TOTAL_MS = 6000

const IMAGES: Array<{ id: string; src: string }> = [
  { id: 'carousel-img-a', src: '/assets/35c8ec5a07fc.jpg' },
  { id: 'carousel-img-b', src: '/assets/28970388742_2f75d527d6_z.jpg' },
  { id: 'carousel-img-c', src: '/assets/28999069391_5893263112_z.jpg' },
]

function buildCapsule(): AutoCapsuleResult {
  const cap = new AutoCapsule({
    capsule: {
      id: CAPSULE_ID,
      type: 'carrousel',
      timeRange: { startMs: 0, endMs: TOTAL_MS },
      grid: { mode: 'forced' },
      defaults: {
        introTransitionRef: 'swipe-right',
        outroTransitionRef: 'swipe-left',
      },
    },
    children: IMAGES.map(({ id }, order) => ({ id, order })),
  })
  return cap.resolve()
}

function buildEventimes(result: AutoCapsuleResult): Array<{ name: string; startAt: number }> {
  const seen = new Set<string>()
  const eventimes: Array<{ name: string; startAt: number }> = []
  for (const child of result.children) {
    for (const event of Object.values(child.events)) {
      if (!seen.has(event.name)) {
        seen.add(event.name)
        eventimes.push({ name: event.name, startAt: event.triggerMs })
      }
    }
  }
  return eventimes.sort((a, b) => a.startAt - b.startAt)
}

function buildImageActions(child: AutoCapsuleChildElementArtifact): Record<string, unknown> {
  const actions: Record<string, unknown> = {}
  for (const [action, event] of Object.entries(child.events)) {
    const styleDef = event.definition?.style?.[action]
    if (!styleDef) continue
    const stylePayload: Record<string, unknown> = {}
    for (const [prop, transition] of Object.entries(styleDef)) {
      stylePayload[prop] = { ...(transition as Record<string, unknown>), duration: event.durationMs || 300 }
    }
    actions[event.name] = { style: stylePayload }
  }
  return actions
}

/**
 * Creates a 6-second carousel scene using AutoCapsule for timing and event resolution.
 * Three images fill a 1:1 container (80% of scene width), cross-fading every 2 seconds.
 */
export function createCarouselScene(): SceneDoc {
  const result = buildCapsule()
  const eventimes = buildEventimes(result)

  const persos = [
    {
      id: CONTAINER_ID,
      type: 'list',
      initial: {
        style: {
          width: '80%',
          aspectRatio: '1',
          position: 'relative',
          overflow: 'hidden',
          margin: '0 auto',
          background: '#1a1a2e',
          borderRadius: '16px',
        },
      },
      actions: {},
    },
    ...IMAGES.map(({ id, src }, i) => ({
      id,
      type: 'img',
      initial: {
        src,
        move: { parentId: CONTAINER_ID },
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
        },
        img: { style: { objectFit: 'cover', width: '100%', height: '100%', display: 'block' } },
      },
      actions: buildImageActions(result.children[i]),
    })),
  ]

  return {
    id: 'carousel-scene',
    rootStories: ['carousel-story'],
    stories: {
      'carousel-story': {
        id: 'carousel-story',
        entries: [CONTAINER_ID],
        persos,
        eventimes,
      },
    },
    tracks: {},
  } as unknown as SceneDoc
}
