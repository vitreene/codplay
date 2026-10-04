import {
  CAROUSEL_CONFIG,
  DEFAULT_PRESET_ID,
} from '../config/document-config'
import type { CarouselCardPresetId, CarouselImagePosition, CarouselPlaybackMode, CarouselTransition } from '../config/document-config-types'
import { createStableId } from './document-model'
import type { CarouselContent, CarouselShortText, CarouselView, CarouselViewContent } from './carousel-types'

const EMPTY_SHORT_TEXT: CarouselShortText = {
  overline: '',
  title: '',
  description: '',
  message: '',
  note: '',
}

/** Owns Carousel BDC defaults, card changes, and content invariants. */
export class ElceCarouselService {
  /** Creates the initial Carousel with one empty Text-short view. */
  public createDefault(): CarouselContent {
    const defaultView = this.createView(CAROUSEL_CONFIG.initialViewPresetId)
    return {
      defaultViewDurationMs: CAROUSEL_CONFIG.defaultViewDurationMs,
      playbackMode: CAROUSEL_CONFIG.defaultPlaybackMode,
      repeatCount: CAROUSEL_CONFIG.defaultRepeatCount,
      aspectRatio: CAROUSEL_CONFIG.defaultAspectRatio,
      transition: CAROUSEL_CONFIG.defaultTransition,
      views: [defaultView],
    }
  }

  /** Creates an empty view from one supported card preset. */
  public createView(presetId: CarouselCardPresetId): CarouselView {
    const content = this.emptyContentFor(presetId)
    return { id: createStableId('carousel-view'), durationMs: null, ...content } as CarouselView
  }

  /** Adds one empty Text-short view. */
  public addView(content: CarouselContent): CarouselContent {
    return { ...content, views: [...content.views, this.createView(CAROUSEL_CONFIG.initialViewPresetId)] }
  }

  /** Removes a view while leaving other authored views intact. */
  public removeView(content: CarouselContent, viewId: string): CarouselContent {
    return { ...content, views: content.views.filter((view) => view.id !== viewId) }
  }

  /** Reorders one view before the requested list index. */
  public moveView(content: CarouselContent, viewId: string, index: number): CarouselContent {
    const sourceIndex = content.views.findIndex((view) => view.id === viewId)
    if (sourceIndex < 0) return content
    const views = [...content.views]
    const [view] = views.splice(sourceIndex, 1)
    if (view === undefined) return content
    views.splice(Math.max(0, Math.min(index, views.length)), 0, view)
    return { ...content, views }
  }

  /** Changes a view's card while preserving values supported by both presets. */
  public changeViewPreset(content: CarouselContent, viewId: string, presetId: CarouselCardPresetId): CarouselContent {
    return this.updateView(content, viewId, (view) => this.changeViewContent(view, presetId))
  }

  /** Changes the shared automatic duration used by views without an override. */
  public setDefaultViewDuration(content: CarouselContent, durationMs: number): CarouselContent {
    return { ...content, defaultViewDurationMs: durationMs }
  }

  /** Sets or clears one view's duration override. */
  public setViewDuration(content: CarouselContent, viewId: string, durationMs: number | null): CarouselContent {
    return this.updateView(content, viewId, (view) => ({ ...view, durationMs }))
  }

  /** Switches between automatic and point-controlled playback. */
  public setPlaybackMode(content: CarouselContent, playbackMode: CarouselPlaybackMode): CarouselContent {
    return { ...content, playbackMode }
  }

  /** Sets the finite number of additional automatic Carousel passes. */
  public setRepeatCount(content: CarouselContent, repeatCount: number): CarouselContent {
    return { ...content, repeatCount }
  }

  /** Updates the Carousel frame ratio without changing its view content. */
  public setAspectRatio(content: CarouselContent, aspectRatio: CarouselContent['aspectRatio']): CarouselContent {
    return { ...content, aspectRatio }
  }

  /** Changes image placement for one Text-image view. */
  public setImagePosition(content: CarouselContent, viewId: string, imagePosition: CarouselImagePosition): CarouselContent {
    return this.updateView(content, viewId, (view) => {
      switch (view.presetId) {
        case DEFAULT_PRESET_ID.TEXT_IMAGE:
          return { ...view, imagePosition }
        default:
          return view
      }
    })
  }

  /** Changes the transition preset used by the generated capsule. */
  public setTransition(content: CarouselContent, transition: CarouselTransition): CarouselContent {
    return { ...content, transition }
  }

  /** Edits one field in the selected Text-short view. */
  public setShortText(content: CarouselContent, viewId: string, field: keyof CarouselShortText, value: string): CarouselContent {
    return this.updateView(content, viewId, (view) => {
      switch (view.presetId) {
        case DEFAULT_PRESET_ID.TEXT_SHORT:
        case DEFAULT_PRESET_ID.TEXT_IMAGE:
          return { ...view, text: { ...view.text, [field]: value } }
        default:
          return view
      }
    })
  }

  /** Edits the optional caption on an Image-caption view. */
  public setCaption(content: CarouselContent, viewId: string, caption: string): CarouselContent {
    return this.updateView(content, viewId, (view) => {
      switch (view.presetId) {
        case DEFAULT_PRESET_ID.IMAGE_CAPTION:
          return { ...view, text: { caption } }
        default:
          return view
      }
    })
  }

  /** Assigns a reusable catalog media resource to a media-capable view. */
  public setMedia(content: CarouselContent, viewId: string, mediaId: string | null): CarouselContent {
    return this.updateView(content, viewId, (view) => {
      switch (view.presetId) {
        case DEFAULT_PRESET_ID.PHOTO:
        case DEFAULT_PRESET_ID.IMAGE_CAPTION:
        case DEFAULT_PRESET_ID.TEXT_IMAGE:
          return { ...view, mediaId } as CarouselView
        case DEFAULT_PRESET_ID.TEXT_SHORT:
          throw new Error(`La vue Texte court ${viewId} n’accepte pas de média.`)
      }
    })
  }

  /** Rebinds view references when duplicate catalogue media are merged. */
  public replaceMediaReference(content: CarouselContent, oldMediaId: string, newMediaId: string): CarouselContent {
    return {
      ...content,
      views: content.views.map((view) => view.mediaId === oldMediaId ? { ...view, mediaId: newMediaId } : view),
    }
  }

  /** Validates Carousel values before they enter the persisted document. */
  public assertValid(content: CarouselContent): void {
    switch (content.views.length > 0) {
      case true:
        break
      case false:
        throw new Error('Un BDC Carousel doit conserver au moins une vue.')
    }
    if (!Number.isFinite(content.defaultViewDurationMs) || content.defaultViewDurationMs <= 0) {
      throw new Error('La durée par défaut d’une vue Carousel doit être positive.')
    }
    const repeatCount = content.repeatCount ?? CAROUSEL_CONFIG.defaultRepeatCount
    if (!Number.isInteger(repeatCount)
      || repeatCount < CAROUSEL_CONFIG.minimumRepeatCount
      || repeatCount > CAROUSEL_CONFIG.maximumRepeatCount) {
      throw new Error(`Le nombre de répétitions Carousel doit être compris entre ${CAROUSEL_CONFIG.minimumRepeatCount} et ${CAROUSEL_CONFIG.maximumRepeatCount}.`)
    }
    if (!Number.isFinite(content.aspectRatio.width) || !Number.isFinite(content.aspectRatio.height)
      || content.aspectRatio.width <= 0 || content.aspectRatio.height <= 0) {
      throw new Error('Le ratio du Carousel doit avoir deux valeurs positives.')
    }
    if (new Set(content.views.map((view) => view.id)).size !== content.views.length) {
      throw new Error('Les vues d’un Carousel doivent avoir des identifiants uniques.')
    }
    for (const view of content.views) {
      if (view.durationMs !== null && (!Number.isFinite(view.durationMs) || view.durationMs <= 0)) {
        throw new Error(`La durée de la vue ${view.id} doit être positive.`)
      }
      if ((view.presetId === DEFAULT_PRESET_ID.TEXT_SHORT || view.presetId === DEFAULT_PRESET_ID.TEXT_IMAGE)
        && view.text.message.length > CAROUSEL_CONFIG.textShortMessageMaxLength) {
        throw new Error(`Le message d’une vue Texte court est limité à ${CAROUSEL_CONFIG.textShortMessageMaxLength} caractères.`)
      }
    }
  }

  private emptyContentFor(presetId: CarouselCardPresetId): CarouselViewContent {
    switch (presetId) {
      case DEFAULT_PRESET_ID.TEXT_SHORT:
        return { presetId, text: { ...EMPTY_SHORT_TEXT }, mediaId: null }
      case DEFAULT_PRESET_ID.TEXT_IMAGE:
        return { presetId, text: { ...EMPTY_SHORT_TEXT }, mediaId: null, imagePosition: CAROUSEL_CONFIG.defaultImagePosition }
      case DEFAULT_PRESET_ID.PHOTO:
        return { presetId, text: null, mediaId: null }
      case DEFAULT_PRESET_ID.IMAGE_CAPTION:
        return { presetId, text: { caption: '' }, mediaId: null }
    }
  }

  /** Carries only fields accepted by both the current and selected card presets. */
  private changeViewContent(view: CarouselView, presetId: CarouselCardPresetId): CarouselView {
    const identity = { id: view.id, durationMs: view.durationMs }
    switch (presetId) {
      case DEFAULT_PRESET_ID.TEXT_SHORT:
        switch (view.presetId) {
          case DEFAULT_PRESET_ID.TEXT_SHORT:
            return view
          case DEFAULT_PRESET_ID.TEXT_IMAGE:
            return { ...identity, presetId, text: view.text, mediaId: view.mediaId }
          case DEFAULT_PRESET_ID.PHOTO:
          case DEFAULT_PRESET_ID.IMAGE_CAPTION:
            return { ...identity, presetId, text: { ...EMPTY_SHORT_TEXT }, mediaId: view.mediaId }
        }
      case DEFAULT_PRESET_ID.TEXT_IMAGE:
        switch (view.presetId) {
          case DEFAULT_PRESET_ID.TEXT_SHORT:
            return {
              ...identity,
              presetId,
              text: view.text,
              mediaId: view.mediaId,
              imagePosition: CAROUSEL_CONFIG.defaultImagePosition,
            }
          case DEFAULT_PRESET_ID.PHOTO:
          case DEFAULT_PRESET_ID.IMAGE_CAPTION:
            return {
              ...identity,
              presetId,
              text: { ...EMPTY_SHORT_TEXT },
              mediaId: view.mediaId,
              imagePosition: CAROUSEL_CONFIG.defaultImagePosition,
            }
          case DEFAULT_PRESET_ID.TEXT_IMAGE:
            return view
        }
      case DEFAULT_PRESET_ID.PHOTO:
        switch (view.presetId) {
          case DEFAULT_PRESET_ID.TEXT_SHORT:
            return { ...identity, presetId, text: null, mediaId: view.mediaId }
          case DEFAULT_PRESET_ID.IMAGE_CAPTION:
          case DEFAULT_PRESET_ID.TEXT_IMAGE:
            return { ...identity, presetId, text: null, mediaId: view.mediaId }
          case DEFAULT_PRESET_ID.PHOTO:
            return view
        }
      case DEFAULT_PRESET_ID.IMAGE_CAPTION:
        switch (view.presetId) {
          case DEFAULT_PRESET_ID.TEXT_SHORT:
            return { ...identity, presetId, text: { caption: '' }, mediaId: view.mediaId }
          case DEFAULT_PRESET_ID.PHOTO:
          case DEFAULT_PRESET_ID.TEXT_IMAGE:
            return { ...identity, presetId, text: { caption: '' }, mediaId: view.mediaId }
          case DEFAULT_PRESET_ID.IMAGE_CAPTION:
            return view
        }
    }
  }

  private updateView(
    content: CarouselContent,
    viewId: string,
    update: (view: CarouselView) => CarouselView,
  ): CarouselContent {
    switch (content.views.some((view) => view.id === viewId)) {
      case true:
        break
      case false:
        throw new Error(`La vue Carousel ${viewId} est introuvable.`)
    }
    return {
      ...content,
      views: content.views.map((view) => view.id === viewId ? update(view) : view),
    }
  }
}
