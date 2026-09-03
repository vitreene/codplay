/** Affine matrix supplied by the HTML host pose implementation. */
export type HtmlMatrix = Readonly<{
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}>

/** Numeric HTML pose captured in one browser coordinate space. */
export type HtmlPose = Readonly<{
  rect: Readonly<{ left: number; top: number; width: number; height: number }>
  /** World-space origin of the local box before its linear matrix. */
  origin: Readonly<{ x: number; y: number }>
  /**
   * World-space origin of the untransformed layout box.
   *
   * The HTML presentation layer replaces the authored transform wholesale;
   * it must therefore subtract this layout origin, not the already
   * transformed affine origin. Synthetic poses may omit it; their conversion
   * to a relative pose treats the affine origin as the layout origin.
   */
  layoutOrigin?: Readonly<{ x: number; y: number }>
  matrix: HtmlMatrix
  parentMatrix: HtmlMatrix
  rotationMatrix: HtmlMatrix
  scaleX: number
  scaleY: number
  localWidth: number
  localHeight: number
  frameWidth: number
  frameHeight: number
}>
