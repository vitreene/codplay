import type { CodPlayEngineOptions } from 'codplay'
import {
  TagComponent, ImageComponent, MediaComponent,
  sanitizeTagInitial, validateTagInitial, validateTagAction,
  validateImageInitial, validateImageAction, validateMediaInitial, validateMediaAction,
} from 'codplay/runtime/components'
import { createItemComponent } from './item-component'

const ItemTag = createItemComponent(TagComponent)
const ItemImage = createItemComponent(ImageComponent)
const ItemMedia = createItemComponent(MediaComponent)

/** Editor-scoped composition of native components; other CodPlay owners keep their own catalog. */
export const EDITOR_ENGINE_OPTIONS = {
  components: {
    override: [
      {
        type: 'tag', component: ItemTag, modules: ['replace-text'],
        sanitizeInitial: sanitizeTagInitial, validateInitial: validateTagInitial, validateAction: validateTagAction,
      },
      {
        type: 'img', component: ItemImage, modules: ['replace-media'],
        validateInitial: validateImageInitial, validateAction: validateImageAction,
      },
      {
        type: 'media', component: ItemMedia, modules: ['media-sync', 'replace-media'],
        validateInitial: validateMediaInitial, validateAction: validateMediaAction,
        surfaces: (component) => component instanceof ItemMedia && component.native instanceof MediaComponent
          ? { media: component.native }
          : {},
      },
    ],
  },
} satisfies CodPlayEngineOptions
