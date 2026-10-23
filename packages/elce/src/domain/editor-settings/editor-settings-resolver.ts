import { ELCE_EDITOR_SETTINGS } from '../../config/editor-settings'
import { BDC_TYPE, PAGE_TYPE } from '../../config/document-config'
import type {
  Bdc,
  BdcId,
  Page,
  RevelationTransitionDefaults,
  RevelationTransitionOverrides,
} from '../document/document-types'
import type {
  ElceResolvedPageSettings,
  ElceResolvedPlayerSettings,
  ResolvedCardMediaMotion,
} from './editor-settings-types'

/** Resolves persisted and hidden editor settings before scene projection. */
export class ElceEditorSettingsResolver {
  /** Resolves global player settings before projecting persistent player scenes. */
  public resolvePlayer(): ElceResolvedPlayerSettings {
    return ELCE_EDITOR_SETTINGS.player
  }

  /** Resolves explicit non-null overrides over inherited revelation values. */
  public resolveOverrides(
    inherited: RevelationTransitionDefaults,
    overrides: RevelationTransitionOverrides | null,
  ): RevelationTransitionDefaults {
    return {
      intro: overrides?.intro ?? inherited.intro,
      outro: overrides?.outro ?? inherited.outro,
    }
  }

  /** Resolves the effective settings for the BDC tree rendered by one page. */
  public resolvePage(
    page: Page,
    bdcs: readonly Bdc[],
    projectDefaults: RevelationTransitionDefaults,
  ): ElceResolvedPageSettings {
    const bdcsById = new Map(bdcs.map((bdc) => [bdc.id, bdc]))
    const relevantBdcIds = this.collectPageBdcIds(page, bdcs)
    const resolvedByBdcId = new Map<BdcId, RevelationTransitionDefaults>()
    const resolvingBdcIds = new Set<BdcId>()
    const byBdcId: Record<BdcId, RevelationTransitionDefaults> = {}
    const cardMediaMotionByBdcId: Record<BdcId, ResolvedCardMediaMotion> = {}
    const carouselsByBdcId: Record<
      BdcId,
      ElceResolvedPageSettings['revelation']['carouselsByBdcId'][BdcId]
    > = {}

    for (const bdcId of relevantBdcIds) {
      const bdc = bdcsById.get(bdcId)
      if (bdc === undefined) throw new Error(`Le BDC ${bdcId} de la page ${page.id} est introuvable.`)
      byBdcId[bdcId] = this.resolveBdcRevelation(
        bdc,
        bdcsById,
        projectDefaults,
        resolvedByBdcId,
        resolvingBdcIds,
      )
      if (this.isFluxCardPlacement(page.type, bdc, bdcsById)) {
        const effective = byBdcId[bdcId]
        const cardMotion = ELCE_EDITOR_SETTINGS.revelation.flux.cardMediaMotion
        cardMediaMotionByBdcId[bdcId] = {
          intro: this.conflictsWithCardTransition(effective.intro) ? null : cardMotion.intro,
          outro: this.conflictsWithCardTransition(effective.outro) ? null : cardMotion.outro,
          imageOpacity: cardMotion.imageOpacity,
          suppressCardOpacityTransitionForImages: cardMotion.suppressCardOpacityTransitionForImages,
        }
      }
      if (bdc.type !== BDC_TYPE.CAROUSEL || bdc.carousel == null) continue
      const defaults = byBdcId[bdcId]
      const entries: Record<BdcId, RevelationTransitionDefaults> = {}
      for (const entry of bdc.carousel.cards) {
        entries[entry.bdcId] = {
          intro: entry.introTransitionRef ?? defaults.intro,
          outro: entry.outroTransitionRef ?? defaults.outro,
        }
      }
      carouselsByBdcId[bdcId] = {
        defaults,
        entries,
        generateDefaultOutro: ELCE_EDITOR_SETTINGS.revelation.carousel.generateDefaultOutro,
      }
    }

    return {
      player: this.resolvePlayer(),
      revelation: {
        byBdcId,
        carouselsByBdcId,
        cardMediaMotionByBdcId,
        cardObservationZone: ELCE_EDITOR_SETTINGS.revelation.flux.cardObservationZone,
        graphObservation: ELCE_EDITOR_SETTINGS.revelation.flux.graphObservation,
        imageEntrance: ELCE_EDITOR_SETTINGS.revelation.flux.imageEntrance,
      },
    }
  }

  /** Collects the page's direct BDCs and every descendant stored under them. */
  private collectPageBdcIds(page: Page, bdcs: readonly Bdc[]): readonly BdcId[] {
    const relevantBdcIds = new Set(page.bdcIds)
    let addedChild = true
    while (addedChild) {
      addedChild = false
      for (const bdc of bdcs) {
        if (bdc.parentBdcId === null || !relevantBdcIds.has(bdc.parentBdcId) || relevantBdcIds.has(bdc.id)) continue
        relevantBdcIds.add(bdc.id)
        addedChild = true
      }
    }
    return [...relevantBdcIds]
  }

  /** Resolves a BDC's local overrides over its resolved parent settings. */
  private resolveBdcRevelation(
    bdc: Bdc,
    bdcsById: ReadonlyMap<BdcId, Bdc>,
    projectDefaults: RevelationTransitionDefaults,
    resolvedByBdcId: Map<BdcId, RevelationTransitionDefaults>,
    resolvingBdcIds: Set<BdcId>,
  ): RevelationTransitionDefaults {
    const cached = resolvedByBdcId.get(bdc.id)
    if (cached !== undefined) return cached
    if (resolvingBdcIds.has(bdc.id)) throw new Error(`Une boucle de parenté existe autour du BDC ${bdc.id}.`)
    resolvingBdcIds.add(bdc.id)

    const parent = bdc.parentBdcId === null ? undefined : bdcsById.get(bdc.parentBdcId)
    if (bdc.parentBdcId !== null && parent === undefined) {
      throw new Error(`Le BDC parent ${bdc.parentBdcId} du BDC ${bdc.id} est introuvable.`)
    }
    const inherited = parent === undefined
      ? projectDefaults
      : this.resolveBdcRevelation(parent, bdcsById, projectDefaults, resolvedByBdcId, resolvingBdcIds)
    const resolved = this.resolveOverrides(inherited, this.revelationOverrides(bdc))
    resolvingBdcIds.delete(bdc.id)
    resolvedByBdcId.set(bdc.id, resolved)
    return resolved
  }

  /** Reads only the override owned by a BDC type that exposes revelation settings. */
  private revelationOverrides(bdc: Bdc): RevelationTransitionOverrides | null {
    switch (bdc.type) {
      case BDC_TYPE.SECTION:
        return bdc.section?.revelation ?? null
      case BDC_TYPE.CAROUSEL:
        return bdc.carousel?.revelation ?? null
      default:
        return null
    }
  }

  /** Gives a configured horizontal Capsule transition priority over media motion. */
  private conflictsWithCardTransition(reference: RevelationTransitionDefaults['intro']): boolean {
    return ELCE_EDITOR_SETTINGS.revelation.flux.cardMediaMotion.conflictsWith.some((candidate) => candidate === reference)
  }

  /** Limits scroll-driven media movement to direct and Section-anchored Flux Cards. */
  private isFluxCardPlacement(pageType: Page['type'], bdc: Bdc, bdcsById: ReadonlyMap<BdcId, Bdc>): boolean {
    if (pageType !== PAGE_TYPE.FLUX || bdc.type !== BDC_TYPE.CARD) return false
    if (bdc.parentBdcId === null) return true
    return bdcsById.get(bdc.parentBdcId)?.type === BDC_TYPE.SECTION
  }
}
