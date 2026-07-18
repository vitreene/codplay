import { computeTextAutoSize, pxToCqw } from '@codplay/text-auto-size'
import { createDecorEditorPalette } from './render'
import type { DecorEditorController } from './controller'
import type { ResolvedDecor } from './types'

/**
 * Le contrat minimal dont dedit a besoin pour suivre le node DOM réel d'un item — la forme
 * exacte de `AuthorApi.subscribeToNode` (`@codplay/selection-frame`, lui-même un wrapper autour
 * de `PlayerApi.subscribeToNode`). Redéclaré ici plutôt que d'importer tout `AuthorApi` pour un
 * seul champ — pas de dépendance package pour une simple forme de fonction.
 *
 * Le node d'un item PEUT disparaître et être recréé pendant l'édition (seek, rebuild — discussion
 * `2026-07-10-app-construction-discussion.md` §233) : dedit ne tient donc jamais une référence DOM
 * figée, il s'abonne et applique le décor résolu à chaque apparition du node, exactement comme
 * `selection-frame` le fait pour son cadre de sélection.
 */
export type SubscribeToNode = (itemId: string, cb: (node: Element | null) => void) => () => void

export interface MountDecorEditorOptions {
  /** Largeur du conteneur de référence pour la conversion cqw ↔ px (spec text-auto-size §3.3/§4) — celle du substrat réel, pas une valeur de démo. */
  referenceWidthPx: number
}

export interface DecorEditorMountHandle {
  /**
   * Coupe/reprend l'écriture de la preview live sur les nodes réels (`applyResolvedDecor`) — sans
   * toucher `controller`/`decorEditorMachine` (panneau actif, `visualPosition`/`zoneMode` restent
   * intacts, contrairement à `controller.detach()` qui les réinitialise via `ITEMS.DETACH`).
   * Utilisé par `decor-editor-bridge.ts` pour l'état `playing`
   * (`2026-07-17-play-mode-decor-editor-deactivation-plan.md`) : suspendu à l'entrée (aucune
   * écriture, y compris quand le node est remplacé par le rebuild forcé du pont `scenePlayer` et
   * que `subscribeToNode` notifie le nouveau node) ; la reprise réapplique immédiatement la preview
   * courante sur le node actuel.
   */
  setPreviewSuspended(suspended: boolean): void
  destroy(): void
}

/**
 * Monte la palette d'édition dedit dans `container`, pilotée par `controller` (déjà construit,
 * items déjà attachés via `controller.attachItems(...)`) — et applique le décor RÉSOLU en preview
 * live sur le node réel de chaque item édité, suivi via `subscribeToNode` (jamais une référence
 * DOM figée). C'est le mécanisme de preview live du flux d'édition (discussion §"Scénario du flux
 * d'édition… — Preview synchrone") : dedit écrit directement sur le node monté par le player,
 * jamais sur le document — le commit (émis par le contrôleur, hors de ce module) est ce qui
 * consolide la valeur et déclenche le rebuild.
 */
export function mountDecorEditor(
  container: HTMLElement,
  controller: DecorEditorController,
  subscribeToNode: SubscribeToNode,
  options: MountDecorEditorOptions,
): DecorEditorMountHandle {
  const nodesByItemId = new Map<string, Element | null>()
  const unsubscribeNodeByItemId = new Map<string, () => void>()
  let previewSuspended = false

  /** `getPatches()`/`getResolvedDecors()` sont deux `.map()` sur la même liste d'items attachés — même ordre, zippés une seule fois plutôt que ré-appariés par un second appel. */
  function applyToAllAttachedNodes(): void {
    if (previewSuspended) return
    const itemIds = controller.getPatches().map((entry) => entry.itemId)
    const resolvedDecors = controller.getResolvedDecors()
    itemIds.forEach((itemId, index) => {
      const decor = resolvedDecors[index]
      const node = nodesByItemId.get(itemId)
      if (decor && node instanceof HTMLElement) applyResolvedDecor(node, decor, options.referenceWidthPx)
    })
  }

  /**
   * Réconcilie les abonnements `subscribeToNode` avec le jeu COURANT d'items attachés — appelé à
   * chaque changement du contrôleur, jamais une seule fois à la construction. `ensureMounted()`
   * (`decor-editor-bridge.ts`) appelle toujours ce module AVANT `syncSelection()`/`attachItems()` :
   * un abonnement figé à la construction ne verrait donc JAMAIS aucun item (`getPatches()` toujours
   * vide à cet instant) — c'est ce qui rendait la preview live totalement inerte (couleur visible
   * seulement au commit+rebuild, jamais avant). Symétrique de ce que `selection-frame.ts` fait déjà
   * pour le cadre (réabonnement à chaque changement de sélection).
   */
  function syncNodeSubscriptions(): void {
    const currentIds = new Set(controller.getPatches().map((entry) => entry.itemId))
    for (const itemId of unsubscribeNodeByItemId.keys()) {
      if (currentIds.has(itemId)) continue
      unsubscribeNodeByItemId.get(itemId)?.()
      unsubscribeNodeByItemId.delete(itemId)
      nodesByItemId.delete(itemId)
    }
    for (const itemId of currentIds) {
      if (unsubscribeNodeByItemId.has(itemId)) continue
      const unsubscribe = subscribeToNode(itemId, (node) => {
        nodesByItemId.set(itemId, node)
        applyToAllAttachedNodes()
      })
      unsubscribeNodeByItemId.set(itemId, unsubscribe)
    }
  }

  syncNodeSubscriptions()

  const palette = createDecorEditorPalette(controller)
  palette.element.style.top = '24px'
  palette.element.style.left = '24px'
  container.appendChild(palette.element)
  palette.render()
  groupTypoIconFields(palette.element)

  const unsubscribeController = controller.subscribe(() => {
    syncNodeSubscriptions()
    applyToAllAttachedNodes()
    groupTypoIconFields(palette.element)
  })

  return {
    setPreviewSuspended(suspended: boolean): void {
      previewSuspended = suspended
      if (!suspended) applyToAllAttachedNodes()
    },
    destroy(): void {
      unsubscribeController()
      for (const unsubscribe of unsubscribeNodeByItemId.values()) unsubscribe()
      container.innerHTML = ''
    },
  }
}

/**
 * Ad hoc à la démo (pas de framework de layout dans le moteur, cf plan de
 * conception) : regroupe B/I/Alignement — les 3 champs sans label du panneau
 * Typo — sur une ligne flex commune, avec un séparateur entre I et les icônes
 * d'alignement. Ré-exécuté après chaque render : sans effet si le panneau actif
 * n'est pas Typo, ou si le regroupement est déjà en place (idempotent).
 */
function groupTypoIconFields(paletteEl: HTMLElement): void {
  const panel = paletteEl.querySelector('.dedit-panel')
  if (!panel) return
  const rows = Array.from(panel.querySelectorAll<HTMLElement>(':scope > .dedit-field'))
  const unlabeled = rows.filter((row) => !row.querySelector('.dedit-field__label'))
  if (unlabeled.length < 3) return // pas le panneau Typo (ou déjà regroupé)

  const [bold, italic, align] = unlabeled
  if (!bold || !italic || !align) return

  const wrapper = document.createElement('div')
  wrapper.classList.add('dedit-icon-row')
  bold.before(wrapper)
  wrapper.append(bold, italic)

  const separator = document.createElement('div')
  separator.classList.add('dedit-icon-row__separator')
  wrapper.append(separator, align)
}

/**
 * Écrit le décor RÉSOLU (défauts ⊕ chaîne ⊕ écart) sur le node réel — la PREVIEW live (discussion
 * §"Preview synchrone, à chaque tick, non enregistrée" : "pur retour visuel, éphémère, local ; ne
 * touche jamais le document"). Le style géré par dedit n'est PAS réinitialisé avant réapplication
 * ici (contrairement à l'ancienne démo, qui contrôlait un node qu'elle créait elle-même) : ce node
 * est le node RÉEL du player, dont le style de base (hors props gérées par dedit) ne doit jamais
 * être effacé. Seules les propriétés que `decor.style` porte sont écrites/mises à jour ; une
 * propriété retirée par « hériter » doit être retirée explicitement (`removeProperty`), jamais
 * laissée en place par un `setProperty` qui ne peut qu'ajouter/écraser.
 *
 * `textAutoSize` (spec text-auto-size §7) : calculé ici, en direct, sur le node affiché — jamais
 * persisté (l'écart ne porte que `enabled`). `custom` est ajouté en dernier, donc prime toujours
 * sur le résultat du calcul (§6).
 */
function applyResolvedDecor(el: HTMLElement, decor: ResolvedDecor, referenceWidthPx: number): void {
  if (decor.text !== undefined) el.textContent = decor.text
  if (decor.style) {
    for (const [prop, value] of Object.entries(decor.style)) {
      el.style.setProperty(prop, value)
    }
  }
  if (decor.textAutoSize?.enabled) {
    applyTextAutoSize(el, decor, referenceWidthPx)
  }
  if (decor.custom !== undefined) el.style.cssText += `;${decor.custom}`
}

/**
 * Zone de texte réellement disponible (content-box, padding/bordure déduits) — le contrat
 * est que TOUT le texte tienne dans le bloc, padding compris, pas seulement dans sa boîte
 * de bordure. `getComputedStyle().width/height` rapporte la taille selon `box-sizing` tel
 * que déclaré (ex. la boîte de BORDURE avec `box-sizing:border-box`, vérifié empiriquement
 * ici — pas automatiquement le contenu) : padding et bordure sont donc déduits
 * explicitement, via d'autres propriétés calculées — toujours des computed styles, jamais
 * `getBoundingClientRect` (mesure, pas ancrage).
 */
function contentBoxSizePx(cs: CSSStyleDeclaration): { widthPx: number; heightPx: number } {
  const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
  const paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
  const borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)
  const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
  return {
    widthPx: parseFloat(cs.width) - paddingX - borderX,
    heightPx: parseFloat(cs.height) - paddingY - borderY,
  }
}

/**
 * La police utilisée pour la mesure doit être EXACTEMENT celle qui sera rendue — y compris
 * son repli (ex. `decor.style['font-family']` absent, comme au tout premier chargement).
 * Un repli codé en dur ici (ex. "Inter") diverge silencieusement du repli réel choisi par
 * le navigateur (une police système quelconque), causant des écarts de mesure minimes qui
 * font parfois basculer le texte sur une ligne de plus — d'où la lecture de la police
 * réellement CALCULÉE sur l'élément, jamais une valeur par défaut devinée.
 */
function applyTextAutoSize(el: HTMLElement, decor: ResolvedDecor, referenceWidthPx: number): void {
  const cs = getComputedStyle(el)
  const { widthPx, heightPx } = contentBoxSizePx(cs)

  const result = computeTextAutoSize({
    text: decor.text ?? '',
    font: {
      family: cs.fontFamily,
      weight: cs.fontWeight,
      style: cs.fontStyle === 'italic' ? 'italic' : 'normal',
    },
    blockWidthCqw: pxToCqw(widthPx, referenceWidthPx),
    blockHeightCqw: pxToCqw(heightPx, referenceWidthPx),
    referenceWidthPx,
  })

  el.style.setProperty('font-size', `${result.fontSizeCqw}cqw`)
  el.style.setProperty('line-height', String(result.lineHeight))
  el.style.setProperty('font-stretch', result.fontStretch)
}
