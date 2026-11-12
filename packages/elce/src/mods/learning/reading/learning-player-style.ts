import { LEARNING_LAYOUT_STYLE_RULES } from './learning-layout-style'
import { LEARNING_NAVIGATION_REMOTE_STYLE } from './navigation-remote/learning-navigation-remote-style'
import { FLUX_PLAYER_STYLE_RULES } from '../../../resources/pages/flux/reading/flux-player-style'
import { DIAPO_PLAYER_STYLE_RULES } from '../../../resources/pages/diapo/reading/diapo-player-style'
import { CARD_PLAYER_STYLE_RULES } from '../../../resources/bdcs/card/reading/card-player-style'
import { CAROUSEL_PLAYER_STYLE_RULES } from '../../../resources/bdcs/carousel/reading/carousel-player-style'
import { QUESTION_PLAYER_STYLE_RULES } from '../../../resources/bdcs/question/reading/question-player-style'
import { PAGE_COMPLETION_PLAYER_STYLE_RULES } from '../../../resources/pages/page-completion/reading/page-completion-player-style'
import { STATISTICAL_GRAPH_PLAYER_STYLE_RULES } from '../../../resources/bdcs/statistical-graph/reading/statistical-graph-player-style'
import { LEARNING_INLINE_TEXT_STYLE_RULES } from '../inline-text/learning-inline-text-style'

const PLAYER_STYLE_RULES = [
  ...LEARNING_LAYOUT_STYLE_RULES,
  ...FLUX_PLAYER_STYLE_RULES,
  ...DIAPO_PLAYER_STYLE_RULES,
  ...CARD_PLAYER_STYLE_RULES,
  ...CAROUSEL_PLAYER_STYLE_RULES,
  ...QUESTION_PLAYER_STYLE_RULES,
  ...PAGE_COMPLETION_PLAYER_STYLE_RULES,
  ...LEARNING_INLINE_TEXT_STYLE_RULES,
  ...STATISTICAL_GRAPH_PLAYER_STYLE_RULES,
].sort(([left], [right]) => left - right)

/** Reassembles the original layout and resource rules in their authored cascade order. */
export const LEARNING_PLAYER_STYLE_SHEET = `${PLAYER_STYLE_RULES.map(([, cssText]) => cssText).join('')}\n${LEARNING_NAVIGATION_REMOTE_STYLE}`

/** Returns the Learning-owned layout and resource style sheet. */
export function createLearningPlayerStyleSheet(): string {
  return LEARNING_PLAYER_STYLE_SHEET
}
