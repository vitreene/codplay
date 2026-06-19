import { createCarouselScene } from '../scenes/carousel-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/**
 * Carousel demo: three images cross-fading every 2 seconds over 6 seconds total.
 * Timing and event names are derived from AutoCapsule (type carrousel, distributed mode).
 */
export async function runCarouselDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: 'Carrousel',
    subtitle: '3 images défilant en fondu toutes les 2s — 6s au total. Timing résolu par AutoCapsule.',
    scene: createCarouselScene(),
    activeDemo: 'carousel',
  })
}
