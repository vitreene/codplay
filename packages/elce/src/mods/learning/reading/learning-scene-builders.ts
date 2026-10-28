import { ElceCardPresetBuilder } from '../../../core/presets/card-preset-builder'
import { LEARNING_PRESETS } from '../learning-presets'
import { ElceCardBdcSceneBuilder } from '../../../resources/bdcs/card/reading/card-bdc-scene-builder'
import { ElceCarouselSceneBuilder } from '../../../resources/bdcs/carousel/reading/carousel-scene-builder'

/** Creates the scene builders configured with Learning's selected presets. */
export function createLearningSceneBuilders() {
  const presetBuilder = new ElceCardPresetBuilder(LEARNING_PRESETS)
  const cardBdcSceneBuilder = new ElceCardBdcSceneBuilder(presetBuilder)
  const carouselSceneBuilder = new ElceCarouselSceneBuilder(presetBuilder, cardBdcSceneBuilder)

  return { presetBuilder, cardBdcSceneBuilder, carouselSceneBuilder }
}
