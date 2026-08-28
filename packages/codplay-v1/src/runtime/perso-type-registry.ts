import type { ImgAction, ImgInitial } from './components/image-component'
import type { InputAction, InputInitial } from './components/input-component'
import type { LayoutAction, LayoutInitial } from './components/layout-component'
import type { ListAction, ListInitial } from './components/list-component'
import type { MediaAction, MediaInitial } from './components/media-component'
import type { PolygonAction, PolygonInitial } from './components/polygon-types'
import type { TagAction, TagInitial } from './components/tag-component'
import type { TextAction, TextInitial } from './components/text-component'

export interface PersoTypeRegistry {
  tag: { initial: TagInitial; action: TagAction }
  text: { initial: TextInitial; action: TextAction }
  img: { initial: ImgInitial; action: ImgAction }
  input: { initial: InputInitial; action: InputAction }
  media: { initial: MediaInitial; action: MediaAction }
  list: { initial: ListInitial; action: ListAction }
  layout: { initial: LayoutInitial; action: LayoutAction }
  polygon: { initial: PolygonInitial; action: PolygonAction }
}

export type CorePersoType = keyof PersoTypeRegistry
