import { ELCE_EDITOR_SETTINGS } from '../../config/editor-settings'
import { CAROUSEL_BDC_TYPE } from '../../resources/bdcs/carousel/carousel-config'
import { SECTION_BDC_TYPE } from '../../resources/bdcs/section/section-config'
import type { ContentPage } from '../../core/document/content-document-types'
import type { BdcId } from '../../core/document/content-document-types'
import type { ResourceBdc } from '../../resources/document/resource-document-types'
import type { RevelationTransitionDefaults, RevelationTransitionOverrides } from '../../resources/revelation/revelation-types'
import type {
  ElceResolvedPageSettings,
  ElceResolvedPlayerSettings,
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
    page: ContentPage,
    bdcs: readonly ResourceBdc[],
    projectDefaults: RevelationTransitionDefaults,
  ): ElceResolvedPageSettings {
    const bdcsById = new Map(bdcs.map((bdc) => [bdc.id, bdc]))
    const relevantBdcIds = this.collectPageBdcIds(page, bdcs)
    const resolvedByBdcId = new Map<BdcId, RevelationTransitionDefaults>()
    const resolvingBdcIds = new Set<BdcId>()
    const byBdcId: Record<BdcId, RevelationTransitionDefaults> = {}
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
      if (bdc.type !== CAROUSEL_BDC_TYPE || bdc.carousel == null) continue
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
        cardObservationZone: ELCE_EDITOR_SETTINGS.revelation.flux.cardObservationZone,
        graphObservation: ELCE_EDITOR_SETTINGS.revelation.flux.graphObservation,
        imageEntrance: ELCE_EDITOR_SETTINGS.revelation.flux.imageEntrance,
      },
    }
  }

  /** Collects the page's direct BDCs and every descendant stored under them. */
  private collectPageBdcIds(page: ContentPage, bdcs: readonly ResourceBdc[]): readonly BdcId[] {
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
    bdc: ResourceBdc,
    bdcsById: ReadonlyMap<BdcId, ResourceBdc>,
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
  private revelationOverrides(bdc: ResourceBdc): RevelationTransitionOverrides | null {
    switch (bdc.type) {
      case SECTION_BDC_TYPE:
        return bdc.section?.revelation ?? null
      case CAROUSEL_BDC_TYPE:
        return bdc.carousel?.revelation ?? null
      default:
        return null
    }
  }

}
