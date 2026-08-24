import { SVG_MATERIALIZER_ID } from '../materializer'
import {
  HtmlComponentMaterializer,
  type HtmlComponentMaterializerNodes,
  type HtmlMaterializerRuntimeContext,
} from './html-component-materializer'

/** Node registries shared by one SVG DOM materializer host. */
export type SvgComponentMaterializerNodes = HtmlComponentMaterializerNodes

/** SVG DOM materializer reusing the common HTML/SVG structure implementation. */
export class SvgComponentMaterializer extends HtmlComponentMaterializer {
  /** Creates one SVG materializer with the shared DOM services and node registries. */
  constructor(
    nodes: SvgComponentMaterializerNodes,
    context: HtmlMaterializerRuntimeContext = { numericLengthScale: 1 },
  ) {
    super(nodes, context, SVG_MATERIALIZER_ID)
  }

  /** Materializes only SVG-rooted markup so HTML and SVG namespaces cannot be mixed accidentally. */
  materializeComponent(...args: Parameters<HtmlComponentMaterializer['materializeComponent']>): ReturnType<HtmlComponentMaterializer['materializeComponent']> {
    const handle = super.materializeComponent(...args)
    const identity = args[1]
    const root = (args[0] as { node?: unknown }).node
    if (!hasSvgRoots(root)) {
      handle.destroy()
      throw new Error(`SVG materializer requires an SVG root: ${identity.componentType}`)
    }
    return handle
  }
}

/** Checks every real root produced by one SVG component template. */
function hasSvgRoots(root: unknown): boolean {
  const roots = Array.isArray(root) ? root : [root]
  return roots.length > 0 && roots.every((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false
    return (candidate as { namespaceURI?: unknown }).namespaceURI === 'http://www.w3.org/2000/svg'
  })
}
