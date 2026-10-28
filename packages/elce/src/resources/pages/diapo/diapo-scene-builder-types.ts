import type { SceneDoc } from 'codplay/scene/types'
import type { MediaId } from '../../../core/document/content-document-types'
import type { ElceResolvedPageSettings } from '../../../domain/editor-settings/editor-settings-types'
import type { MediaType } from '../../../core/media/media-config'
import type { AppearanceClassNamesByTarget } from '../../../builders/scene-style/appearance-class-names'
import type { ElceCardPresetBuilder } from '../../../core/presets/card-preset-builder'
import type { ElceCardBdcSceneBuilder } from '../../bdcs/card/reading/card-bdc-scene-builder'
import type { ElceCarouselSceneBuilder } from '../../bdcs/carousel/reading/carousel-scene-builder'
import type { BuildAdditionalBdc } from '../additional-bdc-types'

export interface DiapoQuestionReset {
  readonly eventName: string
}

export type DiapoSceneBuildOptions = Readonly<{
  readonly mediaSources?: Readonly<Record<MediaId, string>>
  readonly mediaTypes?: Readonly<Record<MediaId, MediaType>>
  readonly editorSettings: ElceResolvedPageSettings
  readonly appearanceClassNamesByTarget?: AppearanceClassNamesByTarget
  readonly presetBuilder: ElceCardPresetBuilder
  readonly cardBdcSceneBuilder: ElceCardBdcSceneBuilder
  readonly carouselSceneBuilder: ElceCarouselSceneBuilder
  readonly buildAdditionalBdc?: BuildAdditionalBdc
}>

export interface DiapoSceneBuild {
  readonly sceneDoc: SceneDoc<string>
  readonly styleSheets: readonly string[]
  readonly questionReset?: DiapoQuestionReset
}
