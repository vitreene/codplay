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
  matrix: HtmlMatrix
  parentMatrix: HtmlMatrix
  layoutOffset?: Readonly<{ x: number; y: number }>
  rotationMatrix: HtmlMatrix
  scaleX: number
  scaleY: number
  localWidth: number
  localHeight: number
  frameWidth: number
  frameHeight: number
}>
