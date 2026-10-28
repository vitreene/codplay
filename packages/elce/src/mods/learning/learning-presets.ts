import type { CardPreset } from '../../core/presets/card-preset-types'
import { ElceCardPresetBuilder } from '../../core/presets/card-preset-builder'
import { CARD_PRESETS } from '../../resources/bdcs/card/card-presets'
import { CAROUSEL_PRESETS } from '../../resources/bdcs/carousel/carousel-presets'
import { QUESTION_PRESETS } from '../../resources/bdcs/question/question-presets'
import { SECTION_PRESETS } from '../../resources/bdcs/section/section-presets'
import { LEARNING_EVALUATION_PRESETS } from './evaluation/learning-presets'

export const LEARNING_PRESETS: Readonly<Record<string, CardPreset>> = {
  ...CAROUSEL_PRESETS,
  ...SECTION_PRESETS,
  ...QUESTION_PRESETS,
  ...LEARNING_EVALUATION_PRESETS,
  ...CARD_PRESETS,
}

/** Creates a preset engine configured with the resources selected by Learning. */
export function createLearningPresetBuilder(): ElceCardPresetBuilder {
  return new ElceCardPresetBuilder(LEARNING_PRESETS)
}
