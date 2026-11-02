import { ElceCardPresetBuilder } from '../../../core/presets/card-preset-builder'
import { LEARNING_PRESETS } from '../learning-presets'
import { ElceCardBdcSceneBuilder } from '../../../resources/bdcs/card/reading/card-bdc-scene-builder'
import { ElceCarouselSceneBuilder } from '../../../resources/bdcs/carousel/reading/carousel-scene-builder'
import { createLearningInlineTextSceneFeature } from '../inline-text/learning-inline-text-scene'

/** Creates the scene builders configured with Learning's selected presets. */
export function createLearningSceneBuilders() {
  const presetBuilder = new ElceCardPresetBuilder(LEARNING_PRESETS)
  const inlineTextSceneFeature = createLearningInlineTextSceneFeature()
  const cardBdcSceneBuilder = new ElceCardBdcSceneBuilder(presetBuilder, inlineTextSceneFeature)
  const carouselSceneBuilder = new ElceCarouselSceneBuilder(presetBuilder, cardBdcSceneBuilder, inlineTextSceneFeature)

  return { presetBuilder, cardBdcSceneBuilder, carouselSceneBuilder, inlineTextSceneFeature }
}
