import { BaseComponent } from 'codplay-v1/runtime/components/lib/base-component'
import type { ComponentRenderResult, RuntimeComponentClassInput, RuntimeComponentUpdateInput } from 'codplay-v1/runtime/components/types'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const STROKE_WIDTH = '4'

export type SketchStroke = { id: string; d: string; stroke: string }

export type SketchAction = {
  addStroke?: SketchStroke
  clear?: boolean
  restore?: SketchStroke[]
}

function createSvgElement<T extends keyof SVGElementTagNameMap>(tagName: T): SVGElementTagNameMap[T] {
  return document.createElementNS(SVG_NAMESPACE, tagName)
}

/**
 * Génère et gère en interne une collection de tracés SVG (`<path>`), jamais
 * exposés comme persos. Le tracé en cours (dessin live) reste un perso
 * séparé et "bête" (`strokeLive`) : le canal de tick d'une capture cible
 * toujours le node racine d'un perso, jamais `component.update()` — voir
 * docs/plans/2026-07-23-canvas-stroke-capture-plan.md, section
 * "Évolution — accumulation multi-tracés".
 */
export class SketchingComponent extends BaseComponent {
  private pathById = new Map<string, SVGPathElement>()

  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(['className', 'style', 'attr'])
  }

  // Idempotent par `id` : un `sketch:add-stroke` matérialisé peut être rejoué
  // plus d'une fois (seek, replay) — un même id doit toujours mettre à jour
  // le `<path>` existant, jamais en ajouter un second orphelin que
  // `clearStrokes()` ne retrouverait plus (la `Map` n'aurait gardé que la
  // dernière référence, laissant les précédentes dans le DOM pour de bon).
  private addStroke(stroke: SketchStroke): void {
    const existing = this.pathById.get(stroke.id)
    if (existing !== undefined) {
      existing.setAttribute('d', stroke.d)
      existing.setAttribute('stroke', stroke.stroke)
      return
    }

    const path = createSvgElement('path')
    path.setAttribute('d', stroke.d)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', stroke.stroke)
    path.setAttribute('stroke-width', STROKE_WIDTH)
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    ;(this.node as SVGGElement).appendChild(path)
    this.pathById.set(stroke.id, path)
  }

  private clearStrokes(): void {
    const root = this.node as SVGGElement
    for (const path of this.pathById.values()) {
      root.removeChild(path)
    }
    this.pathById.clear()
  }

  update(input: RuntimeComponentUpdateInput): void {
    this.services.apply(this.node, input.action, input.serviceContext)

    const action = input.action as SketchAction
    if (action.addStroke !== undefined) {
      this.addStroke(action.addStroke)
      return
    }
    if (action.restore !== undefined) {
      this.clearStrokes()
      for (const stroke of action.restore) {
        this.addStroke(stroke)
      }
      return
    }
    if (action.clear === true) {
      this.clearStrokes()
    }
  }

  /**
   * Racine `<g>` SVG-namespaced (un conteneur, jamais une forme) —
   * réutilisée telle quelle au seek : retire tous les `<path>` déjà
   * ajoutés avant que le replay ne recommence, jamais recréée. Même
   * principe que `LayoutComponent`/`PolygonComponent`, qui restaurent
   * leur baseline en place plutôt que de recréer leur node (voir
   * `v1-seek-spec.md` : reset puis replay dans la même tâche synchrone).
   */
  render(): ComponentRenderResult {
    if (this.node !== null) {
      this.clearStrokes()
      return this.node as Node
    }
    return createSvgElement('g')
  }
}
